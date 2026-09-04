import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as storage from './storage';
import {
  StorageKeys,
  businessDateString,
  businessPeriod,
  calculateEmployeePayrollDraft,
  checkout,
  createAppointment,
  createEmployeeAdvance,
  createProductBatch,
  createStockTransfer,
  dispatchStockTransfer,
  generateCashFlowReport,
  generateProfitAndLossReport,
  getActualTransactionBarberId,
  getBarberProductivityMetrics,
  getPhysicalStock,
  getSalableStock,
  getTransactionById,
  getAppointments,
  getPayrollRecords,
  getPayrollRecordById,
  generateMonthlyPayroll,
  approveEmployeeAdvance,
  approvePayrollRecord,
  markPayrollPaid,
  markAppointmentPaid,
  updateAppointmentStatus,
  writeCollection,
  readCollection,
} from './index';
import type {
  AuditLogRecord,
  Branch,
  CashMove,
  Employee,
  EmployeeAdvance,
  Product,
  ProductBatch,
  Service,
  StockTransfer,
  TransactionCustomer,
} from './types';

const branchA: Branch = { id: 'br_a', name: 'Branch A', city: 'Cirebon', province: 'Jawa Barat', address: 'A', phone: '1' };
const branchB: Branch = { id: 'br_b', name: 'Branch B', city: 'Cirebon', province: 'Jawa Barat', address: 'B', phone: '2' };
const cashier: Employee = { id: 'cashier_a', name: 'Kasir A', role: 'Kasir', branchId: branchA.id, pin: '1111' };
const barber: Employee = { id: 'barber_a', name: 'Barber A', role: 'Barber', branchId: branchA.id, pin: '2222' };
const manager: Employee = { id: 'manager_a', name: 'Manager A', role: 'BranchManager', branchId: branchA.id, pin: '3333' };
const service: Service = { id: 'svc_haircut', name: 'Haircut', category: 'Service', durationMinutes: 30, price: 100000, commissionPercent: 25 };
const product: Product = { id: 'prd_pomade', sku: 'POM-1', name: 'Pomade', category: 'Retail', brand: 'RB', cost: 10000, price: 50000, lowStockThreshold: 1 };
const productTwo: Product = { id: 'prd_shampoo', sku: 'SHP-1', name: 'Shampoo', category: 'Retail', brand: 'RB', cost: 9000, price: 30000, lowStockThreshold: 1 };
const customer: TransactionCustomer = { type: 'guest', customerId: null, name: 'Guest', phone: '081', tier: null };

beforeEach(() => {
  window.localStorage.clear();
  writeCollection(StorageKeys.branches, [branchA, branchB]);
  writeCollection(StorageKeys.employees, [cashier, barber, manager]);
  writeCollection(StorageKeys.services, [service]);
  writeCollection(StorageKeys.products, [product, productTwo]);
  writeCollection(StorageKeys.transactions, []);
  writeCollection(StorageKeys.appointments, []);
  writeCollection(StorageKeys.attendance, []);
  writeCollection(StorageKeys.employeeAdvances, []);
  writeCollection(StorageKeys.payrollRecords, []);
  writeCollection(StorageKeys.cashMoves, []);
  writeCollection(StorageKeys.auditLogs, []);
});

describe('Fase 2 core integration correctness', () => {
  it('uses Asia/Jakarta for business date and period boundaries', () => {
    expect(businessDateString('2026-09-03T18:00:00.000Z')).toBe('2026-09-04');
    expect(businessPeriod('2026-08-31T18:00:00.000Z')).toBe('2026-09');
  });

  it('keeps physical stock separate from salable stock and rejects a sale above salable before payment', () => {
    createProductBatch({ productId: product.id, branchId: branchA.id, batchNumber: 'EXP', expiryDate: '2026-01-01', initialQty: 5, cost: 10000 }, manager);
    createProductBatch({ productId: product.id, branchId: branchA.id, batchNumber: 'ACTIVE', expiryDate: '2027-01-01', initialQty: 3, cost: 12000 }, manager);
    expect(getPhysicalStock(product.id, branchA.id)).toBe(8);
    expect(getSalableStock(product.id, branchA.id)).toBe(3);
    expect(() => checkout({ branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer, items: [{ kind: 'product', itemId: product.id, name: product.name, price: 50000, qty: 4 }], method: 'QRIS', cashTendered: 0 })).toThrow(/tersisa 3/);
    expect(readCollection(StorageKeys.transactions)).toHaveLength(0);
  });

  it('links completed appointment, POS transaction, and barber snapshot atomically', () => {
    const appointment = createAppointment({ branchId: branchA.id, customer, barberId: barber.id, type: 'regular', serviceId: service.id, date: '2026-08-10', startTime: '10:00' });
    updateAppointmentStatus(appointment.id, 'checked_in');
    updateAppointmentStatus(appointment.id, 'in_service');
    updateAppointmentStatus(appointment.id, 'completed');
    const sale = checkout({ branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer, items: [{ kind: 'service', itemId: service.id, name: service.name, price: service.price, qty: 1 }], method: 'Cash', cashTendered: 110000, barberId: barber.id, appointmentId: appointment.id, idempotencyKey: 'appointment-pay-1' });
    expect(sale.appointmentId).toBe(appointment.id);
    expect(sale.barberId).toBe(barber.id);
    expect(sale.items[0].commissionPercent).toBe(25);
    expect(getAppointments()[0]).toMatchObject({ status: 'paid', transactionId: sale.id });
    expect(readCollection<AuditLogRecord>(StorageKeys.auditLogs).some((entry) => entry.action === 'CHECKOUT' && entry.entityId === sale.id)).toBe(true);
    expect(() => checkout({ branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer, items: [{ kind: 'service', itemId: service.id, name: service.name, price: service.price, qty: 1 }], method: 'Cash', cashTendered: 110000, barberId: barber.id, appointmentId: appointment.id })).toThrow(/sudah memiliki pembayaran/);
  });

  it('rejects invalid/cross-branch appointment references and rolls checkout back when appointment persistence fails', () => {
    const appointment = createAppointment({ branchId: branchA.id, customer, barberId: barber.id, type: 'regular', serviceId: service.id, date: '2026-08-10', startTime: '10:00' });
    updateAppointmentStatus(appointment.id, 'completed');
    const foreignTx = { id: 'foreign', branchId: branchB.id, cashierId: cashier.id, cashierName: cashier.name, barberId: barber.id, appointmentId: appointment.id, customer, items: [], subtotal: 0, discount: 0, tax: 0, total: 0, method: 'Cash' as const, cashTendered: 0, change: 0, timestamp: '2026-08-10T00:00:00Z' };
    writeCollection(StorageKeys.transactions, [foreignTx]);
    expect(() => markAppointmentPaid(appointment.id, 'foreign')).toThrow(/Cabang transaksi/);

    const realWrite = storage.writeCollection;
    let failOnce = true;
    const spy = vi.spyOn(storage, 'writeCollection').mockImplementation((key: string, value: unknown[]) => {
      if (key === StorageKeys.appointments && failOnce) { failOnce = false; throw new Error('appointment write failed'); }
      realWrite(key, value);
    });
    try {
      expect(() => checkout({ branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer, barberId: barber.id, appointmentId: appointment.id, items: [{ kind: 'service', itemId: service.id, name: service.name, price: service.price, qty: 1 }], method: 'QRIS', cashTendered: 0 })).toThrow('appointment write failed');
      expect(readCollection(StorageKeys.transactions)).toEqual([foreignTx]);
      expect(getAppointments()[0]).toMatchObject({ status: 'completed', transactionId: null });
    } finally { spy.mockRestore(); }
  });

  it('returns one transaction for the same idempotency key instead of creating a duplicate sale', () => {
    createProductBatch({ productId: product.id, branchId: branchA.id, batchNumber: 'IDEMP', expiryDate: '2027-01-01', initialQty: 2, cost: 10000 }, manager);
    const input = { branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer, items: [{ kind: 'product' as const, itemId: product.id, name: product.name, price: product.price, qty: 1 }], method: 'QRIS' as const, cashTendered: 0, idempotencyKey: 'same-attempt' };
    const first = checkout(input);
    const second = checkout(input);
    expect(second.id).toBe(first.id);
    expect(readCollection(StorageKeys.transactions)).toHaveLength(1);
  });

  it('uses one commission engine for analytics and payroll, without CRM preferred-barber fallback', () => {
    createProductBatch({ productId: product.id, branchId: branchA.id, batchNumber: 'COMM', expiryDate: '2027-01-01', initialQty: 1, cost: 10000 }, manager);
    const sale = checkout({ branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer, barberId: barber.id, items: [
      { kind: 'service', itemId: service.id, name: service.name, price: 100000, qty: 2 },
      { kind: 'product', itemId: product.id, name: product.name, price: 50000, qty: 1 },
    ], method: 'QRIS', cashTendered: 0 });
    const payroll = calculateEmployeePayrollDraft(barber.id, businessPeriod(), branchA.id);
    const analytics = getBarberProductivityMetrics(branchA.id, businessPeriod()).find((metric) => metric.barberId === barber.id)!;
    expect(payroll.serviceCommission).toBe(50000);
    expect(payroll.productCommission).toBe(2500);
    expect(analytics.totalCommission).toBe(52500);
    expect(getActualTransactionBarberId(getTransactionById(sale.id)!)).toBe(barber.id);
  });

  it('captures FEFO batch COGS and keeps P&L historical after master-cost change', () => {
    createProductBatch({ productId: product.id, branchId: branchA.id, batchNumber: 'A', expiryDate: '2027-01-01', initialQty: 3, cost: 20000 }, manager);
    createProductBatch({ productId: product.id, branchId: branchA.id, batchNumber: 'B', expiryDate: '2027-02-01', initialQty: 2, cost: 25000 }, manager);
    const sale = checkout({ branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer, items: [{ kind: 'product', itemId: product.id, name: product.name, price: 50000, qty: 5 }], method: 'QRIS', cashTendered: 0 });
    expect(sale.cogs).toBe(110000);
    expect(sale.batchCostAllocations?.map((allocation) => allocation.qty)).toEqual([3, 2]);
    writeCollection(StorageKeys.products, [{ ...product, cost: 999999 }, productTwo]);
    expect(generateProfitAndLossReport(branchA.id, businessPeriod()).cogs).toBe(110000);
  });

  it('does not double count cash checkout and keeps later-approved advance out of paid payroll', () => {
    const advanceA = createEmployeeAdvance({ employeeId: barber.id, amount: 100000, reason: 'A', requestDate: '2026-08-01' }, barber);
    approveEmployeeAdvance(advanceA.id, manager);
    const payroll = generateMonthlyPayroll(branchA.id, businessPeriod(), manager).find((record) => record.employeeId === barber.id)!;
    const advanceB = createEmployeeAdvance({ employeeId: barber.id, amount: 50000, reason: 'B', requestDate: '2026-08-02' }, barber);
    approveEmployeeAdvance(advanceB.id, manager);
    const approved = approvePayrollRecord(payroll.id, manager);
    markPayrollPaid(approved.id, manager);
    expect(readCollection<EmployeeAdvance>(StorageKeys.employeeAdvances).find((advance) => advance.id === advanceA.id)?.status).toBe('deducted');
    expect(readCollection<EmployeeAdvance>(StorageKeys.employeeAdvances).find((advance) => advance.id === advanceB.id)?.status).toBe('approved');

    createProductBatch({ productId: productTwo.id, branchId: branchA.id, batchNumber: 'CASH', expiryDate: '2027-01-01', initialQty: 1, cost: 9000 }, manager);
    checkout({ branchId: branchA.id, cashierId: cashier.id, cashierName: cashier.name, customer, items: [{ kind: 'product', itemId: productTwo.id, name: productTwo.name, price: 30000, qty: 1 }], method: 'Cash', cashTendered: 50000 });
    writeCollection(StorageKeys.cashMoves, [...readCollection<CashMove>(StorageKeys.cashMoves), { id: 'manual-in', branchId: branchA.id, type: 'in', amount: 5000, note: 'Modal kasir', actorId: manager.id, sourceType: 'manual', timestamp: new Date().toISOString() }]);
    const flow = generateCashFlowReport(branchA.id, businessPeriod());
    expect(flow.posCashInflow).toBe(33000);
    expect(flow.manualCashIn).toBe(5000);
    expect(flow.totalInflow).toBe(38000);
    expect(generateProfitAndLossReport(branchA.id, businessPeriod()).payrollExpenses).toBe(approved.grossPay);
  });

  it('rolls back dispatch when a later transfer item cannot be allocated', () => {
    createProductBatch({ productId: product.id, branchId: branchA.id, batchNumber: 'P1', expiryDate: '2027-01-01', initialQty: 2, cost: 10000 }, manager);
    createProductBatch({ productId: productTwo.id, branchId: branchA.id, batchNumber: 'P2', expiryDate: '2027-01-01', initialQty: 2, cost: 9000 }, manager);
    const transfer = createStockTransfer({ sourceBranchId: branchA.id, targetBranchId: branchB.id, items: [{ productId: product.id, qty: 1 }, { productId: productTwo.id, qty: 1 }] }, manager);
    const batches = readCollection<ProductBatch>(StorageKeys.productBatches);
    const expiredBatch = batches.find((batch) => batch.productId === productTwo.id);
    if (expiredBatch) expiredBatch.expiryDate = '2026-01-01';
    writeCollection(StorageKeys.productBatches, batches);
    expect(() => dispatchStockTransfer(transfer.id, manager)).toThrow();
    expect(getPhysicalStock(product.id, branchA.id)).toBe(2);
    expect(readCollection<StockTransfer>(StorageKeys.stockTransfers).find((item) => item.id === transfer.id)?.status).toBe('draft');
  });

  it('keeps an approved payroll record frozen after the employee role/branch and service master commission change later', () => {
    checkout({
      branchId: branchA.id,
      cashierId: cashier.id,
      cashierName: cashier.name,
      customer,
      barberId: barber.id,
      items: [{ kind: 'service', itemId: service.id, name: service.name, price: service.price, qty: 1 }],
      method: 'Cash',
      cashTendered: 200000,
    });

    const draft = generateMonthlyPayroll(branchA.id, businessPeriod(), manager).find((record) => record.employeeId === barber.id)!;
    const approved = approvePayrollRecord(draft.id, manager);
    expect(approved.serviceCommission).toBe(25000); // 100000 * 25% snapshot rate
    const snapshot = { ...approved };

    // Master data edited AFTER approval must never leak into the frozen record.
    writeCollection(StorageKeys.employees, [
      cashier,
      { ...barber, role: 'BranchManager', branchId: branchB.id },
      manager,
    ]);
    writeCollection(StorageKeys.services, [{ ...service, commissionPercent: 90 }]);

    const reread = getPayrollRecordById(approved.id);
    expect(reread).toEqual(snapshot);
    expect(reread?.employeeRole).toBe('Barber');
    expect(reread?.branchId).toBe(branchA.id);
    expect(reread?.branchName).toBe(branchA.name);
    expect(reread?.serviceCommission).toBe(25000);
    expect(reread?.grossPay).toBe(snapshot.grossPay);
    expect(reread?.takeHomePay).toBe(snapshot.takeHomePay);
    expect(getPayrollRecords(branchA.id, businessPeriod(), 'approved', barber.id)).toHaveLength(1);
  });
});
