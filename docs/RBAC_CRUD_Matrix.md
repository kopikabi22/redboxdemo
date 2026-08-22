# RBAC × CRUD Matrix — RedBox ERP

Legenda: **C**reate, **R**ead, **U**pdate, **D**elete, **-** = tidak ada akses.
`[H]` = scope Holding (company-wide), `[B]` = scope Branch (lokal, milik cabang
sendiri). Sinkron dengan struktur modul terbaru di `CLAUDE.md` (Customer/Membership/
Loyalty gabung, Product/Inventory/Purchasing gabung, Finance dipisah Holding/Branch).

Catatan umum: **D** (Delete) TIDAK PERNAH diberikan untuk data ledger (Stock Movement,
Loyalty Ledger, Journal Entry, Audit Log, Payment) — sesuai prinsip "ledger, bukan
overwrite". Koreksi lewat record baru (reversal/jurnal penyesuaian), bukan hapus data
lama.

| Modul | Owner/CEO | HQ/Admin | Branch Manager | Cashier | Barber | Warehouse | Purchasing | HR | Finance | Marketing/CRM | System Admin |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Operasional Cabang — POS** `[B]` | CRUD (semua cabang) | R | CRU (cabang sendiri) | CR (create/read; U hanya save-bill) | - | - | - | - | R | - | R |
| **Operasional Cabang — Refund/Void** `[B]` | CRUD | R | **Approve** (U status) | Trigger (C) | - | - | - | - | R | - | R |
| **Operasional Cabang — Cash In/Out** `[B]` | CRUD | R | CR (cabang sendiri) | C (create only) | - | - | - | - | CRU (cross-branch) | - | R |
| **Operasional Cabang — Cashier Closing** `[B]` | CRUD | R | CRU (cabang sendiri) | C (submit) | - | - | - | - | R (review semua cabang) | - | R |
| **Operasional Cabang — Appointment & Queue** `[B]` | CRUD | R | CRU (cabang sendiri) | CRU | R (jadwal sendiri) | - | - | - | - | R | R |
| **Operasional Cabang — Home Service/Wedding** `[B]` | CRUD | R | CRU (cabang sendiri) | CRU | R (assignment sendiri) | - | - | - | - | R | R |
| **Operasional Cabang — Attendance & Break** `[B]` | CRUD (semua) | R | R (cabang sendiri) | CRU (diri sendiri) | CRU (diri sendiri) | CRU (diri sendiri) | CRU (diri sendiri) | CRUD (approve/adjust) | - | - | R |
| **Operasional Cabang — Inventory (view sederhana)** `[B]` | CRUD | R | CRU (cabang sendiri) | R (view) | - | CRU (input movement, opname) | R | - | R | - | R |
| **Customer, Membership & Loyalty — Profile & CRM (penuh)** `[H]` | CRUD | CRU | R (cabang sendiri) | R (quick-lookup, field terbatas) | R (preference saja) | - | - | - | R | CRUD | R |
| **Customer, Membership & Loyalty — Segmentation & Engagement** `[H]` | CRUD | CRU | R | - | - | - | - | - | R | CRUD | R |
| **Customer, Membership & Loyalty — Membership & Loyalty config** `[H]` | CRUD | CRU | R | R (redemption trigger di POS) | - | - | - | - | R | CRUD | R |
| **Product, Inventory & Purchasing — Product & Service Master** `[H]` | CRUD | CRUD | R | R | R | R | R (matching PO) | - | R | R | R |
| **Product, Inventory & Purchasing — Inventory Management (penuh)** `[H untuk config, B untuk data]` | CRUD | CRU | **Approve** adjustment (U, cabang sendiri) | - | - | CR (create request, cabang sendiri) | R | - | R | - | R |
| **Product, Inventory & Purchasing — Purchasing & Supplier** `[H]` | CRUD | CRU | R (cabang sendiri) | - | - | R (menerima barang) | CRUD | - | R (untuk AP) | - | R |
| **Employee/HR — Master, Transfer, Kebijakan** `[H]` | CRUD | CRU | R (cabang sendiri, approve leave) | R (diri sendiri) | R (diri sendiri) | R (diri sendiri) | R (diri sendiri) | CRUD | R (payroll/komisi) | - | R |
| **Employee/HR — Rolling Schedule, Attendance data** `[B]` | CRUD | R | R (cabang sendiri) | R (jadwal sendiri) | R (jadwal sendiri) | - | - | CRUD | - | - | R |
| **Branch Management** `[H]` | CRUD | CRU | R (cabang sendiri) | - | - | - | - | - | R | - | R |
| **Promotion & Campaign — Company-wide rules** `[H]` | CRUD | CRU | R | R (terapkan di POS) | - | - | - | - | R | CRUD | R |
| **Promotion & Campaign — Promo Lokal Cabang** `[B]` | CRUD | R | CRU (cabang sendiri) | R (terapkan di POS) | - | - | - | - | R | R | R |
| **Finance — COA, Fiscal Closing, Bank Recon, Elimination** `[H]` | CRUD (append-only ledger) | R | - | - | - | - | - | - | CRUD (append-only) | R | R |
| **Finance — P&L/Cashflow/Neraca Konsolidasi** `[H]` | R | R | - | - | - | - | - | - | R | R | R |
| **Finance — P&L/Cashflow/Neraca per Cabang** `[B]` | R (semua cabang) | R | R (cabang sendiri) | - | - | - | - | - | R | R | R |
| **Dashboard & Analytics — Executive** `[H]` | R | R | - | - | - | - | - | - | R | R | R |
| **Dashboard & Analytics — Branch** `[B]` | R (semua cabang) | R | R (cabang sendiri) | - | - | - | - | - | R | R | R |
| **Settings — User/Role/Permission** `[H]` | CRUD | CRU | - | - | - | - | - | - | - | - | CRUD |
| **Settings — Audit Log** `[H]` | R (tidak bisa U/D) | R | R (cabang sendiri) | - | - | - | - | - | - | - | R (tidak bisa U/D, bahkan System Admin) |

## Catatan Penting untuk Implementasi

1. **Audit Log dan Journal Entry tidak bisa di-Update/Delete oleh siapapun**, termasuk
   System Admin — koreksi selalu berupa entry/jurnal baru.
2. **Approve ≠ Update biasa.** Refund/Void, Stock Adjustment, dan Leave Approval harus
   punya UI approval eksplisit (bukan toggle field di form biasa).
3. **Branch-scoping `[B]` di-enforce di RLS**, bukan cuma disembunyikan di UI —
   Branch Manager yang query cabang lain lewat API langsung tetap harus ditolak di
   level database policy.
4. **Scope `[H]` vs `[B]` menentukan di mana data hidup**, bukan cuma siapa yang akses.
   Data `[H]` (misal Chart of Accounts) didefinisikan sekali dan sama untuk semua
   cabang; data `[B]` (misal Cash In/Out) benar-benar terpisah per cabang di database.
5. Kolom di atas ini acuan awal — validasi ulang ke PRD Section 5 sebelum implementasi
   final, terutama kasus tepi (misal apakah Marketing/CRM boleh lihat data finance
   customer individual atau cuma agregat).
