import { StorageKeys, readCollection, writeCollection, generateId, nowIso } from './storage';
import type { InventoryBalance, StockMove, StockMoveType } from './types';

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
 */
export function recordStockMove(input: RecordStockMoveInput): StockMove {
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
