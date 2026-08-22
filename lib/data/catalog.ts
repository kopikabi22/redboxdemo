import { StorageKeys, readCollection } from './storage';
import type { Service, Product } from './types';

export function getServices(): Service[] {
  return readCollection<Service>(StorageKeys.services);
}

export function getProducts(): Product[] {
  return readCollection<Product>(StorageKeys.products);
}
