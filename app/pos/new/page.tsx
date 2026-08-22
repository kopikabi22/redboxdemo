"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranchById,
  getServices,
  getProducts,
  getAvailableStock,
  getStockStatus,
  calculateCartTotals,
  checkout,
  getHeldBills,
  holdBill,
  retrieveHeldBill,
  formatRupiah,
} from "@/lib/data";
import type { Service, Product, TransactionCustomer, TransactionLineItem, Transaction } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { AppShell, getNavItemsForRole } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { CustomerPickerModal } from "@/components/pos/CustomerPickerModal";
import { PaymentModal } from "@/components/pos/PaymentModal";

type CatalogTab = "service" | "product" | "held";

export default function PosNewPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("karyawan") : null;
  const employee = session && session.role === "Kasir" ? session : null;
  const branch = employee ? getBranchById(employee.branchId) : undefined;
  const services = employee ? getServices() : [];
  const products = employee ? getProducts() : [];

  const [tab, setTab] = useState<CatalogTab>("service");
  const [customer, setCustomer] = useState<TransactionCustomer | null>(null);
  const [items, setItems] = useState<TransactionLineItem[]>([]);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [receipt, setReceipt] = useState<Transaction | null>(null);
  const [cartError, setCartError] = useState<string | null>(null);
  const [stockVersion, setStockVersion] = useState(0);
  const [heldBillsVersion, setHeldBillsVersion] = useState(0);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isClient) return;
    if (!session) {
      router.replace("/login");
    } else if (session.role !== "Kasir") {
      router.replace("/home");
    }
  }, [isClient, session, router]);

  // Auto-dismiss the info banner a few seconds after it's set. This is a
  // legitimate Effect (subscribing to an external timer, cleaning it up),
  // not the "setState synchronously in an Effect" pattern flagged elsewhere
  // in this app — the setState here happens later, inside the timeout
  // callback, not synchronously in the Effect body itself.
  useEffect(() => {
    if (!infoMessage) return;
    const timer = setTimeout(() => setInfoMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [infoMessage]);

  function availableStockFor(productId: string): number {
    void stockVersion; // dependency so callers re-derive after a mutation, see stockVersion bumps below
    return employee ? getAvailableStock(productId, employee.branchId) : 0;
  }

  function handleAddService(service: Service) {
    setCartError(null);
    setItems((prev) => {
      const existing = prev.find((item) => item.kind === "service" && item.itemId === service.id);
      if (existing) {
        return prev.map((item) => (item === existing ? { ...item, qty: item.qty + 1 } : item));
      }
      return [...prev, { kind: "service", itemId: service.id, name: service.name, price: service.price, qty: 1 }];
    });
  }

  function handleAddProduct(product: Product) {
    if (!employee) return;
    const inCartQty = items
      .filter((item) => item.kind === "product" && item.itemId === product.id)
      .reduce((sum, item) => sum + item.qty, 0);
    const available = getAvailableStock(product.id, employee.branchId);
    if (inCartQty + 1 > available) {
      setCartError(`Stok "${product.name}" tidak cukup (tersisa ${available}).`);
      return;
    }
    setCartError(null);
    setItems((prev) => {
      const existing = prev.find((item) => item.kind === "product" && item.itemId === product.id);
      if (existing) {
        return prev.map((item) => (item === existing ? { ...item, qty: item.qty + 1 } : item));
      }
      return [...prev, { kind: "product", itemId: product.id, name: product.name, price: product.price, qty: 1 }];
    });
  }

  function handleChangeQty(index: number, delta: number) {
    const item = items[index];
    if (!item) return;
    if (item.kind === "product" && delta > 0 && employee) {
      const available = getAvailableStock(item.itemId, employee.branchId);
      if (item.qty + delta > available) {
        setCartError(`Stok "${item.name}" tidak cukup (tersisa ${available}).`);
        return;
      }
    }
    setCartError(null);
    const nextQty = item.qty + delta;
    setItems((prev) => (nextQty <= 0 ? prev.filter((_, i) => i !== index) : prev.map((it, i) => (i === index ? { ...it, qty: nextQty } : it))));
  }

  const totals = useMemo(() => calculateCartTotals(items), [items]);
  const canCheckout = items.length > 0 && customer !== null;

  function handleLogout() {
    clearSession("karyawan");
    router.replace("/login");
  }

  function handleHoldBill() {
    if (!employee) return;
    setCartError(null);
    try {
      holdBill({ branchId: employee.branchId, customer, items });
      setItems([]);
      setCustomer(null);
      setHeldBillsVersion((v) => v + 1);
      setTab("held");
    } catch (err) {
      setCartError(err instanceof Error ? err.message : "Gagal menyimpan bill.");
    }
  }

  /**
   * If the active cart isn't empty, it gets auto-held as its own new bill
   * BEFORE the requested one is loaded — so retrieving another bill can
   * never discard whatever the cashier was already typing. The cashier is
   * told this happened via `infoMessage`, not left to notice on their own.
   */
  function doRetrieveBill(billId: string) {
    if (!employee) return;
    if (items.length > 0) {
      holdBill({ branchId: employee.branchId, customer, items });
      setInfoMessage("Keranjang sebelumnya disimpan otomatis ke Bill Tertahan.");
    }
    const bill = retrieveHeldBill(billId, employee.branchId);
    setCustomer(bill.customer);
    setItems(bill.items);
    setCartError(null);
    setHeldBillsVersion((v) => v + 1);
    setTab("service");
  }

  function handleClickHeldBill(billId: string) {
    doRetrieveBill(billId);
  }

  if (!employee) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Memuat…</div>;
  }

  void heldBillsVersion;
  const heldBills = getHeldBills(employee.branchId);

  return (
    <AppShell
      employee={employee}
      branch={branch}
      pageTitle="POS — Transaksi"
      navItems={getNavItemsForRole(employee.role)}
      activeNavId="pos"
      onLogout={handleLogout}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="mb-3.5 flex gap-2">
            <button type="button" onClick={() => setTab("service")} className={tabButtonClass(tab === "service")}>
              Service
            </button>
            <button type="button" onClick={() => setTab("product")} className={tabButtonClass(tab === "product")}>
              Produk
            </button>
            <button type="button" onClick={() => setTab("held")} className={tabButtonClass(tab === "held")}>
              Bill Tertahan{heldBills.length > 0 ? ` (${heldBills.length})` : ""}
            </button>
          </div>

          {cartError && (
            <div className="mb-3 rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn">{cartError}</div>
          )}
          {infoMessage && (
            <div className="mb-3 rounded-md border border-gold-bright/40 bg-gold-bright/10 px-3 py-2 text-sm text-gold-bright">
              {infoMessage}
            </div>
          )}

          {tab === "held" ? (
            heldBills.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-text-faint">
                Belum ada bill tertahan.
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-surface">
                {heldBills.map((bill) => (
                  <button
                    key={bill.id}
                    type="button"
                    onClick={() => handleClickHeldBill(bill.id)}
                    className="flex w-full items-center justify-between border-b border-border px-3.5 py-3 text-left last:border-b-0 hover:bg-surface-2"
                  >
                    <div>
                      <div className="text-sm font-semibold">
                        {bill.customer ? bill.customer.name : "Tanpa konsumen"} — {bill.items.length} item
                      </div>
                      <div className="text-xs text-text-faint">{new Date(bill.savedAt).toLocaleTimeString("id-ID")}</div>
                    </div>
                    <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-bold text-text-muted">Ambil</span>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {tab === "service"
                ? services.map((service) => (
                    <button key={service.id} type="button" onClick={() => handleAddService(service)} className={itemCardClass}>
                      <div className="mb-1.5 text-sm font-bold">{service.name}</div>
                      <div className="mb-1.5 text-xs text-text-faint">
                        {service.category} · {service.durationMinutes} menit
                      </div>
                      <div className="text-sm font-bold text-gold-bright">{formatRupiah(service.price)}</div>
                    </button>
                  ))
                : products.map((product) => {
                    const qty = availableStockFor(product.id);
                    const status = getStockStatus(qty, product.lowStockThreshold);
                    return (
                      <button key={product.id} type="button" onClick={() => handleAddProduct(product)} className={itemCardClass}>
                        <div className="mb-1.5 text-sm font-bold">{product.name}</div>
                        <div className="mb-1.5 text-xs text-text-faint">{product.category}</div>
                        <div className="mb-1.5 text-sm font-bold text-gold-bright">{formatRupiah(product.price)}</div>
                        <Badge tone={status === "cukup" ? "ok" : status === "rendah" ? "warn" : "danger"}>{status}</Badge>
                      </button>
                    );
                  })}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-3.5 lg:sticky lg:top-[86px] lg:self-start">
          <div className="font-accent text-xs italic text-gold-bright">Keranjang</div>
          <button
            type="button"
            onClick={() => setCustomerModalOpen(true)}
            className="my-3 w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-left"
          >
            <div className="mb-0.5 text-xs text-text-faint">Konsumen</div>
            <div className="text-sm font-bold">
              {customer
                ? customer.type === "member"
                  ? `${customer.name} · ${customer.tier}`
                  : `Guest · ${customer.phone}`
                : "Ketuk untuk pilih (Member / Guest)"}
            </div>
          </button>

          <div className="mb-2.5 max-h-64 overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-3.5 text-sm text-text-faint">Keranjang masih kosong.</div>
            ) : (
              items.map((item, index) => (
                <div
                  key={`${item.kind}-${item.itemId}`}
                  className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-b-0"
                >
                  <div className="flex-1">
                    <div className="text-[12.5px] font-semibold">{item.name}</div>
                    <div className="text-xs text-text-faint">{formatRupiah(item.price)}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleChangeQty(index, -1)}
                      className="h-6 w-6 rounded border border-border bg-surface-2 font-bold"
                    >
                      −
                    </button>
                    <span className="w-4 text-center text-sm">{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => handleChangeQty(index, 1)}
                      className="h-6 w-6 rounded border border-border bg-surface-2 font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-1 text-[12.5px]">
            <div className="flex justify-between">
              <span className="text-text-muted">Subtotal</span>
              <span className="font-bold">{formatRupiah(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Pajak (10%)</span>
              <span className="font-bold">{formatRupiah(totals.tax)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base">
              <span>Total</span>
              <span className="font-bold text-gold-bright">{formatRupiah(totals.total)}</span>
            </div>
          </div>

          <div className="mt-3.5 flex gap-2">
            <Button variant="ghost" fullWidth disabled={items.length === 0} onClick={handleHoldBill}>
              Simpan Sementara
            </Button>
            <Button variant="primary" fullWidth disabled={!canCheckout} onClick={() => setPaymentModalOpen(true)}>
              Bayar
            </Button>
          </div>
          {!canCheckout && items.length > 0 && (
            <div className="mt-2 text-center text-xs text-text-faint">Pilih konsumen dulu sebelum bayar.</div>
          )}
        </div>
      </div>

      <CustomerPickerModal
        open={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onSelect={(selected) => {
          setCustomer(selected);
          setCustomerModalOpen(false);
        }}
      />

      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        total={totals.total}
        onConfirm={(method, cashTendered) => {
          if (!customer) throw new Error("Pilih konsumen terlebih dahulu.");
          const transaction = checkout({
            branchId: employee.branchId,
            cashierId: employee.id,
            cashierName: employee.name,
            customer,
            items,
            method,
            cashTendered,
          });
          setReceipt(transaction);
          setPaymentModalOpen(false);
          setItems([]);
          setCustomer(null);
          setStockVersion((v) => v + 1);
        }}
      />

      <Modal
        open={receipt !== null}
        onClose={() => setReceipt(null)}
        eyebrow="Transaksi Selesai"
        title={receipt?.id ?? ""}
        footer={
          <Button variant="primary" fullWidth onClick={() => setReceipt(null)}>
            Selesai
          </Button>
        }
      >
        {receipt && (
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span>Total</span>
              <span className="font-bold text-gold-bright">{formatRupiah(receipt.total)}</span>
            </div>
            {receipt.method === "Cash" && (
              <div className="flex justify-between">
                <span>Kembalian</span>
                <span className="font-bold">{formatRupiah(receipt.change)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Metode</span>
              <span>{receipt.method}</span>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}

function tabButtonClass(active: boolean): string {
  return `rounded-md border px-3.5 py-2 text-xs font-bold ${
    active ? "border-gold-bright bg-surface-2 text-text" : "border-border bg-surface text-text-muted"
  }`;
}

const itemCardClass = "rounded-lg border border-border bg-surface p-3 text-left hover:border-gold-bright";
