import { StorageKeys, readCollection, writeCollection, generateId, nowIso } from './storage';
import { recordStockMove, getAvailableStock } from './stock';
import { earnPointsForTransaction } from './membership';
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
} from './types';

const TAX_RATE = 0.1;

export function calculateCartTotals(items: TransactionLineItem[]): { subtotal: number; tax: number; total: number } {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const taxableSubtotal = items.reduce((sum, item) => sum + (item.taxable === false ? 0 : item.price * item.qty), 0);
  const tax = Math.round(taxableSubtotal * TAX_RATE);
  return { subtotal, tax, total: subtotal + tax };
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
}

/**
 * Finalizes a POS sale as one composite operation: writes the transaction,
 * deducts stock for product lines through the shared stock-movement ledger
 * function (never by touching InventoryBalance directly), logs the
 * matching cash-in movement for Cash payments, and — for member customers —
 * earns loyalty points through the shared, already-hardened
 * earnPointsForTransaction()/recordLoyaltyLedgerEntry() path.
 *
 * Safety nets around that, all checked *before* anything is written:
 *  1. Stock is validated per distinct productId with quantities summed
 *     across every line item for that product first (a cart can legally
 *     have the same product split across two lines) — never validated
 *     line-by-line against the same available-stock figure, which would
 *     let two lines under-count a product that's over-sold in total.
 *  2. For Cash payments, cashTendered must cover the total — the data
 *     layer doesn't trust the UI to have already enforced this.
 *  3. The SIX collections it can touch (transactions, stockMoves,
 *     inventoryBalances, cashMoves, loyaltyLedger, customers) are
 *     snapshotted up front. If anything throws once writing has started
 *     (including a write itself failing, since storage.writeCollection no
 *     longer swallows errors), every one of those six collections is
 *     restored to its snapshot before the error is re-thrown — so a failed
 *     checkout never leaves a half-saved transaction, a stock deduction
 *     with no matching sale, a cash-in with no transaction, or points
 *     earned for a sale that didn't actually go through (or vice versa).
 *     earnPointsForTransaction() has its own inner snapshot/rollback too
 *     (via recordLoyaltyLedgerEntry) — the two layers are intentionally
 *     independent, same as the existing stock case.
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

  const { subtotal, tax, total } = calculateCartTotals(input.items);

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
    tax,
    total,
    method: input.method,
    cashTendered: input.method === 'Cash' ? input.cashTendered : total,
    change: input.method === 'Cash' ? input.cashTendered - total : 0,
    timestamp: nowIso(),
  };

  // Deep-copy snapshots (structuredClone, not the same array instances that
  // readCollection() happens to return) so mutating them via push() below
  // can never accidentally corrupt the values we'd restore on failure.
  const transactionsSnapshot = structuredClone(readCollection<Transaction>(StorageKeys.transactions));
  const stockMovesSnapshot = structuredClone(readCollection<StockMove>(StorageKeys.stockMoves));
  const inventoryBalancesSnapshot = structuredClone(readCollection<InventoryBalance>(StorageKeys.inventoryBalances));
  const cashMovesSnapshot = structuredClone(readCollection<CashMove>(StorageKeys.cashMoves));
  const loyaltyLedgerSnapshot = structuredClone(readCollection<LoyaltyLedgerEntry>(StorageKeys.loyaltyLedger));
  const customersSnapshot = structuredClone(readCollection<Customer>(StorageKeys.customers));

  try {
    const transactions = readCollection<Transaction>(StorageKeys.transactions);
    transactions.push(transaction);
    writeCollection(StorageKeys.transactions, transactions);

    productItems.forEach((item) => {
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

    earnPointsForTransaction(transaction);

    return transaction;
  } catch (err) {
    writeCollection(StorageKeys.transactions, transactionsSnapshot);
    writeCollection(StorageKeys.stockMoves, stockMovesSnapshot);
    writeCollection(StorageKeys.inventoryBalances, inventoryBalancesSnapshot);
    writeCollection(StorageKeys.cashMoves, cashMovesSnapshot);
    writeCollection(StorageKeys.loyaltyLedger, loyaltyLedgerSnapshot);
    writeCollection(StorageKeys.customers, customersSnapshot);
    throw err;
  }
}
