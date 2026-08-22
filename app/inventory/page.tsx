"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranchById,
  getProducts,
  getAvailableStock,
  getStockStatus,
  recordStockMove,
  getBatchesByProductAndBranch,
  evaluateExpiryStatus,
} from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { AppShell, getNavItemsForRole } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

export default function InventoryPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("karyawan") : null;
  const employee = session && session.role === "Kasir" ? session : null;
  const branch = employee ? getBranchById(employee.branchId) : undefined;
  const products = employee ? getProducts() : [];

  const [dataVersion, setDataVersion] = useState(0);
  const [opnameModalOpen, setOpnameModalOpen] = useState(false);
  const [opnameCounts, setOpnameCounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isClient) return;
    if (!session) {
      router.replace("/login");
    } else if (session.role !== "Kasir") {
      router.replace("/home");
    }
  }, [isClient, session, router]);

  function handleLogout() {
    clearSession("karyawan");
    router.replace("/login");
  }

  function openOpnameModal() {
    setOpnameCounts({});
    setOpnameModalOpen(true);
  }

  function submitOpname() {
    if (!employee) return;
    Object.entries(opnameCounts).forEach(([productId, value]) => {
      const trimmed = value.trim();
      if (trimmed === "") return;
      recordStockMove({
        productId,
        branchId: employee.branchId,
        type: "opname_set",
        qty: Number(trimmed),
        reference: "OPNAME",
        note: `Stock opname oleh ${employee.name}`,
        actorId: employee.id,
      });
    });
    setOpnameModalOpen(false);
    setDataVersion((v) => v + 1);
  }

  if (!employee) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-faint">Memuat…</div>;
  }

  void dataVersion;

  return (
    <AppShell
      employee={employee}
      branch={branch}
      pageTitle="Inventory (Operasional)"
      navItems={getNavItemsForRole(employee.role)}
      activeNavId="inventory"
      onLogout={handleLogout}
    >
      <div className="mb-3.5 flex justify-end">
        <Button variant="gold" onClick={openOpnameModal}>
          Stock Opname
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => {
          const qty = getAvailableStock(product.id, employee.branchId);
          const status = getStockStatus(qty, product.lowStockThreshold);
          const productBatches = getBatchesByProductAndBranch(product.id, employee.branchId);
          const hasExpired = productBatches.some((b) => evaluateExpiryStatus(b.expiryDate) === "expired");
          const hasNearExpiry = productBatches.some((b) => evaluateExpiryStatus(b.expiryDate) === "near_expiry");

          return (
            <div key={product.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="mb-1 text-sm font-bold">{product.name}</div>
              <div className="mb-2 text-xs text-text-faint">{product.category}</div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={status === "cukup" ? "ok" : status === "rendah" ? "warn" : "danger"}>
                  {status.charAt(0).toUpperCase() + status.slice(1)} ({qty})
                </Badge>
                {hasExpired && (
                  <Badge tone="danger">⛔ Kadaluarsa</Badge>
                )}
                {!hasExpired && hasNearExpiry && (
                  <Badge tone="warn">⚠️ Kritis (≤ 30 Hari)</Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 text-xs text-text-faint">
        Penyesuaian stok penuh (adjustment manual, transfer antar-cabang) dilakukan di POV Manajemen dengan otorisasi.
      </div>

      <Modal
        open={opnameModalOpen}
        onClose={() => setOpnameModalOpen(false)}
        eyebrow="Inventory"
        title="Stock Opname"
        footer={
          <>
            <Button variant="ghost" fullWidth onClick={() => setOpnameModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" fullWidth onClick={submitOpname}>
              Simpan Opname
            </Button>
          </>
        }
      >
        <div className="mb-3 text-xs text-text-faint">
          Masukkan hasil hitung fisik untuk tiap produk. Kosongkan kalau sama dengan sistem.
        </div>
        {products.map((product) => {
          const current = getAvailableStock(product.id, employee.branchId);
          return (
            <div key={product.id} className="flex items-center justify-between border-b border-dashed border-border py-2 last:border-b-0">
              <div>
                <div className="text-sm">{product.name}</div>
                <div className="text-xs text-text-faint">Sistem: {current}</div>
              </div>
              <input
                type="text"
                inputMode="numeric"
                placeholder="—"
                value={opnameCounts[product.id] ?? ""}
                onChange={(event) =>
                  setOpnameCounts((prev) => ({ ...prev, [product.id]: event.target.value.replace(/[^0-9]/g, "") }))
                }
                className="w-20 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-center text-sm text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
          );
        })}
      </Modal>
    </AppShell>
  );
}
