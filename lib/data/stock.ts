import { StorageKeys, readCollection, writeCollection, generateId, nowIso } from './storage';
import { canManageBranch } from './rbac';
import type { Employee, InventoryBalance, StockMove, StockMoveType } from './types';

export interface RecordStockMoveInput {
  productId: string;
  branchId: string;
  type: StockMoveType;
  /** Always positive — direction comes from `type`, not the sign of qty. */
  qty: number;
  reference: string;
  note?: string;
  actorId: string;
}

/**
 * The one and only place inventory gets mutated. It appends to the
 * stock_moves ledger first, then re-derives the cached InventoryBalance
 * from that ledger — the balance is never written directly anywhere else,
 * per the "Available Stock = one reusable function" architecture rule.
 *
 * Snapshots stockMoves and inventoryBalances up front and restores both if
 * either write fails partway through, so a failed call never leaves the
 * ledger and the cached balance disagreeing with each other. This mirrors
 * checkout()'s rollback pattern at this lower level — callers that touch
 * multiple collections around a stock move (checkout()) keep their own
 * outer rollback too; the two layers are intentionally independent, not
 * deduplicated.
 */
export function recordStockMove(input: RecordStockMoveInput): StockMove {
  const movesSnapshot = structuredClone(readCollection<StockMove>(StorageKeys.stockMoves));
  const balancesSnapshot = structuredClone(readCollection<InventoryBalance>(StorageKeys.inventoryBalances));

  try {
    const moves = readCollection<StockMove>(StorageKeys.stockMoves);
    const move: StockMove = {
      id: generateId('mov'),
      productId: input.productId,
      branchId: input.branchId,
      type: input.type,
      qty: input.qty,
      reference: input.reference,
      note: input.note ?? '',
      actorId: input.actorId,
      timestamp: nowIso(),
    };
    moves.push(move);
    writeCollection(StorageKeys.stockMoves, moves);

    const balances = readCollection<InventoryBalance>(StorageKeys.inventoryBalances);
    let balance = balances.find((b) => b.productId === input.productId && b.branchId === input.branchId);
    if (!balance) {
      balance = { productId: input.productId, branchId: input.branchId, qty: 0 };
      balances.push(balance);
    }
    if (input.type === 'in') balance.qty += input.qty;
    else if (input.type === 'out' || input.type === 'sale') balance.qty -= input.qty;
    else if (input.type === 'opname_set') balance.qty = input.qty;
    if (balance.qty < 0) balance.qty = 0;

    writeCollection(StorageKeys.inventoryBalances, balances);
    return move;
  } catch (err) {
    writeCollection(StorageKeys.stockMoves, movesSnapshot);
    writeCollection(StorageKeys.inventoryBalances, balancesSnapshot);
    throw err;
  }
}

export interface AddManualStockInput {
  productId: string;
  branchId: string;
  qty: number;
  actingEmployee: Employee;
}

/**
 * The POV Manajemen "Kelola Stok" entry point — a thin, RBAC-checked
 * wrapper around recordStockMove(). recordStockMove() itself stays
 * role-agnostic on purpose: it's also called from checkout() and the
 * Kasir-side /inventory opname, which have entirely different
 * authorization models and shouldn't have to construct an Employee to
 * satisfy this one caller's rules.
 */
export function addManualStock(input: AddManualStockInput): StockMove {
  if (input.qty <= 0) {
    throw new Error('Jumlah harus lebih dari 0.');
  }
  if (!canManageBranch(input.actingEmployee, input.branchId)) {
    throw new Error('Tidak punya akses ke cabang ini.');
  }
  return recordStockMove({
    productId: input.productId,
    branchId: input.branchId,
    type: 'in',
    qty: input.qty,
    reference: 'MANUAL',
    note: `Penambahan stok manual oleh ${input.actingEmployee.name}`,
    actorId: input.actingEmployee.id,
  });
}

export function getAvailableStock(productId: string, branchId: string): number {
  const balances = readCollection<InventoryBalance>(StorageKeys.inventoryBalances);
  return balances.find((b) => b.productId === productId && b.branchId === branchId)?.qty ?? 0;
}

export type StockStatus = 'cukup' | 'rendah' | 'habis';

export function getStockStatus(qty: number, lowStockThreshold: number): StockStatus {
  if (qty <= 0) return 'habis';
  if (qty <= lowStockThreshold) return 'rendah';
  return 'cukup';
}
