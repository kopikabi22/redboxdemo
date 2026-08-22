import { StorageKeys, readCollection, writeCollection, generateId, nowIso, todayDateString } from './storage';
import { canManageBranch } from './rbac';
import { getProductById } from './catalog';
import { getBranchById } from './branches';
import { getAvailableStock, recordStockMove } from './stock';
import { deductStockFEFO, restoreBatchDeductions, createProductBatch } from './batches';
import type {
  StockOpname,
  StockOpnameItem,
  StockOpnameStatus,
  StockTransfer,
  StockTransferItem,
  StockTransferStatus,
  Employee,
} from './types';

// ==========================================
// STOCK OPNAME MODULE
// ==========================================

export function getStockOpnames(
  branchId?: string,
  status?: StockOpnameStatus,
): StockOpname[] {
  const opnames = readCollection<StockOpname>(StorageKeys.stockOpnames);
  return opnames
    .filter((op) => {
      if (branchId && op.branchId !== branchId) return false;
      if (status && op.status !== status) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getStockOpnameById(id: string): StockOpname | undefined {
  return getStockOpnames().find((op) => op.id === id);
}

export interface CreateStockOpnameItemInput {
  productId: string;
  physicalQty: number;
  notes?: string;
}

export interface CreateStockOpnameInput {
  branchId: string;
  items: CreateStockOpnameItemInput[];
  notes?: string;
}

export function createStockOpname(
  input: CreateStockOpnameInput,
  actor: Employee,
): StockOpname {
  if (actor.role === 'Kasir' || actor.role === 'Barber') {
    throw new Error('Akses ditolak: role tidak memiliki wewenang membuat sesi Stock Opname.');
  }

  const branch = getBranchById(input.branchId);
  if (!branch) throw new Error('Cabang tidak ditemukan.');

  if (!canManageBranch(actor, input.branchId)) {
    throw new Error('Tidak punya akses ke cabang ini.');
  }

  if (!input.items || input.items.length === 0) {
    throw new Error('Daftar item Stock Opname tidak boleh kosong.');
  }

  const opnameItems: StockOpnameItem[] = [];
  let totalVarianceItems = 0;
  let totalVarianceQty = 0;

  for (const itemInput of input.items) {
    const product = getProductById(itemInput.productId);
    if (!product) {
      throw new Error(`Produk dengan ID ${itemInput.productId} tidak ditemukan.`);
    }
    if (itemInput.physicalQty < 0) {
      throw new Error(`Kuantitas fisik untuk ${product.name} tidak boleh negatif.`);
    }

    const systemQty = getAvailableStock(product.id, input.branchId);
    const variance = itemInput.physicalQty - systemQty;

    if (variance !== 0) {
      totalVarianceItems += 1;
      totalVarianceQty += variance;
    }

    opnameItems.push({
      id: generateId('opi'),
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      systemQty,
      physicalQty: itemInput.physicalQty,
      variance,
      notes: itemInput.notes?.trim() || undefined,
    });
  }

  const opnames = readCollection<StockOpname>(StorageKeys.stockOpnames);
  const opnameNumber = `OPN-${Date.now().toString().slice(-8)}`;

  const opname: StockOpname = {
    id: generateId('opn'),
    opnameNumber,
    branchId: branch.id,
    branchName: branch.name,
    opnameDate: todayDateString(),
    status: 'draft',
    items: opnameItems,
    totalVarianceItems,
    totalVarianceQty,
    notes: input.notes?.trim() || undefined,
    conductedBy: actor.id,
    conductedByName: actor.name,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  opnames.push(opname);
  writeCollection(StorageKeys.stockOpnames, opnames);
  return opname;
}

export function completeStockOpname(id: string, actor: Employee): StockOpname {
  const opnames = readCollection<StockOpname>(StorageKeys.stockOpnames);
  const opname = opnames.find((o) => o.id === id);
  if (!opname) throw new Error('Stock Opname tidak ditemukan.');

  if (!canManageBranch(actor, opname.branchId)) {
    throw new Error('Tidak punya akses ke cabang ini.');
  }

  if (opname.status !== 'draft') {
    throw new Error(`Stock Opname tidak dapat diselesaikan karena berstatus ${opname.status}.`);
  }

  // Adjust inventory balances and append stock moves
  for (const item of opname.items) {
    recordStockMove({
      productId: item.productId,
      branchId: opname.branchId,
      type: 'opname_set',
      qty: item.physicalQty,
      reference: opname.opnameNumber,
      note: item.notes || `Penyesuaian hasil Stock Opname (${opname.opnameNumber})`,
      actorId: actor.id,
    });
  }

  opname.status = 'completed';
  opname.completedAt = nowIso();
  opname.updatedAt = nowIso();

  writeCollection(StorageKeys.stockOpnames, opnames);
  return opname;
}

export function cancelStockOpname(id: string, reason: string, actor: Employee): StockOpname {
  const opnames = readCollection<StockOpname>(StorageKeys.stockOpnames);
  const opname = opnames.find((o) => o.id === id);
  if (!opname) throw new Error('Stock Opname tidak ditemukan.');

  if (!canManageBranch(actor, opname.branchId)) {
    throw new Error('Tidak punya akses ke cabang ini.');
  }

  if (opname.status === 'completed') {
    throw new Error('Stock Opname yang sudah completed tidak dapat dibatalkan.');
  }

  const cleanReason = reason.trim();
  if (!cleanReason) throw new Error('Alasan pembatalan Stock Opname wajib diisi.');

  opname.status = 'cancelled';
  opname.cancellationReason = cleanReason;
  opname.updatedAt = nowIso();

  writeCollection(StorageKeys.stockOpnames, opnames);
  return opname;
}

// ==========================================
// INTER-BRANCH STOCK TRANSFER MODULE
// ==========================================

export function getStockTransfers(
  branchId?: string,
  status?: StockTransferStatus,
): StockTransfer[] {
  const transfers = readCollection<StockTransfer>(StorageKeys.stockTransfers);
  return transfers
    .filter((tr) => {
      if (branchId && tr.sourceBranchId !== branchId && tr.targetBranchId !== branchId) {
        return false;
      }
      if (status && tr.status !== status) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getStockTransferById(id: string): StockTransfer | undefined {
  return getStockTransfers().find((tr) => tr.id === id);
}

export interface CreateStockTransferItemInput {
  productId: string;
  qty: number;
}

export interface CreateStockTransferInput {
  sourceBranchId: string;
  targetBranchId: string;
  items: CreateStockTransferItemInput[];
  notes?: string;
}

export function createStockTransfer(
  input: CreateStockTransferInput,
  actor: Employee,
): StockTransfer {
  if (actor.role === 'Kasir' || actor.role === 'Barber') {
    throw new Error('Akses ditolak: role tidak memiliki wewenang membuat Stock Transfer.');
  }

  if (input.sourceBranchId === input.targetBranchId) {
    throw new Error('Cabang asal dan cabang tujuan tidak boleh sama.');
  }

  const sourceBranch = getBranchById(input.sourceBranchId);
  if (!sourceBranch) throw new Error('Cabang asal tidak ditemukan.');

  const targetBranch = getBranchById(input.targetBranchId);
  if (!targetBranch) throw new Error('Cabang tujuan tidak ditemukan.');

  if (!canManageBranch(actor, input.sourceBranchId)) {
    throw new Error('Tidak punya akses ke cabang asal.');
  }

  if (!input.items || input.items.length === 0) {
    throw new Error('Daftar item transfer tidak boleh kosong.');
  }

  const transferItems: StockTransferItem[] = [];
  let totalQty = 0;
  let totalValue = 0;

  for (const itemInput of input.items) {
    const product = getProductById(itemInput.productId);
    if (!product) {
      throw new Error(`Produk dengan ID ${itemInput.productId} tidak ditemukan.`);
    }
    if (itemInput.qty <= 0) {
      throw new Error(`Kuantitas transfer untuk ${product.name} harus lebih dari 0.`);
    }

    const availableStock = getAvailableStock(product.id, input.sourceBranchId);
    if (availableStock < itemInput.qty) {
      throw new Error(
        `Stok ${product.name} tidak mencukupi di ${sourceBranch.name} (Tersedia: ${availableStock}, Diminta: ${itemInput.qty}).`,
      );
    }

    const itemValue = itemInput.qty * product.cost;
    totalQty += itemInput.qty;
    totalValue += itemValue;

    transferItems.push({
      id: generateId('tri'),
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      qty: itemInput.qty,
      unitCost: product.cost,
    });
  }

  const transfers = readCollection<StockTransfer>(StorageKeys.stockTransfers);
  const transferNumber = `TRF-${Date.now().toString().slice(-8)}`;

  const transfer: StockTransfer = {
    id: generateId('trf'),
    transferNumber,
    sourceBranchId: sourceBranch.id,
    sourceBranchName: sourceBranch.name,
    targetBranchId: targetBranch.id,
    targetBranchName: targetBranch.name,
    status: 'draft',
    items: transferItems,
    totalQty,
    totalValue,
    notes: input.notes?.trim() || undefined,
    createdBy: actor.id,
    createdByName: actor.name,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  transfers.push(transfer);
  writeCollection(StorageKeys.stockTransfers, transfers);
  return transfer;
}

export function dispatchStockTransfer(id: string, actor: Employee): StockTransfer {
  const transfers = readCollection<StockTransfer>(StorageKeys.stockTransfers);
  const transfer = transfers.find((t) => t.id === id);
  if (!transfer) throw new Error('Stock Transfer tidak ditemukan.');

  if (!canManageBranch(actor, transfer.sourceBranchId)) {
    throw new Error('Tidak punya akses ke cabang asal.');
  }

  if (transfer.status !== 'draft') {
    throw new Error(`Transfer tidak dapat dikirim karena berstatus ${transfer.status}.`);
  }

  // Deduct stock from source branch using FEFO
  for (const item of transfer.items) {
    const fefoResult = deductStockFEFO(item.productId, transfer.sourceBranchId, item.qty);
    item.deductedBatches = fefoResult.deductedBatches;

    recordStockMove({
      productId: item.productId,
      branchId: transfer.sourceBranchId,
      type: 'out',
      qty: item.qty,
      reference: transfer.transferNumber,
      note: `Transfer keluar ke ${transfer.targetBranchName}`,
      actorId: actor.id,
    });
  }

  transfer.status = 'in_transit';
  transfer.dispatchedBy = actor.id;
  transfer.dispatchedByName = actor.name;
  transfer.dispatchedAt = nowIso();
  transfer.updatedAt = nowIso();

  writeCollection(StorageKeys.stockTransfers, transfers);
  return transfer;
}

export function receiveStockTransfer(id: string, actor: Employee): StockTransfer {
  const transfers = readCollection<StockTransfer>(StorageKeys.stockTransfers);
  const transfer = transfers.find((t) => t.id === id);
  if (!transfer) throw new Error('Stock Transfer tidak ditemukan.');

  if (!canManageBranch(actor, transfer.targetBranchId)) {
    throw new Error('Tidak punya akses ke cabang tujuan.');
  }

  if (transfer.status !== 'in_transit') {
    throw new Error(`Transfer tidak dapat diterima karena berstatus ${transfer.status} (wajib In-Transit).`);
  }

  // Receive items into target branch
  for (const item of transfer.items) {
    if (item.deductedBatches && item.deductedBatches.length > 0) {
      for (const deducted of item.deductedBatches) {
        createProductBatch(
          {
            productId: item.productId,
            branchId: transfer.targetBranchId,
            batchNumber: deducted.batchNumber,
            expiryDate: deducted.expiryDate,
            initialQty: deducted.qty,
            cost: item.unitCost,
            notes: `Transfer masuk dari ${transfer.sourceBranchName} (${transfer.transferNumber})`,
          },
          actor,
        );
      }
    } else {
      // If unbatched item, directly record stock move in
      recordStockMove({
        productId: item.productId,
        branchId: transfer.targetBranchId,
        type: 'in',
        qty: item.qty,
        reference: transfer.transferNumber,
        note: `Transfer masuk dari ${transfer.sourceBranchName}`,
        actorId: actor.id,
      });
    }
  }

  transfer.status = 'received';
  transfer.receivedBy = actor.id;
  transfer.receivedByName = actor.name;
  transfer.receivedAt = nowIso();
  transfer.updatedAt = nowIso();

  writeCollection(StorageKeys.stockTransfers, transfers);
  return transfer;
}

export function cancelStockTransfer(
  id: string,
  reason: string,
  actor: Employee,
): StockTransfer {
  const transfers = readCollection<StockTransfer>(StorageKeys.stockTransfers);
  const transfer = transfers.find((t) => t.id === id);
  if (!transfer) throw new Error('Stock Transfer tidak ditemukan.');

  if (!canManageBranch(actor, transfer.sourceBranchId) && !canManageBranch(actor, transfer.targetBranchId)) {
    throw new Error('Tidak punya akses ke cabang transfer.');
  }

  if (transfer.status === 'received') {
    throw new Error('Transfer yang sudah diterima tidak dapat dibatalkan.');
  }

  if (transfer.status === 'cancelled') {
    throw new Error('Transfer sudah dibatalkan sebelumnya.');
  }

  const cleanReason = reason.trim();
  if (!cleanReason) throw new Error('Alasan pembatalan transfer wajib diisi.');

  // If in_transit, restore stock and batches to source branch
  if (transfer.status === 'in_transit') {
    for (const item of transfer.items) {
      if (item.deductedBatches && item.deductedBatches.length > 0) {
        restoreBatchDeductions(item.deductedBatches);
      }
      recordStockMove({
        productId: item.productId,
        branchId: transfer.sourceBranchId,
        type: 'in',
        qty: item.qty,
        reference: transfer.transferNumber,
        note: `Pembatalan transfer keluar (${cleanReason})`,
        actorId: actor.id,
      });
    }
  }

  transfer.status = 'cancelled';
  transfer.cancellationReason = cleanReason;
  transfer.updatedAt = nowIso();

  writeCollection(StorageKeys.stockTransfers, transfers);
  return transfer;
}
