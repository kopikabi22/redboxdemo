# RedBox ERP — Project Context Summary

*Dokumen ringkasan seluruh keputusan project sampai saat ini. Dipakai sebagai referensi tunggal untuk lanjutan diskusi, penawaran ke klien, maupun development.*

---

## 1. Apa Ini

**RedBox ERP** — sistem manajemen barbershop multi-cabang, dibangun custom untuk menggantikan MOKA POS. Bukan sekadar POS, tapi operating system penuh: POS + Appointment + CRM + Membership/Loyalty + HR + Inventory + Purchasing + Finance + (nanti) Marketplace + BI, dalam satu database dengan Branch sebagai dimensi utama.

**Brand: Redbox Barbershop, Cirebon** — berdiri sejak 2014. Website marketing sudah ada, theme dark/premium/maskulin (hitam + merah + aksen emas untuk layanan premium; font Bebas Neue/Playfair Display/Inter).

## 2. Fakta Bisnis Riil (dari analisis website marketing)

**5 cabang, lintas kota:**

| Cabang | Kota/Provinsi |
|---|---|
| Bypass | Cirebon, Jawa Barat |
| Samadikun | Cirebon, Jawa Barat |
| CSB Mall | Cirebon, Jawa Barat |
| Sumber | Kabupaten Cirebon, Jawa Barat |
| Tegal | Kota Tegal, Jawa Tengah |

→ Sistem harus siap multi-kota/multi-provinsi, bukan cuma multi-cabang satu kota.

**Membership:**
- Aktivasi sekali bayar Rp100.000, benefit seumur hidup (bukan berlangganan)
- 4 tier: Bronze → Silver → Gold → Platinum
- Rate poin: Rp10.000 belanja = 1 poin
- Ada program referral (bonus poin untuk pengajak & yang diajak)

**SUNDAZE** — konfirmasi ini yang dimaksud "sundae ala Redbox" (nav menu di website). Tetap di-skip dari scope, sesuai keputusan sebelumnya.

**Standar higienitas** (selling point marketing, bukan fitur sistem): 1 kip bersih/pelanggan, 1 handuk segar/kunjungan, 1 set alat steril/sesi. Belum di-scope, berpotensi jadi modul compliance kecil kalau diminta nanti.

## 3. Scope — 4 Tingkat (kumulatif, urut wajib dikerjakan)

| Tier | Isi | Durasi (solo dev) | Estimasi Harga |
|---|---|---|---|
| **1. Basic** | Branch, Product/Service, Customer DB, Attendance, Break Management, POS, Inventory dasar | 4–6 minggu | Rp 35–50 juta |
| **2. Lanjutan** | Appointment & Queue (termasuk Home Service & Wedding Grooming — lihat catatan di bawah), Membership & Loyalty, Customer Preference, Rolling Schedule, Expiry/FEFO, Promotion, Customer Reminder, Cashier Closing | 7–11 minggu | Rp 60–85 juta |
| **3. Advanced** | Purchasing & Supplier, Stock Opname/Transfer, Commission/Overtime/Performance HR, Finance (AP/AR/P&L), Branch Target, Audit log | 5–8 minggu | Rp 45–70 juta |
| **4. Komplit** | Analytics & BI, Customer Behavior Analytics (RFM/cohort/churn), Executive Dashboard | 4–7 minggu | Rp 35–55 juta |
| **Total** | | ~5,5–8 bulan | **Rp 175–260 juta** |

### Catatan: Home Service & Wedding Grooming masuk Tier 2 (Appointment & Queue), bukan modul terpisah

Kerangka dasarnya sama dengan appointment reguler (customer, barber, waktu, konfirmasi, reschedule/cancel, availability). Yang beda dan perlu ditambahkan di modul yang sama:

| Delta | Detail |
|---|---|
| Lokasi = alamat customer, bukan cabang | Butuh field alamat + validasi radius 5 KM dari cabang terdekat |
| Barber di-block dari jadwal cabang saat visit | Termasuk waktu perjalanan pergi-pulang |
| Satu booking, banyak orang | Family (min 2 orang), Wedding (sampai 4 orang groomsmen) — beda dari appointment biasa yang 1:1 |
| Pricing per-paket, bukan per-service | Single/Family/Gentleman/Silver/Gold/Platinum = bundel harga tetap |

Referensi harga paket (dari website, sudah ada, tinggal diinput ke sistem):
- Home Service: Single Rp250K/orang, Family Rp200K/orang (min 2 orang)
- Wedding Grooming: Gentleman 350K (1 orang) → Silver 500K (2) → Gold 750K (3) → Platinum 1 juta (4 orang)

Delta effort ini yang membuat estimasi Tier 2 naik dari 6–9 minggu / Rp55-75 juta menjadi 7–11 minggu / Rp60-85 juta.

### Catatan: Finance di-upgrade ke Full Accounting Rigor (bukan simplified reporting)

Diputuskan Finance module butuh **Chart of Accounts + double-entry journal** yang
proper (bukan sekadar nampilin angka revenue/expense), supaya P&L/Cashflow/Neraca
akurat dan bisa diaudit — konsekuensi dari bisnis multi-cabang yang butuh konsolidasi
lintas cabang yang benar.

Tambahan scope: Chart of Accounts, Journal Entry otomatis dari tiap transaksi, Fiscal
Period & Closing, Bank Reconciliation (cocokkan non-tunai + MDR fee), Deferred Revenue,
AP Aging Report, Expense Allocation, Inter-branch Elimination, Payroll Integration.

**Implikasi harga:** ini signifikan menambah kompleksitas teknis Tier 3 dari yang
sudah diestimasi (Rp45-70 juta / 5-8 minggu) — sistem akuntansi double-entry adalah
effort yang jauh lebih besar dari "tampilkan angka finansial". **Estimasi Tier 3 perlu
dihitung ulang** sebelum masuk ke dokumen penawaran final.

### Di luar scope sekarang

- **Marketplace integration** (Shopee/Tokopedia/TikTok Shop) — klien tetap pakai MOKA untuk ini sampai dibangun terpisah nanti, harga menyusul saat itu.
- **AI Layer (management side)** — churn prediction, forecasting, dll — future/optional sesuai PRD.
- **AI Grooming (customer-facing)** — fitur upload foto → analisis AI wajah untuk rekomendasi hairstyle/outfit/eyewear/skincare/personal color, sudah ada di website saat ini (member-only). Beda dari AI Layer di atas karena ini customer-facing dan butuh integrasi image-AI API terpisah. Belum di-scope — kemungkinan besar masuk kategori future/optional yang sama, kecuali klien minta prioritaskan.

## 4. Model Bisnis ke Klien

- One-time project fee (bukan langganan/SaaS)
- Dikerjakan sekaligus, Tier 1–4
- Dikerjakan solo/tim kecil (1–3 orang)
- Maintenance/hosting = biaya terpisah pasca-launch (tidak digratiskan)
- Pembanding: MOKA Enterprise Rp799rb/outlet/bulan = ~Rp9,6 juta/outlet/tahun, berulang selamanya, hanya modul POS

## 5. Tech Stack (Disepakati)

| Layer | Pilihan |
|---|---|
| Frontend | Next.js (React), PWA — installable di tablet kasir |
| Backend & Database | Supabase (Postgres + Auth + Realtime + Row Level Security) |
| Deployment | Vercel (frontend) + Supabase Cloud (backend) |
| Auth | Supabase Auth, role-based sesuai PRD Section 5 |
| Offline mode | Dibatasi ke POS transaction saja — transaksi disimpan lokal (IndexedDB) saat offline, auto-sync saat online kembali. Modul lain boleh butuh koneksi. |

**Alasan pilihan:** developer adalah vibe coder (tidak menulis/review kode manual), jadi stack dipilih yang paling banyak "dilatih" ke AI coding tools (ekosistem JS/Next.js) dan paling minim boilerplate backend (Supabase handle auth/RLS/realtime). Offline scope sengaja dipersempit ke POS saja karena full offline-sync semua modul adalah masalah teknis berat (conflict resolution) yang berisiko tinggi dikerjakan tanpa review kode manual.

## 6. Prinsip Arsitektur Wajib (dari PRD, non-negotiable)

- Branch = dimensi utama di semua tabel/transaksi, enforced di RLS level (bukan cuma application layer)
- Customer ID tunggal lintas semua modul
- Central Product/SKU Master untuk semua channel
- Historical price immutable — harga baru = record baru dengan effective_date
- Stock & loyalty pakai ledger (append-only), bukan overwrite
- Aksi sensitif (void, refund, price override, stock adjustment) wajib authorization + audit log
- Available Stock = On Hand − Reserved − komitmen lain
- State transitions inventory/payment harus transaksional (atomic)

## 7. Dokumen Pendukung

- `PRD_Barbershop_MultiBranch_Full_v1_0.docx` — PRD lengkap, acuan detail semua modul/business rules/data model/workflow
- `Pemetaan_Fitur_Barbershop_MultiBranch.md` — pemetaan fitur per tier
- `CLAUDE.md` — konteks project untuk Claude Code (development)

## 8. Status & Next Steps

- [x] PRD lengkap
- [x] Pemetaan fitur ke 4 tier
- [x] Estimasi harga per tier
- [x] Tech stack disepakati (Next.js + Supabase + Vercel)
- [x] Nama project: RedBox ERP
- [x] Analisis brand/website existing (5 cabang riil, membership detail, fitur tambahan ditemukan)
- [x] Home Service & Wedding Grooming dipastikan masuk Tier 2 (bukan modul/tier baru), estimasi disesuaikan
- [ ] Keputusan: AI Grooming (customer-facing) masuk scope atau tetap future/optional?
- [ ] Dokumen penawaran resmi ke klien
- [ ] Kesepakatan scope & tanda tangan
- [ ] Desain skema database inti (branch, customer, product, employee, order, inventory)
- [ ] Setup repo + CLAUDE.md di project
- [ ] Mulai development Tier 1 (Basic)
