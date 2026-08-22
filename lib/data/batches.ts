import { StorageKeys, readCollection, writeCollection, generateId, nowIso, todayDateString } from './storage';
import { canManageBranch } from './rbac';
import { recordStockMove } from './stock';
import type { ProductBatch, DeductedBatchInfo, ExpiryStatus, Employee } from './types';

export function getProductBatches(): ProductBatch[] {
  return readCollection<ProductBatch>(StorageKeys.productBatches);
}

export function getBatchById(id: string): ProductBatch | undefined {
  return getProductBatches().find((b) => b.id === id);
}

/**
 * Evaluates whether a batch is 'safe', 'near_expiry', or 'expired'.
 * - 'expired': expiryDate < today
 * - 'near_expiry': 0 <= days until expiry <= thresholdDays (default 30 days)
 * - 'safe': days until expiry > thresholdDays
 */
export function evaluateExpiryStatus(expiryDate: string, thresholdDays = 30): ExpiryStatus {
  if (!expiryDate) return 'safe';

  const today = todayDateString();
  if (expiryDate < today) {
    return 'expired';
  }

  const todayTime = new Date(today).getTime();
  const expiryTime = new Date(expiryDate).getTime();
  const diffDays = Math.ceil((expiryTime - todayTime) / (1000 * 60 * 60 * 24));

  if (diffDays <= thresholdDays) {
    return 'near_expiry';
  }
  return 'safe';
}

/**
 * Returns batches for a specific product and branch, sorted by expiryDate ASC (FEFO).
 */
export function getBatchesByProductAndBranch(
  productId: string,
  branchId: string,
  includeEmpty = false,
): ProductBatch[] {
  return getProductBatches()
    .filter(
      (b) =>
        b.productId === productId &&
        b.branchId === branchId &&
        (includeEmpty || b.remainingQty > 0),
    )
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

export function getNearExpiryBatches(branchId?: string, thresholdDays = 30): ProductBatch[] {
  return getProductBatches()
    .filter((b) => {
      if (branchId && b.branchId !== branchId) return false;
      if (b.remainingQty <= 0) return false;
      return evaluateExpiryStatus(b.expiryDate, thresholdDays) === 'near_expiry';
    })
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

export function getExpiredBatches(branchId?: string): ProductBatch[] {
  return getProductBatches()
    .filter((b) => {
      if (branchId && b.branchId !== branchId) return false;
      if (b.remainingQty <= 0) return false;
      return evaluateExpiryStatus(b.expiryDate) === 'expired';
    })
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

export interface CreateProductBatchInput {
  productId: string;
  branchId: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  initialQty: number;
  cost: number;
  receivedDate?: string;
  notes?: string;
}

export function createProductBatch(
  input: CreateProductBatchInput,
  actingEmployee?: Employee,
): ProductBatch {
  if (actingEmployee && !canManageBranch(actingEmployee, input.branchId)) {
    throw new Error('Tidak punya akses ke cabang ini.');
  }

  const batchNumber = input.batchNumber.trim();
  if (!batchNumber) {
    throw new Error('Nomor batch wajib diisi.');
  }
  if (input.initialQty <= 0) {
    throw new Error('Jumlah stok batch harus lebih dari 0.');
  }
  if (!input.expiryDate) {
    throw new Error('Tanggal kadaluarsa (expiry date) wajib diisi.');
  }

  const batches = getProductBatches();
  const batch: ProductBatch = {
    id: generateId('bat'),
    productId: input.productId,
    branchId: input.branchId,
    batchNumber,
    expiryDate: input.expiryDate,
    initialQty: input.initialQty,
    remainingQty: input.initialQty,
    receivedDate: input.receivedDate ?? todayDateString(),
    cost: input.cost,
    notes: input.notes ?? '',
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  batches.push(batch);
  writeCollection(StorageKeys.productBatches, batches);

  // Sync inventory balance and stock moves ledger
  recordStockMove({
    productId: input.productId,
    branchId: input.branchId,
    type: 'in',
    qty: input.initialQty,
    reference: batch.batchNumber,
    note: `Penerimaan batch ${batch.batchNumber} (Exp: ${batch.expiryDate})`,
    actorId: actingEmployee ? actingEmployee.id : 'system',
  });

  return batch;
}

export interface UpdateProductBatchInput {
  batchNumber?: string;
  expiryDate?: string;
  notes?: string;
}

export function updateProductBatch(
  id: string,
  patch: UpdateProductBatchInput,
  actingEmployee?: Employee,
): ProductBatch {
  const batches = getProductBatches();
  const batch = batches.find((b) => b.id === id);
  if (!batch) {
    throw new Error('Batch tidak ditemukan.');
  }

  if (actingEmployee && !canManageBranch(actingEmployee, batch.branchId)) {
    throw new Error('Tidak punya akses ke cabang ini.');
  }

  if (patch.batchNumber !== undefined) {
    const num = patch.batchNumber.trim();
    if (!num) throw new Error('Nomor batch tidak boleh kosong.');
    batch.batchNumber = num;
  }
  if (patch.expiryDate !== undefined) {
    if (!patch.expiryDate) throw new Error('Tanggal kadaluarsa tidak boleh kosong.');
    batch.expiryDate = patch.expiryDate;
  }
  if (patch.notes !== undefined) {
    batch.notes = patch.notes;
  }

  batch.updatedAt = nowIso();
  writeCollection(StorageKeys.productBatches, batches);
  return batch;
}

export function deleteProductBatch(id: string, actingEmployee?: Employee): void {
  const batches = getProductBatches();
  const batch = batches.find((b) => b.id === id);
  if (!batch) {
    throw new Error('Batch tidak ditemukan.');
  }

  if (actingEmployee && !canManageBranch(actingEmployee, batch.branchId)) {
    throw new Error('Tidak punya akses ke cabang ini.');
  }

  const filtered = batches.filter((b) => b.id !== id);
  writeCollection(StorageKeys.productBatches, filtered);
}

/**
 * FEFO (First-Expired, First-Out) stock deduction algorithm:
 * Deducts stock from the earliest expiring active non-expired batch first.
 */
export function deductStockFEFO(
  productId: string,
  branchId: string,
  qtyRequested: number,
): { deductedBatches: DeductedBatchInfo[]; totalDeducted: number } {
  if (qtyRequested <= 0) {
    return { deductedBatches: [], totalDeducted: 0 };
  }

  const allBatches = getProductBatches();
  const productBatches = allBatches.filter(
    (b) => b.productId === productId && b.branchId === branchId,
  );

  // If no batches exist at all for this product in this branch (unbatched legacy/demo items),
  // allow checkout to proceed with basic stock deduction
  if (productBatches.length === 0) {
    return { deductedBatches: [], totalDeducted: qtyRequested };
  }

  // Filter for active, non-expired batches
  const activeBatches = productBatches
    .filter((b) => b.remainingQty > 0 && evaluateExpiryStatus(b.expiryDate) !== 'expired')
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  const totalAvailable = activeBatches.reduce((sum, b) => sum + b.remainingQty, 0);
  if (totalAvailable < qtyRequested) {
    throw new Error(
      'Stok batch produk tidak mencukupi atau batch yang tersedia telah kadaluarsa.',
    );
  }

  let remainingNeeded = qtyRequested;
  const deductedBatches: DeductedBatchInfo[] = [];

  for (const batch of activeBatches) {
    if (remainingNeeded <= 0) break;

    const toDeduct = Math.min(batch.remainingQty, remainingNeeded);
    batch.remainingQty -= toDeduct;
    batch.updatedAt = nowIso();
    remainingNeeded -= toDeduct;

    deductedBatches.push({
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      qty: toDeduct,
      expiryDate: batch.expiryDate,
    });
  }

  writeCollection(StorageKeys.productBatches, allBatches);
  return { deductedBatches, totalDeducted: qtyRequested };
}

export function restoreBatchDeductions(deductions: DeductedBatchInfo[]): void {
  if (!deductions || deductions.length === 0) return;

  const allBatches = getProductBatches();
  for (const deduction of deductions) {
    const batch = allBatches.find((b) => b.id === deduction.batchId);
    if (batch) {
      batch.remainingQty += deduction.qty;
      batch.updatedAt = nowIso();
    }
  }
  writeCollection(StorageKeys.productBatches, allBatches);
}
