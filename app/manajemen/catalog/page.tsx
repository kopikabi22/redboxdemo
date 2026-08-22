"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getServices,
  getProducts,
  createService,
  updateService,
  deleteService,
  createProduct,
  updateProduct,
  deleteProduct,
  addManualStock,
  getAvailableStock,
  canEditHoldingData,
  canManageBranch,
  formatRupiah,
} from "@/lib/data";
import type { Product, Service } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type CatalogTab = "service" | "product";

interface ServiceFormState {
  id: string | null;
  name: string;
  category: string;
  durationMinutes: string;
  price: string;
  commissionPercent: string;
}
const EMPTY_SERVICE_FORM: ServiceFormState = { id: null, name: "", category: "", durationMinutes: "", price: "", commissionPercent: "" };

interface ProductFormState {
  id: string | null;
  sku: string;
  name: string;
  category: string;
  brand: string;
  cost: string;
  price: string;
  lowStockThreshold: string;
}
const EMPTY_PRODUCT_FORM: ProductFormState = { id: null, sku: "", name: "", category: "", brand: "", cost: "", price: "", lowStockThreshold: "10" };

export default function CatalogPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const branches = isClient ? getBranches() : [];
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(session, branches);

  const [tab, setTab] = useState<CatalogTab>("service");
  const [dataVersion, setDataVersion] = useState(0);
  const [serviceForm, setServiceForm] = useState<ServiceFormState | null>(null);
  const [serviceFormError, setServiceFormError] = useState<string | null>(null);
  const [deleteServiceTarget, setDeleteServiceTarget] = useState<Service | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState | null>(null);
  const [productFormError, setProductFormError] = useState<string | null>(null);
  const [deleteProductTarget, setDeleteProductTarget] = useState<Product | null>(null);
  const [stockModalProduct, setStockModalProduct] = useState<Product | null>(null);
  const [stockInputs, setStockInputs] = useState<Record<string, string>>({});
  const [stockError, setStockError] = useState<string | null>(null);

  useEffect(() => {
    if (isClient && !session) {
      router.replace("/manajemen/login");
    }
  }, [isClient, session, router]);

  function handleLogout() {
    clearSession("manajemen");
    router.replace("/manajemen/login");
  }

  if (!session) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Memuat…</div>;
  }

  const canEdit = canEditHoldingData(session);
  void dataVersion;
  const services = getServices();
  const products = getProducts();

  function handleSaveService() {
    if (!serviceForm || !session) return;
    setServiceFormError(null);
    try {
      const payload = {
        name: serviceForm.name,
        category: serviceForm.category,
        durationMinutes: Number(serviceForm.durationMinutes || 0),
        price: Number(serviceForm.price || 0),
        commissionPercent: Number(serviceForm.commissionPercent || 0),
      };
      if (serviceForm.id) updateService(serviceForm.id, payload, session);
      else createService(payload, session);
      setServiceForm(null);
      setDataVersion((v) => v + 1);
    } catch (err) {
      setServiceFormError(err instanceof Error ? err.message : "Gagal menyimpan service.");
    }
  }

  function handleSaveProduct() {
    if (!productForm || !session) return;
    setProductFormError(null);
    try {
      const payload = {
        sku: productForm.sku,
        name: productForm.name,
        category: productForm.category,
        brand: productForm.brand,
        cost: Number(productForm.cost || 0),
        price: Number(productForm.price || 0),
        lowStockThreshold: Number(productForm.lowStockThreshold || 0),
      };
      if (productForm.id) updateProduct(productForm.id, payload, session);
      else createProduct(payload, session);
      setProductForm(null);
      setDataVersion((v) => v + 1);
    } catch (err) {
      setProductFormError(err instanceof Error ? err.message : "Gagal menyimpan produk.");
    }
  }

  function openStockModal(product: Product) {
    setStockInputs({});
    setStockError(null);
    setStockModalProduct(product);
  }

  function submitStock(branchId: string) {
    if (!stockModalProduct || !session) return;
    setStockError(null);
    const raw = stockInputs[branchId]?.trim();
    if (!raw) {
      setStockError("Isi jumlah dulu.");
      return;
    }
    try {
      addManualStock({ productId: stockModalProduct.id, branchId, qty: Number(raw), actingEmployee: session });
      setStockInputs((prev) => ({ ...prev, [branchId]: "" }));
      setDataVersion((v) => v + 1);
    } catch (err) {
      setStockError(err instanceof Error ? err.message : "Gagal menambah stok.");
    }
  }

  return (
    <ManajemenShell
      employee={session}
      branches={branches}
      selectedBranchId={selectedBranchId}
      onBranchChange={setSelectedBranchId}
      pageTitle="Product & Service Master"
      activeNavId="catalog"
      onLogout={handleLogout}
    >
      <div className="font-accent mb-1 text-xs italic text-gold-bright">Holding — Katalog Berlaku Semua Cabang</div>
      <div className="mb-4 font-display text-3xl tracking-wide">Product &amp; Service Master</div>

      <div className="mb-3.5 flex gap-2">
        <button type="button" onClick={() => setTab("service")} className={tabButtonClass(tab === "service")}>
          Service
        </button>
        <button type="button" onClick={() => setTab("product")} className={tabButtonClass(tab === "product")}>
          Produk / SKU
        </button>
      </div>

      {tab === "service" ? (
        <>
          <div className="mb-3.5 flex justify-end">
            <Button variant="primary" disabled={!canEdit} onClick={() => setServiceForm(EMPTY_SERVICE_FORM)}>
              + Tambah Service
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-faint">
                  <th className="px-3 py-2 font-normal">Nama</th>
                  <th className="px-3 py-2 font-normal">Kategori</th>
                  <th className="px-3 py-2 font-normal">Durasi</th>
                  <th className="px-3 py-2 font-normal">Harga</th>
                  <th className="px-3 py-2 font-normal">Komisi</th>
                  <th className="px-3 py-2 font-normal" />
                </tr>
              </thead>
              <tbody>
                {services.map((service) => (
                  <tr key={service.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 font-semibold">{service.name}</td>
                    <td className="px-3 py-2">{service.category}</td>
                    <td className="px-3 py-2">{service.durationMinutes} mnt</td>
                    <td className="px-3 py-2">{formatRupiah(service.price)}</td>
                    <td className="px-3 py-2">{service.commissionPercent}%</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="default"
                          className="px-2.5 py-1.5 text-xs"
                          disabled={!canEdit}
                          onClick={() =>
                            setServiceForm({
                              id: service.id,
                              name: service.name,
                              category: service.category,
                              durationMinutes: String(service.durationMinutes),
                              price: String(service.price),
                              commissionPercent: String(service.commissionPercent),
                            })
                          }
                        >
                          Ubah
                        </Button>
                        <Button variant="danger" className="px-2.5 py-1.5 text-xs" disabled={!canEdit} onClick={() => setDeleteServiceTarget(service)}>
                          Hapus
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="mb-3.5 flex justify-end">
            <Button variant="primary" disabled={!canEdit} onClick={() => setProductForm(EMPTY_PRODUCT_FORM)}>
              + Tambah Produk
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-faint">
                  <th className="px-3 py-2 font-normal">SKU</th>
                  <th className="px-3 py-2 font-normal">Nama</th>
                  <th className="px-3 py-2 font-normal">Kategori</th>
                  <th className="px-3 py-2 font-normal">Harga</th>
                  <th className="px-3 py-2 font-normal">Stok ({branches.find((b) => b.id === selectedBranchId)?.name ?? "—"})</th>
                  <th className="px-3 py-2 font-normal" />
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const qty = getAvailableStock(product.id, selectedBranchId);
                  return (
                    <tr key={product.id} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2">{product.sku}</td>
                      <td className="px-3 py-2 font-semibold">{product.name}</td>
                      <td className="px-3 py-2">{product.category}</td>
                      <td className="px-3 py-2">{formatRupiah(product.price)}</td>
                      <td className="px-3 py-2">{qty} unit</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="gold" className="px-2.5 py-1.5 text-xs" onClick={() => openStockModal(product)}>
                            Kelola Stok
                          </Button>
                          <Button
                            variant="default"
                            className="px-2.5 py-1.5 text-xs"
                            disabled={!canEdit}
                            onClick={() =>
                              setProductForm({
                                id: product.id,
                                sku: product.sku,
                                name: product.name,
                                category: product.category,
                                brand: product.brand,
                                cost: String(product.cost),
                                price: String(product.price),
                                lowStockThreshold: String(product.lowStockThreshold),
                              })
                            }
                          >
                            Ubah
                          </Button>
                          <Button variant="danger" className="px-2.5 py-1.5 text-xs" disabled={!canEdit} onClick={() => setDeleteProductTarget(product)}>
                            Hapus
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ---- Service form modal ---- */}
      <Modal
        open={serviceForm !== null}
        onClose={() => setServiceForm(null)}
        eyebrow="Product & Service"
        title={serviceForm?.id ? "Ubah Service" : "Tambah Service"}
        footer={
          <>
            <Button variant="ghost" fullWidth onClick={() => setServiceForm(null)}>
              Batal
            </Button>
            <Button variant="primary" fullWidth onClick={handleSaveService}>
              Simpan
            </Button>
          </>
        }
      >
        {serviceForm && (
          <div className="space-y-3">
            <Field label="Nama Service" value={serviceForm.name} onChange={(v) => setServiceForm({ ...serviceForm, name: v })} />
            <Field label="Kategori" value={serviceForm.category} onChange={(v) => setServiceForm({ ...serviceForm, category: v })} />
            <NumberField label="Durasi (menit)" value={serviceForm.durationMinutes} onChange={(v) => setServiceForm({ ...serviceForm, durationMinutes: v })} />
            <NumberField label="Harga" value={serviceForm.price} onChange={(v) => setServiceForm({ ...serviceForm, price: v })} />
            <NumberField label="Komisi (%)" value={serviceForm.commissionPercent} onChange={(v) => setServiceForm({ ...serviceForm, commissionPercent: v })} />
            {serviceFormError && (
              <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{serviceFormError}</div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteServiceTarget !== null}
        onClose={() => setDeleteServiceTarget(null)}
        eyebrow="Product & Service"
        title="Hapus Service?"
        message={`Service "${deleteServiceTarget?.name ?? ""}" tidak bisa dipakai lagi di transaksi baru.`}
        confirmLabel="Ya, Hapus"
        onConfirm={() => {
          if (deleteServiceTarget && session) {
            deleteService(deleteServiceTarget.id, session);
            setDataVersion((v) => v + 1);
          }
        }}
      />

      {/* ---- Product form modal ---- */}
      <Modal
        open={productForm !== null}
        onClose={() => setProductForm(null)}
        eyebrow="Product & Service"
        title={productForm?.id ? "Ubah Produk" : "Tambah Produk"}
        footer={
          <>
            <Button variant="ghost" fullWidth onClick={() => setProductForm(null)}>
              Batal
            </Button>
            <Button variant="primary" fullWidth onClick={handleSaveProduct}>
              Simpan
            </Button>
          </>
        }
      >
        {productForm && (
          <div className="space-y-3">
            <Field label="SKU" value={productForm.sku} onChange={(v) => setProductForm({ ...productForm, sku: v })} />
            <Field label="Nama Produk" value={productForm.name} onChange={(v) => setProductForm({ ...productForm, name: v })} />
            <Field label="Kategori" value={productForm.category} onChange={(v) => setProductForm({ ...productForm, category: v })} />
            <Field label="Brand" value={productForm.brand} onChange={(v) => setProductForm({ ...productForm, brand: v })} />
            <NumberField label="Harga Cost" value={productForm.cost} onChange={(v) => setProductForm({ ...productForm, cost: v })} />
            <NumberField label="Harga Jual" value={productForm.price} onChange={(v) => setProductForm({ ...productForm, price: v })} />
            <NumberField label="Batas Stok Rendah" value={productForm.lowStockThreshold} onChange={(v) => setProductForm({ ...productForm, lowStockThreshold: v })} />
            {productFormError && (
              <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{productFormError}</div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteProductTarget !== null}
        onClose={() => setDeleteProductTarget(null)}
        eyebrow="Product & Service"
        title="Hapus Produk?"
        message={`Produk "${deleteProductTarget?.name ?? ""}" yang masih punya stok tersisa di cabang mana pun tidak bisa dihapus.`}
        confirmLabel="Ya, Hapus"
        onConfirm={() => {
          if (deleteProductTarget && session) {
            deleteProduct(deleteProductTarget.id, session);
            setDataVersion((v) => v + 1);
          }
        }}
      />

      {/* ---- Kelola Stok modal ---- */}
      <Modal
        open={stockModalProduct !== null}
        onClose={() => setStockModalProduct(null)}
        eyebrow="Inventory"
        title={`Kelola Stok — ${stockModalProduct?.name ?? ""}`}
        footer={
          <Button variant="ghost" fullWidth onClick={() => setStockModalProduct(null)}>
            Tutup
          </Button>
        }
      >
        <div className="mb-3 text-xs text-text-faint">
          Tambah stok manual per cabang (mis. hasil pembelian). Purchasing &amp; Supplier penuh tersedia di Tier 3.
        </div>
        {stockModalProduct &&
          branches.map((branch) => {
            const allowed = canManageBranch(session, branch.id);
            const qty = getAvailableStock(stockModalProduct.id, branch.id);
            return (
              <div key={branch.id} className="flex items-center justify-between gap-2 border-b border-dashed border-border py-2 last:border-b-0">
                <div>
                  <div className="text-sm">{branch.name}</div>
                  <div className="text-xs text-text-faint">Stok saat ini: {qty}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Jumlah"
                    disabled={!allowed}
                    value={stockInputs[branch.id] ?? ""}
                    onChange={(event) =>
                      setStockInputs((prev) => ({ ...prev, [branch.id]: event.target.value.replace(/[^0-9]/g, "") }))
                    }
                    className="w-24 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-center text-sm text-text focus:border-gold-bright focus:outline-none disabled:opacity-40"
                  />
                  <Button variant="gold" className="px-3 py-1.5 text-xs" disabled={!allowed} onClick={() => submitStock(branch.id)}>
                    + Tambah
                  </Button>
                </div>
              </div>
            );
          })}
        {stockError && (
          <div className="mt-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{stockError}</div>
        )}
      </Modal>
    </ManajemenShell>
  );
}

function tabButtonClass(active: boolean): string {
  return `rounded-md border px-3.5 py-2 text-xs font-bold ${
    active ? "border-gold-bright bg-surface-2 text-text" : "border-border bg-surface text-text-muted"
  }`;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">{label}</div>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none"
      />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">{label}</div>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^0-9]/g, ""))}
        className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none"
      />
    </div>
  );
}
