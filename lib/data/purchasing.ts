import { StorageKeys, readCollection, writeCollection, generateId, nowIso, todayDateString } from './storage';
import { canManageBranch } from './rbac';
import { getProductById } from './catalog';
import { getBranchById } from './branches';
import { createProductBatch } from './batches';
import type {
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  Employee,
} from './types';

// ==========================================
// MASTER SUPPLIER
// ==========================================

export function getSuppliers(activeOnly = false): Supplier[] {
  const suppliers = readCollection<Supplier>(StorageKeys.suppliers);
  if (activeOnly) {
    return suppliers.filter((s) => s.isActive);
  }
  return suppliers;
}

export function getSupplierById(id: string): Supplier | undefined {
  return getSuppliers().find((s) => s.id === id);
}

export interface CreateSupplierInput {
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address: string;
  paymentTerms: string;
  notes?: string;
}

export function createSupplier(input: CreateSupplierInput, actor?: Employee): Supplier {
  if (actor && (actor.role === 'Kasir' || actor.role === 'Barber')) {
    throw new Error('Akses ditolak: role tidak memiliki wewenang mengelola supplier.');
  }

  const name = input.name.trim();
  if (!name) throw new Error('Nama supplier wajib diisi.');
  const phone = input.phone.trim();
  if (!phone) throw new Error('Nomor telepon supplier wajib diisi.');
  const contactPerson = input.contactPerson.trim();
  if (!contactPerson) throw new Error('Nama PIC / Contact person wajib diisi.');

  const suppliers = getSuppliers();
  const supplier: Supplier = {
    id: generateId('sup'),
    name,
    contactPerson,
    phone,
    email: input.email?.trim() || undefined,
    address: input.address.trim(),
    paymentTerms: input.paymentTerms.trim() || 'COD',
    notes: input.notes?.trim() || undefined,
    isActive: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  suppliers.push(supplier);
  writeCollection(StorageKeys.suppliers, suppliers);
  return supplier;
}

export function updateSupplier(
  id: string,
  patch: Partial<CreateSupplierInput> & { isActive?: boolean },
  actor?: Employee,
): Supplier {
  if (actor && (actor.role === 'Kasir' || actor.role === 'Barber')) {
    throw new Error('Akses ditolak: role tidak memiliki wewenang mengelola supplier.');
  }

  const suppliers = getSuppliers();
  const supplier = suppliers.find((s) => s.id === id);
  if (!supplier) throw new Error('Supplier tidak ditemukan.');

  if (patch.name !== undefined) {
    const n = patch.name.trim();
    if (!n) throw new Error('Nama supplier tidak boleh kosong.');
    supplier.name = n;
  }
  if (patch.contactPerson !== undefined) {
    const cp = patch.contactPerson.trim();
    if (!cp) throw new Error('PIC tidak boleh kosong.');
    supplier.contactPerson = cp;
  }
  if (patch.phone !== undefined) {
    const p = patch.phone.trim();
    if (!p) throw new Error('Nomor telepon tidak boleh kosong.');
    supplier.phone = p;
  }
  if (patch.email !== undefined) supplier.email = patch.email.trim() || undefined;
  if (patch.address !== undefined) supplier.address = patch.address.trim();
  if (patch.paymentTerms !== undefined) supplier.paymentTerms = patch.paymentTerms.trim();
  if (patch.notes !== undefined) supplier.notes = patch.notes.trim() || undefined;
  if (patch.isActive !== undefined) supplier.isActive = patch.isActive;

  supplier.updatedAt = nowIso();
  writeCollection(StorageKeys.suppliers, suppliers);
  return supplier;
}

export function deleteSupplier(id: string, actor?: Employee): void {
  if (actor && actor.role !== 'Owner') {
    throw new Error('Akses ditolak: hanya Owner yang berhak menghapus master supplier.');
  }

  const suppliers = getSuppliers();
  const filtered = suppliers.filter((s) => s.id !== id);
  writeCollection(StorageKeys.suppliers, filtered);
}

// ==========================================
// PURCHASE ORDER LIFECYCLE
// ==========================================

export function getPurchaseOrders(
  branchId?: string,
  status?: PurchaseOrderStatus,
): PurchaseOrder[] {
  const pos = readCollection<PurchaseOrder>(StorageKeys.purchaseOrders);
  return pos
    .filter((po) => {
      if (branchId && po.branchId !== branchId) return false;
      if (status && po.status !== status) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getPurchaseOrderById(id: string): PurchaseOrder | undefined {
  return getPurchaseOrders().find((po) => po.id === id);
}

export interface CreatePurchaseOrderItemInput {
  productId: string;
  qtyOrdered: number;
  unitCost: number;
}

export interface CreatePurchaseOrderInput {
  branchId: string;
  supplierId: string;
  orderDate?: string;
  expectedDate?: string;
  paymentTerms?: string;
  notes?: string;
  items: CreatePurchaseOrderItemInput[];
  submitNow?: boolean;
}

export function createPurchaseOrder(
  input: CreatePurchaseOrderInput,
  actor: Employee,
): PurchaseOrder {
  if (actor.role === 'Kasir' || actor.role === 'Barber') {
    throw new Error('Akses ditolak: role tidak memiliki wewenang membuat Purchase Order.');
  }

  const branch = getBranchById(input.branchId);
  if (!branch) throw new Error('Cabang tujuan tidak ditemukan.');

  if (!canManageBranch(actor, input.branchId)) {
    throw new Error('Tidak punya akses ke cabang ini.');
  }

  const supplier = getSupplierById(input.supplierId);
  if (!supplier) throw new Error('Supplier tidak ditemukan.');

  if (!input.items || input.items.length === 0) {
    throw new Error('Daftar item pesanan PO tidak boleh kosong.');
  }

  const poItems: PurchaseOrderItem[] = [];
  let subtotal = 0;

  for (const itemInput of input.items) {
    const product = getProductById(itemInput.productId);
    if (!product) {
      throw new Error(`Produk dengan ID ${itemInput.productId} tidak ditemukan.`);
    }
    if (itemInput.qtyOrdered <= 0) {
      throw new Error(`Jumlah pesanan untuk ${product.name} harus lebih dari 0.`);
    }
    if (itemInput.unitCost < 0) {
      throw new Error(`Harga modal untuk ${product.name} tidak boleh negatif.`);
    }

    const itemSubtotal = itemInput.qtyOrdered * itemInput.unitCost;
    subtotal += itemSubtotal;

    poItems.push({
      id: generateId('poi'),
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      qtyOrdered: itemInput.qtyOrdered,
      qtyReceived: 0,
      unitCost: itemInput.unitCost,
      subtotal: itemSubtotal,
    });
  }

  const taxAmount = 0;
  const totalAmount = subtotal + taxAmount;

  const pos = readCollection<PurchaseOrder>(StorageKeys.purchaseOrders);
  const poNumber = `PO-${Date.now().toString().slice(-8)}`;

  const po: PurchaseOrder = {
    id: generateId('po'),
    poNumber,
    branchId: input.branchId,
    supplierId: supplier.id,
    supplierName: supplier.name,
    orderDate: input.orderDate ?? todayDateString(),
    expectedDate: input.expectedDate,
    status: input.submitNow ? 'submitted' : 'draft',
    items: poItems,
    subtotal,
    taxAmount,
    totalAmount,
    paymentTerms: input.paymentTerms || supplier.paymentTerms,
    notes: input.notes,
    createdBy: actor.id,
    createdByName: actor.name,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  pos.push(po);
  writeCollection(StorageKeys.purchaseOrders, pos);
  return po;
}

export function submitPurchaseOrder(id: string, actor: Employee): PurchaseOrder {
  const pos = readCollection<PurchaseOrder>(StorageKeys.purchaseOrders);
  const po = pos.find((p) => p.id === id);
  if (!po) throw new Error('Purchase Order tidak ditemukan.');

  if (!canManageBranch(actor, po.branchId)) {
    throw new Error('Tidak punya akses ke cabang ini.');
  }

  if (po.status !== 'draft') {
    throw new Error(`PO tidak dapat diajukan karena berstatus ${po.status}.`);
  }

  po.status = 'submitted';
  po.updatedAt = nowIso();
  writeCollection(StorageKeys.purchaseOrders, pos);
  return po;
}

export function approvePurchaseOrder(id: string, actor: Employee): PurchaseOrder {
  const allowedRoles: Employee['role'][] = ['Owner', 'BranchManager'];
  if (!allowedRoles.includes(actor.role)) {
    throw new Error('Akses ditolak: role tidak memiliki wewenang menyetujui Purchase Order.');
  }

  const pos = readCollection<PurchaseOrder>(StorageKeys.purchaseOrders);
  const po = pos.find((p) => p.id === id);
  if (!po) throw new Error('Purchase Order tidak ditemukan.');

  if (!canManageBranch(actor, po.branchId)) {
    throw new Error('Tidak punya akses ke cabang ini.');
  }

  if (po.status !== 'submitted') {
    throw new Error(`PO tidak dapat disetujui karena berstatus ${po.status}.`);
  }

  po.status = 'approved';
  po.approvedBy = actor.id;
  po.approvedByName = actor.name;
  po.approvedAt = nowIso();
  po.updatedAt = nowIso();

  writeCollection(StorageKeys.purchaseOrders, pos);
  return po;
}

export interface ReceivingDetailInput {
  itemId: string; // PurchaseOrderItem ID or productId
  qtyReceived: number;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
}

export function receivePurchaseOrder(
  id: string,
  receivingDetails: ReceivingDetailInput[],
  actor: Employee,
): PurchaseOrder {
  const pos = readCollection<PurchaseOrder>(StorageKeys.purchaseOrders);
  const po = pos.find((p) => p.id === id);
  if (!po) throw new Error('Purchase Order tidak ditemukan.');

  if (!canManageBranch(actor, po.branchId)) {
    throw new Error('Tidak punya akses ke cabang ini.');
  }

  if (po.status !== 'approved') {
    throw new Error(`Barang PO tidak dapat diterima karena berstatus ${po.status} (wajib Approved).`);
  }

  if (!receivingDetails || receivingDetails.length === 0) {
    throw new Error('Rincian penerimaan barang tidak boleh kosong.');
  }

  for (const detail of receivingDetails) {
    const item = po.items.find((i) => i.id === detail.itemId || i.productId === detail.itemId);
    if (!item) {
      throw new Error(`Item ${detail.itemId} tidak ditemukan pada PO ${po.poNumber}.`);
    }
    if (detail.qtyReceived <= 0) {
      throw new Error(`Jumlah diterima untuk ${item.productName} harus lebih dari 0.`);
    }
    const batchNum = detail.batchNumber.trim();
    if (!batchNum) {
      throw new Error(`Nomor batch wajib diisi untuk item ${item.productName}.`);
    }
    if (!detail.expiryDate) {
      throw new Error(`Tanggal kadaluarsa wajib diisi untuk item ${item.productName}.`);
    }

    item.qtyReceived = detail.qtyReceived;
    item.batchNumber = batchNum;
    item.expiryDate = detail.expiryDate;

    // Create ProductBatch (automatically updates inventory balance & records stock move)
    createProductBatch(
      {
        productId: item.productId,
        branchId: po.branchId,
        batchNumber: batchNum,
        expiryDate: detail.expiryDate,
        initialQty: detail.qtyReceived,
        cost: item.unitCost,
        notes: `Penerimaan ${po.poNumber} (${po.supplierName})`,
      },
      actor,
    );
  }

  po.status = 'received';
  po.receivedBy = actor.id;
  po.receivedByName = actor.name;
  po.receivedAt = nowIso();
  po.updatedAt = nowIso();

  writeCollection(StorageKeys.purchaseOrders, pos);
  return po;
}

export function cancelPurchaseOrder(id: string, reason: string, actor: Employee): PurchaseOrder {
  const pos = readCollection<PurchaseOrder>(StorageKeys.purchaseOrders);
  const po = pos.find((p) => p.id === id);
  if (!po) throw new Error('Purchase Order tidak ditemukan.');

  if (!canManageBranch(actor, po.branchId)) {
    throw new Error('Tidak punya akses ke cabang ini.');
  }

  if (po.status === 'received') {
    throw new Error('PO yang sudah berstatus Received tidak dapat dibatalkan.');
  }

  const cleanReason = reason.trim();
  if (!cleanReason) throw new Error('Alasan pembatalan PO wajib diisi.');

  po.status = 'cancelled';
  po.cancellationReason = cleanReason;
  po.updatedAt = nowIso();

  writeCollection(StorageKeys.purchaseOrders, pos);
  return po;
}
