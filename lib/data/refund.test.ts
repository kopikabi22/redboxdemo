import { beforeEach, describe, expect, it } from 'vitest';
import {
  StorageKeys,
  businessPeriod,
  checkout,
  createProductBatch,
  calculateEmployeePayrollDraft,
  generateMonthlyPayroll,
  approvePayrollRecord,
  getBarberProductivityMetrics,
  getPhysicalStock,
  getSalableStock,
  getTransactionById,
  getBatchById,
  generateProfitAndLossReport,
  generateCashFlowReport,
  recordLoyaltyLedgerEntry,
  refundTransaction,
  writeCollection,
  readCollection,
} from './index';
import type {
  AuditLogRecord,
  Branch,
  CashMove,
  Customer,
  Employee,
  LoyaltyLedgerEntry,
  Product,
  ProductBatch,
  Promotion,
  Service,
  Transaction,
  TransactionCustomer,
} from './types';

const branchA: Branch = { id: 'br_a', name: 'Branch A', city: 'Cirebon', province: 'Jawa Barat', address: 'A', phone: '1' };
const branchB: Branch = { id: 'br_b', name: 'Branch B', city: 'Cirebon', province: 'Jawa Barat', address: 'B', phone: '2' };
const cashier: Employee = { id: 'cashier_a', name: 'Kasir A', role: 'Kasir', branchId: branchA.id, pin: '1111' };
const barber: Employee = { id: 'barber_a', name: 'Barber A', role: 'Barber', branchId: branchA.id, pin: '2222' };
const manager: Employee = { id: 'manager_a', name: 'Manager A', role: 'BranchManager', branchId: branchA.id, pin: '3333' };
const managerB: Employee = { id: 'manager_b', name: 'Manager B', role: 'BranchManager', branchId: branchB.id, pin: '4444' };
const owner: Employee = { id: 'owner_1', name: 'Owner', role: 'Owner', branchId: branchA.id, pin: '9999' };
const service: Service = { id: 'svc_haircut', name: 'Haircut', category: 'Service', durationMinutes: 30, price: 100000, commissionPercent: 25 };
const product: Product = { id: 'prd_pomade', sku: 'POM-1', name: 'Pomade', category: 'Retail', brand: 'RB', cost: 10000, price: 50000, lowStockThreshold: 1 };
const guest: TransactionCustomer = { type: 'guest', customerId: null, name: 'Guest', phone: '081', tier: null };
const member: Customer = { id: 'cust_member', name: 'Member One', phone: '0821', type: 'member', tier: 'Silver', points: 0, createdAt: '2026-01-01T00:00:00Z' };
const memberCustomer: TransactionCustomer = { type: 'member', customerId: member.id, name: member.name, phone: member.phone, tier: member.tier };

beforeEach(() => {
  window.localStorage.clear();
  writeCollection(StorageKeys.branches, [branchA, branchB]);
  writeCollection(StorageKeys.employees, [cashier, barber, manager, managerB, owner]);
  writeCollection(StorageKeys.services, [service]);
  writeCollection(StorageKeys.products, [product]);
  writeCollection(StorageKeys.customers, [{ ...member }]);
  writeCollection(StorageKeys.transactions, []);
  writeCollection(StorageKeys.attendance, []);
  writeCollection(StorageKeys.payrollRecords, []);
  writeCollection(StorageKeys.cashMoves, []);
  writeCollection(StorageKeys.loyaltyLedger, []);
  writeCollection(StorageKeys.promotions, []);
  writeCollection(StorageKeys.auditLogs, []);
});

describe('Fase 3 refund', () => {
  it('1. full refund of a service-only transaction flips status and leaves stock untouched', () => {
    const sale = checkout({
      branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer: guest, barberId: barber.id,
      items: [{ kind: 'service', itemId: service.id, name: service.name, price: service.price, qty: 1 }],
      method: 'Cash', cashTendered: 110000,
    });
    const refunded = refundTransaction(sale.id, 'Customer tidak puas', manager);
    expect(refunded.status).toBe('refunded');
    expect(refunded.refundedBy).toBe(manager.id);
    expect(refunded.refundReason).toBe('Customer tidak puas');
    expect(getTransactionById(sale.id)?.status).toBe('refunded');
  });

  it('2. full refund of a product-only transaction restores physical and salable stock exactly', () => {
    createProductBatch({ productId: product.id, branchId: branchA.id, batchNumber: 'B1', expiryDate: '2027-01-01', initialQty: 5, cost: 10000 }, manager);
    const sale = checkout({
      branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer: guest,
      items: [{ kind: 'product', itemId: product.id, name: product.name, price: 50000, qty: 3 }],
      method: 'Cash', cashTendered: 165000, // subtotal 150000 + 10% tax
    });
    expect(getPhysicalStock(product.id, branchA.id)).toBe(2);
    refundTransaction(sale.id, 'Produk cacat', manager);
    expect(getPhysicalStock(product.id, branchA.id)).toBe(5);
    expect(getSalableStock(product.id, branchA.id)).toBe(5);
  });

  it('3. mixed service + product refund reverses the product side and excludes both lines from commission', () => {
    createProductBatch({ productId: product.id, branchId: branchA.id, batchNumber: 'B1', expiryDate: '2027-01-01', initialQty: 5, cost: 10000 }, manager);
    const sale = checkout({
      branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer: guest, barberId: barber.id,
      items: [
        { kind: 'service', itemId: service.id, name: service.name, price: 100000, qty: 1 },
        { kind: 'product', itemId: product.id, name: product.name, price: 50000, qty: 2 },
      ],
      method: 'Cash', cashTendered: 250000,
    });
    refundTransaction(sale.id, 'Batal semua', manager);
    expect(getPhysicalStock(product.id, branchA.id)).toBe(5);
    const draft = calculateEmployeePayrollDraft(barber.id, businessPeriod(), branchA.id);
    expect(draft.serviceCommission).toBe(0);
    expect(draft.productCommission).toBe(0);
  });

  it('4. restores the EXACT original FEFO batch split, not a fresh FEFO run', () => {
    createProductBatch({ productId: product.id, branchId: branchA.id, batchNumber: 'EARLY', expiryDate: '2027-01-01', initialQty: 2, cost: 10000 }, manager);
    createProductBatch({ productId: product.id, branchId: branchA.id, batchNumber: 'LATE', expiryDate: '2027-06-01', initialQty: 3, cost: 12000 }, manager);
    const sale = checkout({
      branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer: guest,
      items: [{ kind: 'product', itemId: product.id, name: product.name, price: 50000, qty: 4 }],
      method: 'Cash', cashTendered: 220000, // subtotal 200000 + 10% tax
    });
    expect(sale.batchCostAllocations?.map((a) => a.qty)).toEqual([2, 2]);
    const batches = readCollection<ProductBatch>(StorageKeys.productBatches);
    const early = batches.find((b) => b.batchNumber === 'EARLY')!;
    const late = batches.find((b) => b.batchNumber === 'LATE')!;
    expect(early.remainingQty).toBe(0);
    expect(late.remainingQty).toBe(1);

    refundTransaction(sale.id, 'Batal', manager);
    expect(getBatchById(early.id)?.remainingQty).toBe(2);
    expect(getBatchById(late.id)?.remainingQty).toBe(3);
  });

  it('5. restores quantity to a batch that has since expired, without making it salable again', () => {
    const batch = createProductBatch({ productId: product.id, branchId: branchA.id, batchNumber: 'EXP', expiryDate: '2099-01-01', initialQty: 5, cost: 10000 }, manager);
    const sale = checkout({
      branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer: guest,
      items: [{ kind: 'product', itemId: product.id, name: product.name, price: 50000, qty: 2 }],
      method: 'Cash', cashTendered: 110000, // subtotal 100000 + 10% tax
    });
    // Batch expires AFTER the sale but BEFORE the refund.
    const batches = readCollection<ProductBatch>(StorageKeys.productBatches);
    const target = batches.find((b) => b.id === batch.id)!;
    target.expiryDate = '2020-01-01';
    writeCollection(StorageKeys.productBatches, batches);

    refundTransaction(sale.id, 'Batal', manager);
    expect(getBatchById(batch.id)?.remainingQty).toBe(5);
    expect(getPhysicalStock(product.id, branchA.id)).toBe(5);
    expect(getSalableStock(product.id, branchA.id)).toBe(0); // physical restored, not salable — expired
  });

  it('6. Cash refund writes a reversal CashMove without deleting the original', () => {
    const sale = checkout({
      branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer: guest, barberId: barber.id,
      items: [{ kind: 'service', itemId: service.id, name: service.name, price: 100000, qty: 1 }],
      method: 'Cash', cashTendered: 110000,
    });
    refundTransaction(sale.id, 'Batal', manager);
    const moves = readCollection<CashMove>(StorageKeys.cashMoves);
    expect(moves).toHaveLength(2);
    expect(moves[0]).toMatchObject({ type: 'in', amount: 110000 });
    expect(moves[1]).toMatchObject({ type: 'out', amount: 110000, sourceType: 'transaction' });
  });

  it('7. reverses earned loyalty points via a ledger adjustment, not a raw balance edit', () => {
    const sale = checkout({
      branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer: memberCustomer, barberId: barber.id,
      items: [{ kind: 'service', itemId: service.id, name: service.name, price: 100000, qty: 1 }],
      method: 'Cash', cashTendered: 110000,
    });
    const customerAfterSale = readCollection<Customer>(StorageKeys.customers).find((c) => c.id === member.id)!;
    expect(customerAfterSale.points).toBe(10); // Rp100.000 / 10.000

    refundTransaction(sale.id, 'Batal', manager);
    const customerAfterRefund = readCollection<Customer>(StorageKeys.customers).find((c) => c.id === member.id)!;
    expect(customerAfterRefund.points).toBe(0);
    const ledger = readCollection<LoyaltyLedgerEntry>(StorageKeys.loyaltyLedger).filter((e) => e.reference === sale.id);
    expect(ledger).toHaveLength(2);
    expect(ledger[1]).toMatchObject({ type: 'adjustment', points: -10 });
  });

  it('8. reverses promo usage count without going negative', () => {
    const promo: Promotion = {
      id: 'promo_1', code: 'DISKON10', name: 'Diskon 10%', type: 'percentage', value: 10, maxDiscount: null,
      minSpend: 0, scope: 'holding', branchId: null, usageLimit: null, usedCount: 0, startDate: null, endDate: null,
      active: true, createdAt: '2026-01-01T00:00:00Z',
    };
    writeCollection(StorageKeys.promotions, [promo]);
    const sale = checkout({
      branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer: guest, barberId: barber.id,
      items: [{ kind: 'service', itemId: service.id, name: service.name, price: 100000, qty: 1 }],
      method: 'Cash', cashTendered: 110000, promoCode: 'DISKON10',
    });
    expect(sale.appliedPromo?.discountAmount).toBe(10000);
    expect(readCollection<Promotion>(StorageKeys.promotions).find((p) => p.id === promo.id)?.usedCount).toBe(1);

    refundTransaction(sale.id, 'Batal', manager);
    expect(readCollection<Promotion>(StorageKeys.promotions).find((p) => p.id === promo.id)?.usedCount).toBe(0);
  });

  it('9 & 10. excludes a refunded transaction from commission — payroll draft and barber analytics agree', () => {
    const sale = checkout({
      branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer: guest, barberId: barber.id,
      items: [{ kind: 'service', itemId: service.id, name: service.name, price: 100000, qty: 1 }],
      method: 'Cash', cashTendered: 110000,
    });
    expect(calculateEmployeePayrollDraft(barber.id, businessPeriod(), branchA.id).serviceCommission).toBe(25000);

    refundTransaction(sale.id, 'Batal', manager);

    const draft = calculateEmployeePayrollDraft(barber.id, businessPeriod(), branchA.id);
    expect(draft.serviceCommission).toBe(0);
    const analytics = getBarberProductivityMetrics(branchA.id, businessPeriod()).find((m) => m.barberId === barber.id);
    expect(analytics?.totalCommission ?? 0).toBe(0);
  });

  it('11. never rewrites an already-approved payroll record after a later refund', () => {
    checkout({
      branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer: guest, barberId: barber.id,
      items: [{ kind: 'service', itemId: service.id, name: service.name, price: 100000, qty: 1 }],
      method: 'Cash', cashTendered: 110000,
    });
    const draft = generateMonthlyPayroll(branchA.id, businessPeriod(), manager).find((r) => r.employeeId === barber.id)!;
    const approved = approvePayrollRecord(draft.id, manager);
    expect(approved.serviceCommission).toBe(25000);

    const sale2 = checkout({
      branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer: guest, barberId: barber.id,
      items: [{ kind: 'service', itemId: service.id, name: service.name, price: 100000, qty: 1 }],
      method: 'Cash', cashTendered: 110000,
    });
    refundTransaction(sale2.id, 'Batal', manager);

    const reread = readCollection<{ id: string }>(StorageKeys.payrollRecords).find((r) => r.id === approved.id);
    expect(reread).toEqual(approved);
  });

  it('12. rejects a second refund attempt on an already-refunded transaction (idempotent)', () => {
    const sale = checkout({
      branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer: guest, barberId: barber.id,
      items: [{ kind: 'service', itemId: service.id, name: service.name, price: 100000, qty: 1 }],
      method: 'Cash', cashTendered: 110000,
    });
    refundTransaction(sale.id, 'Batal pertama', manager);
    expect(() => refundTransaction(sale.id, 'Batal kedua', manager)).toThrow(/sudah pernah di-refund/);
    expect(readCollection<CashMove>(StorageKeys.cashMoves).filter((m) => m.type === 'out')).toHaveLength(1);
  });

  it('13. rejects refund by a Kasir, and by a BranchManager from a different branch', () => {
    const sale = checkout({
      branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer: guest, barberId: barber.id,
      items: [{ kind: 'service', itemId: service.id, name: service.name, price: 100000, qty: 1 }],
      method: 'Cash', cashTendered: 110000,
    });
    expect(() => refundTransaction(sale.id, 'Batal', cashier)).toThrow(/tidak memiliki wewenang/);
    expect(() => refundTransaction(sale.id, 'Batal', managerB)).toThrow(/Tidak punya akses/);
    expect(getTransactionById(sale.id)?.status).toBe('completed');
  });

  it('14. rolls back stock, cash, and status together when the loyalty reversal fails partway through', () => {
    const batch = createProductBatch({ productId: product.id, branchId: branchA.id, batchNumber: 'B1', expiryDate: '2027-01-01', initialQty: 5, cost: 10000 }, manager);
    const sale = checkout({
      branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer: memberCustomer, barberId: barber.id,
      items: [{ kind: 'product', itemId: product.id, name: product.name, price: 50000, qty: 2 }],
      method: 'Cash', cashTendered: 110000, // subtotal 100000 + 10% tax
    });
    // Customer already redeemed the earned points elsewhere before the refund is attempted —
    // reversing them would drive the balance negative, which recordLoyaltyLedgerEntry refuses.
    const earned = readCollection<Customer>(StorageKeys.customers).find((c) => c.id === member.id)!.points;
    recordLoyaltyLedgerEntry({ customerId: member.id, type: 'redeem', points: -earned, reference: 'redeem_1', actorId: member.id });
    expect(readCollection<Customer>(StorageKeys.customers).find((c) => c.id === member.id)?.points).toBe(0);

    expect(() => refundTransaction(sale.id, 'Batal', manager)).toThrow(/negatif/);

    // Nothing partial: stock/batch/cash/status must all still reflect the pre-refund state.
    expect(getBatchById(batch.id)?.remainingQty).toBe(3);
    expect(getPhysicalStock(product.id, branchA.id)).toBe(3);
    expect(readCollection<CashMove>(StorageKeys.cashMoves).filter((m) => m.type === 'out')).toHaveLength(0);
    expect(getTransactionById(sale.id)?.status).toBe('completed');
  });

  it('15. records a REFUND_TRANSACTION audit event alongside the original CHECKOUT event', () => {
    const sale = checkout({
      branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer: guest, barberId: barber.id,
      items: [{ kind: 'service', itemId: service.id, name: service.name, price: 100000, qty: 1 }],
      method: 'Cash', cashTendered: 110000,
    });
    refundTransaction(sale.id, 'Alasan refund', manager);
    const logs = readCollection<AuditLogRecord>(StorageKeys.auditLogs);
    expect(logs.some((l) => l.action === 'CHECKOUT' && l.entityId === sale.id)).toBe(true);
    const refundLog = logs.find((l) => l.action === 'REFUND_TRANSACTION' && l.entityId === sale.id);
    expect(refundLog).toBeDefined();
    expect(refundLog?.actorId).toBe(manager.id);
    expect(refundLog?.details).toContain('Alasan refund');
  });

  it('16. P&L and Cash Flow: same-period refund nets to zero; a later-period refund is a contra-entry in ITS OWN period, not a rewrite of the sale month', () => {
    createProductBatch({ productId: product.id, branchId: branchA.id, batchNumber: 'B1', expiryDate: '2027-01-01', initialQty: 5, cost: 10000 }, manager);
    const sale = checkout({
      branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer: guest,
      items: [{ kind: 'product', itemId: product.id, name: product.name, price: 50000, qty: 2 }],
      method: 'Cash', cashTendered: 110000, // subtotal 100000 + 10% tax
    });
    const period = businessPeriod();
    refundTransaction(sale.id, 'Batal', manager);

    const pnl = generateProfitAndLossReport(branchA.id, period);
    expect(pnl.totalRevenue).toBe(0); // productRevenue is price*qty (tax-exclusive), nets to 0
    expect(pnl.cogs).toBe(0);
    const flow = generateCashFlowReport(branchA.id, period);
    expect(flow.posCashInflow).toBe(110000); // tx.total, tax-inclusive
    expect(flow.refundOutflow).toBe(110000);
    expect(flow.netCashFlow).toBe(0);

    // Cross-period case: sale in an earlier month, refund recognized in a later month.
    const saleMonthTx: Transaction = {
      id: 'trx_cross', branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer: guest,
      items: [{ kind: 'service', itemId: service.id, name: service.name, price: 100000, qty: 1 }],
      subtotal: 100000, discount: 0, tax: 10000, total: 110000, method: 'Cash', cashTendered: 110000, change: 0,
      cogs: 0, businessDate: '2026-06-15', timestamp: '2026-06-15T04:00:00.000Z',
      status: 'refunded', refundedAt: '2026-07-02T04:00:00.000Z', refundedBy: manager.id, refundedByName: manager.name, refundReason: 'Cross-period test',
    };
    writeCollection(StorageKeys.transactions, [saleMonthTx]);

    const junePnl = generateProfitAndLossReport(branchA.id, '2026-06');
    expect(junePnl.totalRevenue).toBe(100000); // original sale month untouched
    const julyPnl = generateProfitAndLossReport(branchA.id, '2026-07');
    expect(julyPnl.totalRevenue).toBe(-100000); // contra-entry in the refund's own month
    const julyFlow = generateCashFlowReport(branchA.id, '2026-07');
    expect(julyFlow.refundOutflow).toBe(110000);
  });
});
