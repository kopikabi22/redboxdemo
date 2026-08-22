import { StorageKeys, readCollection, writeCollection, generateId, nowIso } from './storage';
import { recordStockMove, getAvailableStock } from './stock';
import { earnPointsForTransaction } from './membership';
import { validateAndCalculatePromo, incrementPromoUsage } from './promotions';
import { deductStockFEFO } from './batches';
import type {
  CashMove,
  Customer,
  InventoryBalance,
  LoyaltyLedgerEntry,
  StockMove,
  Transaction,
  TransactionCustomer,
  TransactionLineItem,
  PaymentMethod,
  AppliedPromoInfo,
  Promotion,
  ProductBatch,
} from './types';

const TAX_RATE = 0.1;

export interface CartTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

export function calculateCartTotals(items: TransactionLineItem[], discountAmount = 0): CartTotals {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const taxableSubtotal = items.reduce((sum, item) => sum + (item.taxable === false ? 0 : item.price * item.qty), 0);

  const discount = Math.min(Math.max(0, discountAmount), subtotal);
  const taxableDiscount = Math.min(discount, taxableSubtotal);
  const netTaxable = Math.max(0, taxableSubtotal - taxableDiscount);

  const tax = Math.round(netTaxable * TAX_RATE);
  const total = Math.max(0, subtotal - discount) + tax;

  return { subtotal, discount, tax, total };
}

export interface CheckoutInput {
  branchId: string;
  cashierId: string;
  cashierName: string;
  customer: TransactionCustomer;
  items: TransactionLineItem[];
  method: PaymentMethod;
  /** Amount tendered for Cash payments; ignored (and forced to total) for every other method. */
  cashTendered: number;
  /** Optional promo code to validate and apply at checkout. */
  promoCode?: string | null;
  /** Optional pre-validated promo info. */
  appliedPromo?: AppliedPromoInfo | null;
}

/**
 * Finalizes a POS sale as one composite operation: writes the transaction,
 * deducts stock for product lines through the shared stock-movement ledger
 * function (never by touching InventoryBalance directly), logs the
 * matching cash-in movement for Cash payments, increments promo usage count
 * if a promo is applied, and — for member customers — earns loyalty points
 * based on net spend through earnPointsForTransaction().
 *
 * Safety nets around that, all checked *before* anything is written:
 *  1. Stock is validated per distinct productId with quantities summed
 *     across every line item for that product first.
 *  2. Promo eligibility, date validity, branch scoping, min spend, and
 *     remaining usage quota are verified before any mutations begin.
 *  3. For Cash payments, cashTendered must cover the total.
 *  4. The SEVEN collections it can touch (transactions, stockMoves,
 *     inventoryBalances, cashMoves, loyaltyLedger, customers, promotions) are
 *     snapshotted up front. If anything throws once writing has started,
 *     every one of those seven collections is restored to its snapshot.
 */
export function checkout(input: CheckoutInput): Transaction {
  const productItems = input.items.filter((item) => item.kind === 'product');

  const requestedQtyByProductId = new Map<string, number>();
  for (const item of productItems) {
    requestedQtyByProductId.set(item.itemId, (requestedQtyByProductId.get(item.itemId) ?? 0) + item.qty);
  }
  for (const [productId, requestedQty] of requestedQtyByProductId) {
    const available = getAvailableStock(productId, input.branchId);
    if (requestedQty > available) {
      const name = productItems.find((item) => item.itemId === productId)?.name ?? productId;
      throw new Error(`Stok tidak cukup untuk "${name}": tersisa ${available}, diminta ${requestedQty}.`);
    }
  }

  let promoToApply: AppliedPromoInfo | null = null;
  let discountAmount = 0;

  if (input.promoCode) {
    const calc = validateAndCalculatePromo(input.promoCode, input.branchId, input.items);
    promoToApply = calc.appliedPromo;
    discountAmount = calc.discountAmount;
  } else if (input.appliedPromo) {
    const calc = validateAndCalculatePromo(input.appliedPromo.code, input.branchId, input.items);
    promoToApply = calc.appliedPromo;
    discountAmount = calc.discountAmount;
  }

  const { subtotal, discount, tax, total } = calculateCartTotals(input.items, discountAmount);

  if (input.method === 'Cash' && input.cashTendered < total) {
    throw new Error(`Uang tunai diterima (${input.cashTendered}) kurang dari total tagihan (${total}).`);
  }

  const transaction: Transaction = {
    id: `TRX-${Date.now().toString().slice(-8)}`,
    branchId: input.branchId,
    cashierId: input.cashierId,
    cashierName: input.cashierName,
    customer: input.customer,
    items: input.items,
    subtotal,
    discount,
    tax,
    total,
    method: input.method,
    cashTendered: input.method === 'Cash' ? input.cashTendered : total,
    change: input.method === 'Cash' ? input.cashTendered - total : 0,
    appliedPromo: promoToApply,
    timestamp: nowIso(),
  };

  // Deep-copy snapshots across all 8 collections
  const transactionsSnapshot = structuredClone(readCollection<Transaction>(StorageKeys.transactions));
  const stockMovesSnapshot = structuredClone(readCollection<StockMove>(StorageKeys.stockMoves));
  const inventoryBalancesSnapshot = structuredClone(readCollection<InventoryBalance>(StorageKeys.inventoryBalances));
  const productBatchesSnapshot = structuredClone(readCollection<ProductBatch>(StorageKeys.productBatches));
  const cashMovesSnapshot = structuredClone(readCollection<CashMove>(StorageKeys.cashMoves));
  const loyaltyLedgerSnapshot = structuredClone(readCollection<LoyaltyLedgerEntry>(StorageKeys.loyaltyLedger));
  const customersSnapshot = structuredClone(readCollection<Customer>(StorageKeys.customers));
  const promotionsSnapshot = structuredClone(readCollection<Promotion>(StorageKeys.promotions));

  try {
    const transactions = readCollection<Transaction>(StorageKeys.transactions);
    transactions.push(transaction);
    writeCollection(StorageKeys.transactions, transactions);

    productItems.forEach((item) => {
      deductStockFEFO(item.itemId, input.branchId, item.qty);
      recordStockMove({
        productId: item.itemId,
        branchId: input.branchId,
        type: 'sale',
        qty: item.qty,
        reference: transaction.id,
        note: 'Penjualan POS',
        actorId: input.cashierId,
      });
    });

    if (input.method === 'Cash') {
      const cashMoves = readCollection<CashMove>(StorageKeys.cashMoves);
      cashMoves.push({
        id: generateId('cash'),
        branchId: input.branchId,
        type: 'in',
        amount: total,
        note: `Transaksi ${transaction.id}`,
        actorId: input.cashierId,
        timestamp: nowIso(),
      });
      writeCollection(StorageKeys.cashMoves, cashMoves);
    }

    if (promoToApply) {
      incrementPromoUsage(promoToApply.promoId);
    }

    earnPointsForTransaction(transaction);

    return transaction;
  } catch (err) {
    writeCollection(StorageKeys.transactions, transactionsSnapshot);
    writeCollection(StorageKeys.stockMoves, stockMovesSnapshot);
    writeCollection(StorageKeys.inventoryBalances, inventoryBalancesSnapshot);
    writeCollection(StorageKeys.productBatches, productBatchesSnapshot);
    writeCollection(StorageKeys.cashMoves, cashMovesSnapshot);
    writeCollection(StorageKeys.loyaltyLedger, loyaltyLedgerSnapshot);
    writeCollection(StorageKeys.customers, customersSnapshot);
    writeCollection(StorageKeys.promotions, promotionsSnapshot);
    throw err;
  }
}
