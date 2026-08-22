import { StorageKeys, readCollection, writeCollection, generateId } from './storage';
import { canEditHoldingData } from './rbac';
import { getAvailableStock } from './stock';
import { getBranches } from './branches';
import type { Employee, Product, Service } from './types';

export function getServices(): Service[] {
  return readCollection<Service>(StorageKeys.services);
}

export function getProducts(): Product[] {
  return readCollection<Product>(StorageKeys.products);
}

export interface CreateServiceInput {
  name: string;
  category: string;
  durationMinutes: number;
  price: number;
  commissionPercent: number;
}

export type UpdateServiceInput = Partial<CreateServiceInput>;

function validateServiceInput(input: UpdateServiceInput): void {
  if (input.name !== undefined && !input.name.trim()) throw new Error('Nama service wajib diisi.');
  if (input.price !== undefined && input.price < 0) throw new Error('Harga tidak boleh negatif.');
  if (input.durationMinutes !== undefined && input.durationMinutes <= 0) {
    throw new Error('Durasi harus lebih dari 0 menit.');
  }
  if (input.commissionPercent !== undefined && (input.commissionPercent < 0 || input.commissionPercent > 100)) {
    throw new Error('Komisi harus antara 0-100%.');
  }
}

export function createService(input: CreateServiceInput, actingEmployee: Employee): Service {
  if (!canEditHoldingData(actingEmployee)) throw new Error('Hanya Owner/HQ yang bisa menambah service.');
  validateServiceInput(input);

  const services = getServices();
  const service: Service = { id: generateId('svc'), ...input, name: input.name.trim() };
  services.push(service);
  writeCollection(StorageKeys.services, services);
  return service;
}

export function updateService(serviceId: string, patch: UpdateServiceInput, actingEmployee: Employee): Service {
  if (!canEditHoldingData(actingEmployee)) throw new Error('Hanya Owner/HQ yang bisa mengubah service.');
  validateServiceInput(patch);

  const services = getServices();
  const service = services.find((s) => s.id === serviceId);
  if (!service) throw new Error('Service tidak ditemukan.');

  Object.assign(service, patch, patch.name !== undefined ? { name: patch.name.trim() } : {});
  writeCollection(StorageKeys.services, services);
  return service;
}

export function deleteService(serviceId: string, actingEmployee: Employee): void {
  if (!canEditHoldingData(actingEmployee)) throw new Error('Hanya Owner/HQ yang bisa menghapus service.');
  writeCollection(
    StorageKeys.services,
    getServices().filter((s) => s.id !== serviceId),
  );
}

export interface CreateProductInput {
  sku: string;
  name: string;
  category: string;
  brand: string;
  cost: number;
  price: number;
  lowStockThreshold: number;
}

export type UpdateProductInput = Partial<CreateProductInput>;

function validateProductInput(input: UpdateProductInput): void {
  if (input.name !== undefined && !input.name.trim()) throw new Error('Nama produk wajib diisi.');
  if (input.sku !== undefined && !input.sku.trim()) throw new Error('SKU wajib diisi.');
  if (input.cost !== undefined && input.cost < 0) throw new Error('Harga cost tidak boleh negatif.');
  if (input.price !== undefined && input.price < 0) throw new Error('Harga jual tidak boleh negatif.');
  if (input.lowStockThreshold !== undefined && input.lowStockThreshold < 0) {
    throw new Error('Batas stok rendah tidak boleh negatif.');
  }
}

/** Core Business Rule #2 (CLAUDE.md): every product has one unique central SKU. */
export function createProduct(input: CreateProductInput, actingEmployee: Employee): Product {
  if (!canEditHoldingData(actingEmployee)) throw new Error('Hanya Owner/HQ yang bisa menambah produk.');
  validateProductInput(input);
  const sku = input.sku.trim();

  const products = getProducts();
  if (products.some((p) => p.sku === sku)) throw new Error('SKU sudah dipakai produk lain.');

  const product: Product = { id: generateId('prd'), ...input, sku, name: input.name.trim() };
  products.push(product);
  writeCollection(StorageKeys.products, products);
  return product;
}

export function updateProduct(productId: string, patch: UpdateProductInput, actingEmployee: Employee): Product {
  if (!canEditHoldingData(actingEmployee)) throw new Error('Hanya Owner/HQ yang bisa mengubah produk.');
  validateProductInput(patch);

  const products = getProducts();
  const product = products.find((p) => p.id === productId);
  if (!product) throw new Error('Produk tidak ditemukan.');

  if (patch.sku !== undefined) {
    const sku = patch.sku.trim();
    if (products.some((p) => p.id !== productId && p.sku === sku)) {
      throw new Error('SKU sudah dipakai produk lain.');
    }
  }

  Object.assign(
    product,
    patch,
    patch.name !== undefined ? { name: patch.name.trim() } : {},
    patch.sku !== undefined ? { sku: patch.sku.trim() } : {},
  );
  writeCollection(StorageKeys.products, products);
  return product;
}

/** Blocks deletion while any branch still carries stock — opname it to 0 first. */
export function deleteProduct(productId: string, actingEmployee: Employee): void {
  if (!canEditHoldingData(actingEmployee)) throw new Error('Hanya Owner/HQ yang bisa menghapus produk.');
  const hasStock = getBranches().some((b) => getAvailableStock(productId, b.id) > 0);
  if (hasStock) throw new Error('Produk masih punya stok tersisa, tidak bisa dihapus.');

  writeCollection(
    StorageKeys.products,
    getProducts().filter((p) => p.id !== productId),
  );
}
