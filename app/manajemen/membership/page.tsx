"use client";

import { dummyReward } from "@/lib/data/dummy";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSessionEmployee,
  clearSession,
  getBranches,
  getCustomers,
  searchMemberCustomers,
  getRewardCatalog,
  createRewardCatalogItem,
  updateRewardCatalogItem,
  deleteRewardCatalogItem,
  getRedemptions,
  requestRedemption,
  decideRedemption,
  canEditHoldingData,
  canApproveRedemption,
} from "@/lib/data";
import type { RewardCatalogItem, RewardRedemption } from "@/lib/data";
import { useIsClient } from "@/lib/hooks/useIsClient";
import { useSelectedBranchId } from "@/lib/hooks/useSelectedBranch";
import { ManajemenShell } from "@/components/layout/ManajemenShell";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Tab = "catalog" | "redemption";

interface RewardFormState {
  id: string | null;
  name: string;
  pointsCost: string;
  description: string;
  active: boolean;
}
const EMPTY_REWARD_FORM: RewardFormState = { id: null, name: "", pointsCost: "", description: "", active: true };

export default function MembershipPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const session = isClient ? getSessionEmployee("manajemen") : null;
  const branches = isClient ? getBranches() : [];
  const { selectedBranchId, setSelectedBranchId } = useSelectedBranchId(session, branches);

  const [tab, setTab] = useState<Tab>("catalog");
  const [dataVersion, setDataVersion] = useState(0);

  const [rewardForm, setRewardForm] = useState<RewardFormState | null>(null);
  const [rewardFormError, setRewardFormError] = useState<string | null>(null);
  const [deleteRewardTarget, setDeleteRewardTarget] = useState<RewardCatalogItem | null>(null);

  const [requestQuery, setRequestQuery] = useState("");
  const [requestCustomerId, setRequestCustomerId] = useState<string | null>(null);
  const [requestRewardId, setRequestRewardId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  const [decisionError, setDecisionError] = useState<string | null>(null);

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

  void dataVersion;
  const canEditCatalog = canEditHoldingData(session);
  const canApprove = canApproveRedemption(session);
  const rewards = getRewardCatalog();
  const activeRewards = rewards.filter((r) => r.active);
  const redemptions = getRedemptions().sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
  const customers = getCustomers();
  const requestResults = requestQuery.trim() ? searchMemberCustomers(requestQuery) : [];
  const requestCustomer = requestCustomerId ? customers.find((c) => c.id === requestCustomerId) ?? null : null;

  function customerLabel(customerId: string): string {
    const c = customers.find((x) => x.id === customerId);
    return c ? `${c.name} · ${c.phone}` : customerId;
  }

  function handleSaveReward() {
    if (!rewardForm || !session) return;
    setRewardFormError(null);
    try {
      const payload = {
        name: rewardForm.name,
        pointsCost: Number(rewardForm.pointsCost || 0),
        description: rewardForm.description,
        active: rewardForm.active,
      };
      if (rewardForm.id) updateRewardCatalogItem(rewardForm.id, payload, session);
      else createRewardCatalogItem(payload, session);
      setRewardForm(null);
      setDataVersion((v) => v + 1);
    } catch (err) {
      setRewardFormError(err instanceof Error ? err.message : "Gagal menyimpan reward.");
    }
  }

  function handleSubmitRequest() {
    setRequestError(null);
    if (!requestCustomerId) {
      setRequestError("Pilih customer terlebih dahulu.");
      return;
    }
    if (!requestRewardId) {
      setRequestError("Pilih reward terlebih dahulu.");
      return;
    }
    try {
      requestRedemption({ customerId: requestCustomerId, rewardId: requestRewardId });
      setRequestQuery("");
      setRequestCustomerId(null);
      setRequestRewardId(null);
      setDataVersion((v) => v + 1);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : "Gagal mengajukan redemption.");
    }
  }

  function handleDecide(redemptionId: string, decision: "approved" | "rejected") {
    if (!session) return;
    setDecisionError(null);
    try {
      decideRedemption(redemptionId, decision, session);
      setDataVersion((v) => v + 1);
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : "Gagal memproses redemption.");
    }
  }

  return (
    <ManajemenShell
      employee={session}
      branches={branches}
      selectedBranchId={selectedBranchId}
      onBranchChange={setSelectedBranchId}
      pageTitle="Membership & Loyalty"
      activeNavId="membership"
      onLogout={handleLogout}
    >
      <div className="font-accent mb-1 text-xs italic text-gold-bright">Reward Catalog &amp; Redemption</div>
      <div className="mb-4 font-display text-3xl tracking-wide">Membership &amp; Loyalty</div>

      <div className="mb-3.5 flex gap-2">
        <button type="button" onClick={() => setTab("catalog")} className={tabButtonClass(tab === "catalog")}>
          Reward Catalog
        </button>
        <button type="button" onClick={() => setTab("redemption")} className={tabButtonClass(tab === "redemption")}>
          Redemption{redemptions.some((r) => r.status === "pending") ? ` (${redemptions.filter((r) => r.status === "pending").length} pending)` : ""}
        </button>
      </div>

      {tab === "catalog" ? (
        <div>
          {!canEditCatalog && (
            <div className="mb-3 rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-faint">
              Hanya Owner/HQ yang bisa menambah/mengubah/menghapus reward. Branch Manager hanya bisa melihat.
            </div>
          )}
          <div className="mb-3.5 flex justify-end">
            <Button variant="primary" disabled={!canEditCatalog} onClick={() => setRewardForm(EMPTY_REWARD_FORM)}>
              + Tambah Reward
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-faint">
                  <th className="px-3 py-2 font-normal">Nama</th>
                  <th className="px-3 py-2 font-normal">Biaya Poin</th>
                  <th className="px-3 py-2 font-normal">Deskripsi</th>
                  <th className="px-3 py-2 font-normal">Status</th>
                  <th className="px-3 py-2 font-normal" />
                </tr>
              </thead>
              <tbody>
                {dummyReward.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-text-faint">
                      Belum ada data
                    </td>
                  </tr>
                ) : (
                  dummyReward.map((rw) => (
                    <tr key={rw.id} className="hover:bg-surface-2/60">
                      <td className="px-3 py-2 font-bold">{rw.nama}</td>
                      <td className="px-3 py-2 font-mono font-bold text-gold-bright">{rw.biayaPoin} Pts</td>
                      <td className="px-3 py-2 text-text-muted">{rw.deskripsi}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-ok/10 text-ok">{rw.status}</span>
                      </td>
                      <td className="px-3 py-2 text-right"><button className="text-gold-bright">Edit</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-4 rounded-lg border border-border bg-surface p-3.5">
            <div className="mb-2.5 text-sm font-bold">Ajukan Redemption Baru</div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_1fr_auto]">
              <div>
                <input
                  type="text"
                  placeholder="Cari customer (nama/HP)..."
                  value={requestCustomer ? `${requestCustomer.name} · ${requestCustomer.phone}` : requestQuery}
                  onChange={(event) => {
                    setRequestCustomerId(null);
                    setRequestQuery(event.target.value);
                  }}
                  className="w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-gold-bright focus:outline-none"
                />
                {!requestCustomerId && requestResults.length > 0 && (
                  <div className="mt-1 max-h-32 overflow-y-auto rounded-md border border-border bg-bg-raised">
                    {requestResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setRequestCustomerId(c.id);
                          setRequestQuery("");
                        }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-surface-2"
                      >
                        <span>
                          {c.name} · {c.phone}
                        </span>
                        <span className="text-gold-bright">{c.points} pts</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <select
                value={requestRewardId ?? ""}
                onChange={(event) => setRequestRewardId(event.target.value || null)}
                className="w-full rounded-md border border-border bg-surface-2 px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none"
              >
                <option value="">Pilih reward...</option>
                {activeRewards.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.pointsCost} pts)
                  </option>
                ))}
              </select>
              <Button variant="primary" onClick={handleSubmitRequest}>
                Ajukan
              </Button>
            </div>
            {requestError && (
              <div className="mt-2.5 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{requestError}</div>
            )}
          </div>

          {decisionError && (
            <div className="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{decisionError}</div>
          )}
          {!canApprove && (
            <div className="mb-3 rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-faint">
              Hanya Owner/HQ atau Branch Manager yang bisa memproses (approve/reject) redemption.
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-faint">
                  <th className="px-3 py-2 font-normal">Customer</th>
                  <th className="px-3 py-2 font-normal">Reward</th>
                  <th className="px-3 py-2 font-normal">Biaya Poin</th>
                  <th className="px-3 py-2 font-normal">Diajukan</th>
                  <th className="px-3 py-2 font-normal">Status</th>
                  <th className="px-3 py-2 font-normal" />
                </tr>
              </thead>
              <tbody>
                {redemptions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-text-faint">
                      Belum ada redemption.
                    </td>
                  </tr>
                ) : (
                  redemptions.map((redemption) => (
                    <RedemptionRow
                      key={redemption.id}
                      redemption={redemption}
                      customerLabel={customerLabel(redemption.customerId)}
                      canApprove={canApprove}
                      onDecide={handleDecide}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={rewardForm !== null}
        onClose={() => setRewardForm(null)}
        eyebrow="Reward Catalog"
        title={rewardForm?.id ? "Ubah Reward" : "Tambah Reward"}
        footer={
          <>
            <Button variant="ghost" fullWidth onClick={() => setRewardForm(null)}>
              Batal
            </Button>
            <Button variant="primary" fullWidth onClick={handleSaveReward}>
              Simpan
            </Button>
          </>
        }
      >
        {rewardForm && (
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">Nama Reward</div>
              <input
                type="text"
                value={rewardForm.name}
                onChange={(event) => setRewardForm({ ...rewardForm, name: event.target.value })}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
            <div>
              <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">Biaya Poin</div>
              <input
                type="text"
                inputMode="numeric"
                value={rewardForm.pointsCost}
                onChange={(event) => setRewardForm({ ...rewardForm, pointsCost: event.target.value.replace(/[^0-9]/g, "") })}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
            <div>
              <div className="mb-1 text-[11.5px] uppercase tracking-wide text-text-faint">Deskripsi</div>
              <textarea
                value={rewardForm.description}
                onChange={(event) => setRewardForm({ ...rewardForm, description: event.target.value })}
                rows={2}
                className="w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-gold-bright focus:outline-none"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={rewardForm.active}
                onChange={(event) => setRewardForm({ ...rewardForm, active: event.target.checked })}
              />
              Aktif (bisa diajukan customer)
            </label>
            {rewardFormError && (
              <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{rewardFormError}</div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteRewardTarget !== null}
        onClose={() => setDeleteRewardTarget(null)}
        eyebrow="Reward Catalog"
        title="Hapus Reward?"
        message="Redemption yang sudah pernah diajukan/disetujui untuk reward ini tetap tersimpan (snapshot nama & biaya poin), tidak ikut terhapus."
        confirmLabel="Ya, Hapus"
        onConfirm={() => {
          if (deleteRewardTarget && session) {
            deleteRewardCatalogItem(deleteRewardTarget.id, session);
            setDataVersion((v) => v + 1);
          }
        }}
      />
    </ManajemenShell>
  );
}

function RedemptionRow({
  redemption,
  customerLabel,
  canApprove,
  onDecide,
}: {
  redemption: RewardRedemption;
  customerLabel: string;
  canApprove: boolean;
  onDecide: (redemptionId: string, decision: "approved" | "rejected") => void;
}) {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3 py-2 font-semibold">{customerLabel}</td>
      <td className="px-3 py-2">{redemption.rewardName}</td>
      <td className="px-3 py-2">{redemption.pointsCost} pts</td>
      <td className="px-3 py-2 text-text-muted">{new Date(redemption.requestedAt).toLocaleString("id-ID")}</td>
      <td className="px-3 py-2">
        <Badge tone={redemption.status === "approved" ? "ok" : redemption.status === "rejected" ? "danger" : "warn"}>
          {redemption.status === "approved" ? "Disetujui" : redemption.status === "rejected" ? "Ditolak" : "Menunggu"}
        </Badge>
      </td>
      <td className="px-3 py-2">
        {redemption.status === "pending" && (
          <div className="flex justify-end gap-1.5">
            <Button
              variant="primary"
              className="px-2.5 py-1.5 text-xs"
              disabled={!canApprove}
              onClick={() => onDecide(redemption.id, "approved")}
            >
              Approve
            </Button>
            <Button
              variant="danger"
              className="px-2.5 py-1.5 text-xs"
              disabled={!canApprove}
              onClick={() => onDecide(redemption.id, "rejected")}
            >
              Reject
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

function tabButtonClass(active: boolean): string {
  return `rounded-md border px-3.5 py-2 text-xs font-bold ${
    active ? "border-gold-bright bg-surface-2 text-text" : "border-border bg-surface text-text-muted"
  }`;
}
