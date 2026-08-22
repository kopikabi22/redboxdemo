# CLAUDE.md — RedBox ERP

Konteks project untuk Claude Code. Baca file ini setiap sesi sebelum mulai kerja.

**Nama project: RedBox ERP** (sistem manajemen barbershop multi-cabang, pengganti MOKA POS).

## Tentang Project Ini

Sistem manajemen barbershop multi-cabang: POS, Appointment, CRM, Membership/Loyalty,
Inventory, HR, Finance, (nanti) Marketplace & BI — semua dalam satu database dengan
Branch sebagai dimensi utama. Dibangun custom karena MOKA tidak menjawab kebutuhan
spesifik (rolling schedule, membership tier, inventory FEFO, Home Service/Wedding
Grooming radius-based booking, dll).

**Brand: Redbox Barbershop, Cirebon** — berdiri sejak 2014, 5 cabang lintas kota
(Bypass/Samadikun/CSB Mall/Sumber di Cirebon Jawa Barat, Tegal di Jawa Tengah).

**Struktur modul dikelompokkan berdasarkan 2 POV (Point of View)** — bukan flat 16
modul, dan bukan cuma domain bisnis, tapi **siapa yang pakai dan kapan**:
- **POV Karyawan** — operasional harian, dipakai di tablet kasir/lapangan (kasir, barber)
- **POV Manajemen** — back-office, dipakai HQ/Owner/Branch Manager/HR/Finance/Marketing

Lihat "POV & Module Tree" di bawah untuk detail lengkap. Pakai pengelompokan ini juga
sebagai acuan struktur folder codebase (misal `modules/pos-operasional/`,
`modules/admin-management/`).

**PENTING — data tetap satu, cuma UI/surface yang beda:** Customer (dan entitas lain
yang dipakai lintas POV) tetap SATU tabel/satu source of truth di database. POV cuma
menentukan tampilan/akses mana yang dibuka ke siapa — misal Customer Quick-Lookup di
POS cuma query ringan (nama/tier/poin) dari tabel Customer yang sama dengan yang dibuka
penuh di CRM admin view. JANGAN bikin 2 tabel customer terpisah untuk 2 POV ini.

**Selalu cek bagian "Functional Requirements per POV" dan "Business Rules" di bawah
sebelum implement modul baru** — jangan menebak business rule.

## Reference Documents (baca file terpisah ini SESUAI KEBUTUHAN, bukan tiap sesi)

Dokumen di bawah ini SENGAJA tidak ditulis inline di CLAUDE.md ini supaya file ini
tetap ringkas dan cepat dibaca tiap sesi. Semua ada di folder `docs/` — buka file yang
relevan cuma saat task-nya benar-benar butuh:

| File | Kapan dibaca |
|---|---|
| `docs/PRD_Barbershop_MultiBranch_Full_v1_0.docx` | Butuh detail requirement/business rule spesifik yang tidak ada ringkasannya di CLAUDE.md ini |
| `docs/ERD_RedBoxERP.mermaid` | Sebelum bikin/ubah migration SQL, atau butuh lihat relasi antar tabel |
| `docs/Data_Dictionary_RedBoxERP.md` | Bikin migration — butuh tipe data, nullable, default, constraint per kolom |
| `docs/UML_ClassDiagram_RedBoxERP.mermaid` | Desain method/service layer, butuh lihat behavior (bukan cuma struktur data) tiap entity |
| `docs/RBAC_CRUD_Matrix.md` | Implement middleware/policy akses — role mana boleh apa di modul mana |
| `docs/Sitemap_UXFlow_RedBoxERP.mermaid` | Versi visual dari section "Route & UX Flow" di bawah — sama isinya, cuma buat presentasi non-teknis, BUKAN sumber kebenaran (ASCII tree di bawah tetap acuan utama) |
| `docs/UseCase_Diagram_RedBoxERP.mermaid` | Butuh peta lengkap aktor × fitur |
| `docs/Activity_Diagram_POS_Transaksi.mermaid` | Implement alur transaksi POS step-by-step |
| `docs/Activity_Diagram_Attendance.mermaid` | Implement alur clock-in/out/break |
| `docs/Flowchart_Login_ModuleAccess.mermaid` | Implement routing/auth guard berdasarkan role |
| `docs/RedBox_ERP_Project_Context.md` | Butuh konteks bisnis/pricing/keputusan project (bukan teknis) |
| `docs/Pemetaan_Fitur_Barbershop_MultiBranch.md` | Butuh detail fitur per tier (Basic/Lanjutan/Advanced/Komplit) |

**JANGAN nebak isi file-file ini** — kalau task menyentuh salah satu area di atas,
buka filenya dulu sebelum nulis kode.

---

## Urutan Pengerjaan (JANGAN loncat urutan tanpa alasan)

1. **Tier 1 - Basic**: Branch, Product/Service, Customer DB, Attendance, Break
   Management, POS, Inventory dasar
2. **Tier 2 - Lanjutan**: Appointment & Queue (termasuk Home Service & Wedding
   Grooming), Membership & Loyalty, Customer Preference, Rolling Schedule,
   Expiry/FEFO, Promotion, Customer Reminder, Cashier Closing
3. **Tier 3 - Advanced**: Purchasing & Supplier, Stock Opname/Transfer,
   Commission/Overtime/Performance HR, Finance (AP/AR/P&L), Branch Target, Audit log
4. **Tier 4 - Komplit**: Analytics & BI, Customer Behavior Analytics, Executive Dashboard

**Tidak termasuk scope sekarang**: Marketplace integration (Shopee/Tokopedia/TikTok
Shop — klien tetap pakai MOKA untuk ini), AI Layer (management side), AI Grooming
(customer-facing, upload foto → rekomendasi hairstyle). Jangan bangun ini kecuali
diminta eksplisit.

---

## Tech Stack

- **Frontend**: Next.js (React), dibangun sebagai PWA (installable di tablet kasir).
- **Deployment**: Vercel (frontend/Next.js) + Supabase Cloud (backend/database).
- **Backend & Database**: Supabase (Postgres + Auth + Realtime + Row Level Security).
  Pakai RLS untuk branch-scoping — JANGAN filter branch cuma di application layer,
  harus di-enforce di level database policy juga (defense in depth).
- **Auth**: Supabase Auth, role-based (Owner/HQ/Branch Manager/Cashier/Barber/
  Warehouse/Purchasing/HR/Finance/Marketing/System Admin — lihat "User Roles" di bawah).
- **Offline mode — SCOPE DIBATASI**: hanya modul **POS transaction** yang wajib tetap
  jalan tanpa internet. Caranya: transaksi disimpan dulu ke IndexedDB browser saat
  offline, lalu auto-sync ke Supabase begitu koneksi kembali. Modul lain (appointment,
  HR, reporting, dst) boleh mensyaratkan koneksi internet — JANGAN coba bikin semua
  modul full offline-sync, itu di luar scope dan berisiko tinggi untuk vibe coding.
- **Vibe coding context**: developer (Anda) tidak menulis/review kode baris-per-baris
  secara manual. Karena itu Claude Code harus: (1) lebih konservatif — pilih pola yang
  sudah terbukti/umum dipakai daripada solusi eksotis, (2) selalu jelaskan di bahasa
  natural apa yang diubah dan kenapa sebelum/sesudah edit besar, (3) tulis test untuk
  logic yang menyentuh uang/stock, karena itu yang paling mahal kalau salah dan paling
  sulit dideteksi tanpa membaca kode.

---

## Design System / UI

Seluruh aplikasi (internal POS/admin maupun customer-facing nanti) pakai **satu tema
konsisten** — dark-premium sesuai brand Redbox Barbershop, bukan tema netral terpisah
untuk internal. Diambil dari website marketing yang sudah ada.

**Warna:**
- Background dasar: `#0A0A0A` / `#08060a` (hitam pekat)
- Surface/card: `#1A1A1C` (abu gelap, sedikit lebih terang dari background)
- Aksen utama (brand): merah — `#C1121F`, `#E63946`, `#FF6B4A`
- Aksen premium/khusus (misal highlight promo, tier tertinggi membership, badge
  penting): emas — `#D4A017`, `#F59E0B`
- Teks: putih/abu terang di atas dark background, bukan hitam di atas putih

**Font:**
- Heading besar/display: Bebas Neue (bold, kapital, gaya "barbershop klasik")
- Aksen elegan (opsional, misal judul section premium): Playfair Display /
  Cormorant Garamond, italic
- Body text/UI umum: Inter

**Catatan ergonomis — WAJIB diperhatikan karena ini dipakai staff berjam-jam:**
- Dark theme untuk internal POS/admin sudah disepakati, TAPI kontras teks-background
  harus tetap tinggi (jangan abu-gelap di atas hitam — pastikan WCAG AA minimum)
  supaya tidak melelahkan mata kasir yang lihat layar seharian.
- Angka-angka penting di POS (total harga, kembalian) harus besar & kontras tinggi,
  jangan dikorbankan demi estetika dark/minimalis.
- State penting (error, stock habis, transaksi gagal) pakai warna yang jelas beda dari
  merah brand (misal orange/kuning untuk warning, supaya tidak tertukar dengan aksen
  brand yang juga merah).

**Referensi:** kalau perlu detail lebih lengkap (spacing, komponen, dsb), pakai skill
`frontend-design` saat mulai build UI — jangan menebak dari file ini saja.

---

## User Roles

| Role | Primary Access |
|---|---|
| Owner/CEO | Semua cabang, dashboard, BI, finance |
| HQ/Admin | Master data dan governance |
| Branch Manager | Operasional cabang sendiri |
| Cashier | POS, customer lookup, closing |
| Barber | Appointment, customer preference, service history |
| Warehouse | Inventory, transfer, opname |
| Purchasing | Supplier, PR, PO, receiving |
| HR | Employee, attendance, schedule |
| Finance | Cash, revenue, expense, AP/AR, P&L |
| Marketing/CRM | Customer, campaign, loyalty, analytics |
| System Admin | User, role, integration, security |

---

## POV & Module Tree

Struktur ini dipilih berdasarkan **siapa yang pakai dan kapan**, bukan cuma domain
data. POV Karyawan = layar operasional harian (tablet kasir/lapangan). POV Manajemen =
back-office/admin, dipakai HQ/Owner/Branch Manager/HR/Finance/Marketing.

```
POV KARYAWAN — 1 MODUL TERPADU "OPERASIONAL CABANG"
(bukan 5 modul terpisah — satu modul, beberapa tab, akses tab beda per role)
│
│   Otomatis ter-scope ke branch_id dari Employee yang login — TIDAK ADA pilihan
│   cabang manual di layar manapun di sini.
│
├── Tab: POS                        [Kasir: ✓] [Barber: ✗]
│   ├── New Transaction (service + product, tambah customer, barber, diskon, poin, pajak)
│   ├── Customer Quick-Lookup (bagian dari New Transaction, BUKAN CRM penuh)
│   │   └── Ketik nomor HP → tampil nama/tier/sisa poin. Belum member → daftar cepat.
│   ├── Save Bill (hold/retrieve)
│   ├── Payment (cash, QRIS, debit, transfer, e-wallet, split)
│   ├── Refund/Void (butuh otorisasi dari atasan — lintas POV, lihat catatan di bawah)
│   └── Cash In/Out (riwayat transaksi masuk otomatis + catatan cash keluar manual)
│
├── Tab: APPOINTMENT & QUEUE        [Kasir: ✓] [Barber: ✓ — lihat jadwal sendiri]
│   ├── Calendar (lihat jadwal harian/mingguan, filter barber)
│   ├── Booking (buat/reschedule/cancel booking customer)
│   ├── Queue (nomor antrian, waktu tunggu, assign barber)
│   ├── Walk-In (registrasi langsung + antri)
│   ├── Check-in (customer datang sesuai booking)
│   └── No Show (tandai + catat alasan)
│       └── (+ Home Service & Wedding Grooming booking — radius, multi-orang, pricing paket)
│
├── Tab: ATTENDANCE & BREAK         [Kasir: ✓] [Barber: ✓ — HANYA tab ini yang muncul]
│   ├── Clock in/out sendiri (PIN/Face Recognition)
│   └── Mulai/selesai istirahat sendiri
│
├── Tab: INVENTORY (operasional)    [Kasir: ✓] [Barber: ✗]
│   ├── Tampilan status stok sederhana (cukup/rendah/habis)
│   ├── Auto-deduct saat POS transaksi jalan
│   └── Tombol "Stock Opname" (pojok kanan atas) → form opname sederhana
│
└── Tab: CASHIER CLOSING            [Kasir: ✓] [Barber: ✗]
    └── Reconciliation akhir shift (expected vs actual per metode bayar)


POV MANAJEMEN (Back-office — Owner/HQ/Branch Manager/HR/Finance/Marketing)
│
├── CUSTOMER, MEMBERSHIP & LOYALTY (gabung 1 domain)
│   ├── Customer Profile & CRM
│   │   ├── Customer Profile (kontak, consent, favorite barber/branch/service)
│   │   ├── Customer 360 View (satu layar gabungan: transaksi + appointment +
│   │   │   membership + poin + preference — bukan 4 tab terpisah)
│   │   ├── Visit History (first/last visit, interval, frekuensi, lintas-cabang)
│   │   ├── Customer Preference (gaya potongan, preferensi grooming/produk)
│   │   ├── Duplicate Detection & Merge (customer sering kedaftar 2x — nomor HP
│   │   │   beda/ganti — tanpa ini data kotor dan segmentasi jadi salah)
│   │   ├── Complaint/Feedback Log (jejak komplain tercatat di sistem, bukan
│   │   │   cuma di WhatsApp personal staff)
│   │   └── Customer Activity Timeline
│   ├── Segmentation & Engagement
│   │   ├── Segmentation (RFM, lifecycle, member status, spend)
│   │   ├── Dormant/At-Risk Flag (rule-based sederhana, misal "belum kunjung
│   │   │   60 hari" — actionable tanpa perlu nunggu model RFM di Tier 4)
│   │   ├── Reminder Campaign (next visit, birthday, inactive)
│   │   └── Consent & Communication Preference (channel favorit WA/SMS/email +
│   │       cap frekuensi — modul eksplisit dari business rule yang sudah ada)
│   └── Membership & Loyalty
│       ├── Membership Tier Rules (Bronze/Silver/Gold/Platinum)
│       ├── Point Rules (rate, expiry, adjustment)
│       ├── Reward Catalog & Redemption Approval
│       └── Referral Program (rules + tracking siapa mengajak siapa, bukan
│           cuma rules doang)
│
├── PRODUCT, INVENTORY & PURCHASING (gabung 1 domain)
│   ├── Product & Service Master
│   │   ├── Service (master, kategori, durasi, pricing, komisi)
│   │   ├── Product (SKU, kategori, brand, variant, harga per branch/tier, barcode)
│   │   └── Product-Service Linkage (BOM — konsumsi produk per service, misal
│   │       pomade/shampoo terpakai per haircut, bukan cuma penjualan retail)
│   ├── Inventory Management
│   │   ├── Stock Opname & Variance (+ alur investigasi kalau selisih besar,
│   │   │   bukan cuma catat selisih lalu selesai)
│   │   ├── Stock Adjustment (dengan otorisasi)
│   │   ├── Stock Transfer antar-cabang (status in-transit eksplisit — barang
│   │   │   jangan hilang di "limbo" saat lagi dikirim)
│   │   ├── Return/Write-off Barang Rusak (jalur terpisah dari adjustment biasa,
│   │   │   dicatat sebagai expense/kerugian)
│   │   ├── Expiry Management (FEFO), Low Stock & Reorder Point config
│   │   ├── Stock Aging / Slow-moving report
│   │   └── Warehouse/Location Management
│   └── Purchasing & Supplier
│       ├── Supplier Master & Terms
│       ├── Purchase Request (auto-suggest dari reorder point + histori konsumsi,
│       │   bukan hitung manual)
│       ├── Purchase Order (approval)
│       ├── Receiving (match ke PO: quantity, batch, expiry)
│       ├── Return to Supplier (barang cacat saat diterima)
│       └── Purchase History & Supplier Performance
│
├── EMPLOYEE / HR (scope campuran — lihat tanda [Holding]/[Branch])
│   ├── Employee Master [Holding] — identitas pusat, karyawan bisa pindah cabang
│   ├── Employee Transfer antar-cabang [Holding]
│   ├── Kebijakan HR company-wide (aturan cuti, skema komisi standar) [Holding]
│   ├── Kalender hari libur nasional [Holding]
│   ├── Barber Skills/Eligibility [Branch] — assignment lokal
│   ├── Shift Template & Rolling Schedule (+ conflict detection) [Branch] —
│   │   kebutuhan coverage tiap cabang beda
│   ├── Attendance & Break (data mentah) [Branch] — fisik di cabang tertentu
│   ├── Day-Off, Leave/Permission (approval oleh Branch Manager) [Branch]
│   ├── Overtime & Commission Calculation [Branch], roll-up ke [Holding] reporting
│   └── Performance & Productivity Review [Branch], roll-up ke [Holding] reporting
│
├── BRANCH MANAGEMENT
│   ├── Branch Master & Configuration
│   ├── Branch Target
│   ├── Operating Hours/Holiday
│   └── Branch Performance Comparison
│
├── PROMOTION & CAMPAIGN (scope campuran — lihat tanda [Holding]/[Branch])
│   ├── Discount & Voucher Rules company-wide [Holding]
│   ├── Brand Campaign (multi-channel, budget besar) [Holding]
│   ├── Bundle/Package standar brand [Holding]
│   ├── Referral Program Rules [Holding]
│   ├── Birthday Promotion (benefit standar) [Holding]
│   ├── Promo Lokal Cabang (misal "grand opening Cabang Tegal") [Branch]
│   ├── Flash Sale sesuai kondisi cabang tertentu [Branch]
│   └── Tracking hasil campaign per cabang (eksekusi lokal, rule dari Holding) [Branch]
│
├── FINANCE, DASHBOARD & ANALYTICS (digabung sesuai arahan — satu domain "melihat
│   │   angka"; scope campuran — lihat tanda [Holding]/[Branch])
│   ├── Chart of Accounts (COA) [Holding] — didefinisikan sekali, dipakai semua cabang
│   ├── Journal Entry (Otomatis) [Branch asal transaksi] — tiap transaksi generate
│   │   jurnal, tapi COA-nya tetap satu standar dari Holding
│   ├── Fiscal Period & Closing [Holding] — closing period berlaku company-wide
│   ├── Cash In / Cash Out [Branch] — harian per cabang
│   ├── Review Cashier Closing (semua cabang) [Holding melihat lintas-Branch]
│   ├── Bank Reconciliation [Holding] — biasanya disentralisasi
│   ├── Revenue & Expense [Branch] — lokal per cabang (sewa, listrik, dll), roll-up
│   │   ke [Holding]
│   ├── Expense Allocation [Holding] — biaya overhead HQ dialokasikan ke tiap cabang
│   ├── Deferred Revenue [Branch asal transaksi]
│   ├── Accounts Payable (+ Aging Report) [Holding] — kalau pembayaran supplier
│   │   disentralisasi
│   ├── Accounts Receivable [Branch/Holding tergantung kasus]
│   ├── Inter-branch Elimination [Holding] — cuma relevan saat konsolidasi
│   ├── Payroll Integration [Branch asal, roll-up ke Holding]
│   ├── Profit & Loss — **per cabang [Branch] DAN konsolidasi [Holding]**, budget vs
│   │   actual, MoM/YoY — Owner harus bisa lihat KEDUANYA, drill-down per cabang
│   │   maupun gabungan semua cabang
│   ├── Cashflow — **per cabang [Branch] DAN konsolidasi [Holding]**, plus proyeksi
│   ├── Neraca (Balance Sheet) — **per cabang [Branch] DAN konsolidasi [Holding]**
│   ├── Executive Dashboard [Holding] — konsolidasi semua cabang
│   ├── Branch Dashboard [Branch] — drill-down satu cabang spesifik
│   ├── Sales / Customer / Operational Dashboard [Branch, roll-up Holding]
│   └── Analytics & BI (Tier 4): RFM, cohort, churn risk, top product/service, barber performance
│
└── SETTINGS
    ├── User, Role, Permission
    ├── Tax, Payment Method, Receipt Template
    ├── Notification & Integration Settings
    └── Audit Log & System Configuration


(E-COMMERCE & MARKETPLACE — TIDAK DALAM SCOPE SEKARANG, akan jadi domain terpisah nanti)
```

**Barber login**: dapat 2 tab — "Appointment & Queue" (lihat jadwal sendiri) dan
"Attendance & Break" — tab lain (POS, Inventory, Cashier Closing) disembunyikan/
di-disable untuk role Barber. Secara teknis tetap 1 route/module yang sama, cuma
role-based tab visibility (jangan bikin routing/module terpisah khusus Barber).

**Catatan lintas-POV (bukan bug, memang disengaja):**
- **Appointment/Booking harian** dipakai kasir (POV Karyawan), tapi **jadwal/Rolling
  Schedule barber** dikonfigurasi HR (POV Manajemen). Karyawan pakai jadwal yang sudah
  dibuat, tidak membuatnya sendiri.
- **Refund/Void** terjadi di titik POS (POV Karyawan) tapi wajib approval atasan
  (Branch Manager/HQ, POV Manajemen) — treat sebagai aksi karyawan yang butuh otorisasi
  lintas-POV, bukan murni satu sisi. Approval flow harus explicit di UI, jangan
  cuma checkbox.

---

## Route & UX Flow (POV Karyawan — sudah dievaluasi, JANGAN diubah tanpa konfirmasi)

Struktur route ini hasil review UX detail. Ikuti persis, karena tiap keputusan di sini
sudah melalui evaluasi eksplisit (bukan asumsi default).

```
/ (root)
│
├── /login                          → Landing + session check
│                                      Sudah login & session valid → langsung redirect ke /home
│                                      Belum login → form login (PIN/credential)
│
└── /home                           → Routing beda per ROLE (BUKAN semua role dapat
    │                                  launcher kotak-kotak — cuma yang modulnya banyak)
    │                                  Untuk POV Karyawan: SELURUH akses di bawah ini
    │                                  auto ter-scope ke branch_id dari data Employee
    │                                  yang login — TIDAK ADA pilihan cabang manual.
    │
    ├── Kasir        → LANGSUNG ke /pos/new (skip launcher). Ini bagian dari 1 modul
    │                   terpadu "Operasional Cabang" — navigasi antar tab pakai
    │                   tab/bottom-nav: [POS] [Appointment & Queue] [Attendance &
    │                   Break] [Inventory] [Cashier Closing]
    ├── Barber       → LANGSUNG ke /appointment/queue (skip launcher). Bagian dari
    │                   modul "Operasional Cabang" yang sama, TAPI cuma tab
    │                   [Appointment & Queue] [Attendance & Break] yang muncul —
    │                   tab lain (POS, Inventory, Closing) disembunyikan untuk role ini
    ├── Branch Manager/SPV → Module Launcher (kotak-kotak):
    │                   [Operasional Cabang (POS/Appointment/Attendance/Inventory/
    │                   Closing)] [Cashier Closing Review] ← operasional cabang
    │                   sendiri + otoritas approval (refund/void, leave request)
    ├── Owner/HQ     → Module Launcher (kotak-kotak): SEMUA modul
    │                   (POV Karyawan + POV Manajemen, semua cabang)
    │
    ├── ============ POV KARYAWAN — 1 MODUL TERPADU "OPERASIONAL CABANG" ============
    │
    ├── /pos
    │   ├── /pos/new                → Transaksi baru
    │   │   ├── Pilih Konsumen:
    │   │   │   ├── Member    → cari dari daftar member terdaftar (search nama/HP)
    │   │   │   │               → tampil nama, tier, sisa poin
    │   │   │   └── Guest     → input nomor HP (WAJIB, untuk tracking), TANPA proses
    │   │   │                    aktivasi member (beda dari daftar jadi member yang
    │   │   │                    bayar Rp100.000). Nomor HP jadi identifier — kalau
    │   │   │                    nanti upgrade jadi member, histori transaksi guest
    │   │   │                    tetap nyambung (Customer ID tunggal, bukan mulai 0)
    │   │   ├── Tambah item         → service DAN produk retail dalam satu keranjang
    │   │   ├── Keranjang           → TANPA tombol nominal uang besar di keranjang
    │   │   └── Bayar                → tekan "Bayar" → POPUP nominal + metode bayar
    │   │
    │   └── /pos/cash               → gabungan (BUKAN "shift" terpisah)
    │       ├── Riwayat Transaksi Masuk   (log otomatis dari tiap transaksi)
    │       └── Catatan Cash Keluar       (input manual: pengeluaran kecil cabang)
    │       (TIDAK ADA tombol "Tutup Shift" di sini — itu sudah jadi bagian
    │        Cashier Closing di /closing, jangan dobel)
    │
    ├── /appointment
    │   ├── /appointment/queue      → TABEL: baris = jam, kolom = barber
    │   │                              (langsung kelihatan jam kosong per barber)
    │   ├── /appointment/booking    → buat booking reguler baru
    │   ├── /appointment/walk-in    → registrasi walk-in + masuk antrian
    │   ├── /appointment/checkin    → check-in booking yang sudah ada
    │   └── /appointment/home-wedding → LIST appointment Home Service & Wedding
    │                                   Kolom: Nama konsumen, Alamat, Jenis
    │                                   (Home/Wedding), Waktu, Barber assigned
    │
    ├── /attendance
    │   ├── /attendance/clock-in    → WAJIB PIN atau Face Recognition
    │   ├── /attendance/break       → mulai/selesai istirahat (self-service)
    │   └── /attendance/clock-out   → WAJIB PIN atau Face Recognition
    │                                  Sistem enforce konfirmasi via POS sebelum sesi
    │                                  karyawan ditutup. CATATAN REALISTIS: ini cuma
    │                                  bisa berupa aturan proses + reminder/alert di
    │                                  sistem (misal notifikasi kalau shift lewat tapi
    │                                  belum clock-out) — sistem TIDAK BISA menahan
    │                                  orang secara fisik keluar kantor.
    │
    ├── /inventory                  → Operasional, SEDERHANA (BUKAN tabel harga/qty
    │   │                              dengan tombol +/- stepper angka)
    │   ├── Tampilan: nama bahan + status stok (cukup/rendah/habis) — visual,
    │   │              bukan angka mentah
    │   ├── Auto-deduct saat POS transaksi jalan (tidak perlu input manual)
    │   └── Tombol "Stock Opname" (pojok kanan atas) → form opname sederhana
    │
    └── /closing                    → Cashier Closing (akhir shift/hari)
                                       Reconciliation expected vs actual
```

**POV Manajemen: route BELUM didesain** — akan dirombak total, strukturnya menyusul
setelah landing page & breakdown POV Manajemen didiskusikan terpisah. Jangan asumsikan
struktur POV Karyawan di atas otomatis berlaku sama untuk POV Manajemen.

---

## Functional Requirements per POV (ringkas dari PRD)

### POV Karyawan

**POS**: New Transaction (service/product dalam satu keranjang, pilih konsumen
member-atau-guest, barber, discount, voucher, points, tax, split payment via popup
saat bayar) · Save Bill (hold/retrieve) · Refund/Void (trigger di sini, approval di
POV Manajemen) · Payment (cash, QRIS, debit, credit, transfer, e-wallet, split) ·
Cash In/Out (riwayat transaksi masuk otomatis + catatan cash keluar manual — BUKAN
konsep "shift terpisah", lihat Route & UX Flow).

**Appointment & Queue**: Calendar (day/week, branch/barber filter) · Booking (customer,
service, barber, time, duration, confirmation, reschedule/cancel) · Queue (nomor, waktu
tunggu, assignment, status) · Walk-In (registrasi & antrian langsung) · Check-in · No
Show (status, alasan, histori, optional penalty).

**Home Service & Wedding Grooming (delta dari Appointment reguler):**
| Delta | Detail |
|---|---|
| Lokasi = alamat customer, bukan cabang | Field alamat + validasi radius 5 KM dari cabang terdekat |
| Barber di-block dari jadwal cabang saat visit | Termasuk waktu perjalanan pergi-pulang |
| Satu booking, banyak orang | Family (min 2 orang), Wedding (sampai 4 orang groomsmen) |
| Pricing per-paket, bukan per-service | Single/Family/Gentleman/Silver/Gold/Platinum = bundel harga tetap |

Referensi harga paket: Home Service Single Rp250K/orang, Family Rp200K/orang (min 2) ·
Wedding Gentleman 350K (1 orang) → Silver 500K (2) → Gold 750K (3) → Platinum 1 juta (4).

**Attendance & Break**: Clock in/out, mulai/selesai istirahat — self-service oleh
karyawan, direview di POV Manajemen.

**Inventory (operasional)**: Tampilan status stok sederhana (cukup/rendah/habis) —
BUKAN tabel harga/qty dengan tombol stepper angka · Auto-deduct saat transaksi POS
berjalan (tidak perlu input manual) · Stock Opname sederhana (tombol pojok kanan atas)
· Lihat alert stok rendah/mendekati expired — TIDAK bisa adjustment penuh (itu POV
Manajemen, butuh otorisasi).

**Cashier Closing**: Reconciliation expected vs actual per metode pembayaran di akhir
shift, direview ulang di POV Manajemen (Finance).

### POV Manajemen

**Customer, Membership & Loyalty** (gabung 1 domain — tier & poin adalah alat retensi
customer, bukan modul terpisah dari CRM): Customer database & Customer ID tunggal
(SATU tabel yang sama dipakai Quick-Lookup di POS) · Profile (kontak, consent, favorite
barber/branch/service/product) · **Customer 360 View** (satu layar: transaksi +
appointment + membership + poin + preference) · History (transaksi, appointment,
produk, service, komplain) · Visit History (first/last visit, interval, frekuensi) ·
Preference (gaya potongan, preferensi grooming/produk) · **Duplicate Detection &
Merge** · **Complaint/Feedback Log** · Segmentation (RFM, lifecycle, member status,
spend) · **Dormant/At-Risk Flag** (rule-based sederhana, tidak perlu tunggu Tier 4) ·
Reminder (next visit, birthday, inactive, appointment) · **Consent & Communication
Preference** (channel, cap frekuensi) · Activity timeline · Registrasi & validity
membership · Tier rules & benefits (Bronze → Silver → Gold → Platinum) · Point
earning/balance/expiry/adjustment (rate: Rp10.000 = 1 poin) · Reward catalog &
redemption approval · Loyalty ledger lengkap & redemption analytics · Aktivasi sekali
bayar Rp100.000, benefit seumur hidup · **Referral** (rules + tracking siapa mengajak
siapa, bukan cuma rules).

**Product, Inventory & Purchasing** (gabung 1 domain — alur natural "apa yang
dijual/dipakai → berapa stoknya → kapan harus beli lagi"):
Service master & kategori · Pricing per branch/channel/tier dengan effective date ·
Duration & buffer · Commission (fixed/percentage) · Package & bundle · SKU master,
kategori, brand, unit, cost, selling price · Variant management · Barcode generation &
scanning · **Product-Service Linkage (BOM)** — konsumsi produk per service, supaya
stok pomade/shampoo dsb terpotong otomatis saat service terjual, bukan cuma dari
penjualan retail · On-hand/reserved/available stock · Stock movement ledger · Stock
opname & variance (dengan alur investigasi untuk selisih besar) · Controlled stock
adjustment · Inter-branch transfer (status in-transit eksplisit) · **Return/Write-off
barang rusak** (dicatat sebagai expense, terpisah dari adjustment biasa) ·
Batch/expiry/near-expiry/expired (FEFO) · Minimum stock & **reorder point** config ·
Stock aging & slow-moving · Warehouse/location management · Supplier master & terms ·
**Purchase Request auto-suggest** dari reorder point + histori konsumsi · Purchase
Order approval · Receiving (quantity, batch, expiry) · **Return to Supplier** (barang
cacat saat diterima) · Invoice matching & due date · Purchase history & supplier
performance.

**Employee/HR**: Employee master · Barber skills/service eligibility · Cashier
assignment · Shift templates & roster · Rolling schedule & conflict detection (harus
respect minimum barber coverage) · Day-off, Leave/permission approval · Overtime ·
Commission calculation · Performance & productivity review.

**Branch Management**: Branch master · Local configuration · Target · Operating
hours/holiday · Performance comparison antar cabang.

**Promotion & Campaign**: Discount rules · Voucher rules · Campaign (audience, channel,
budget, result) · Bundle/package · Referral · Birthday promotion.

**Finance, Dashboard & Analytics** (digabung — "satu tempat lihat semua angka",
**full accounting rigor — bukan simplified reporting**):
Chart of Accounts (COA) sebagai fondasi · Journal Entry otomatis dari setiap transaksi
operasional (POS, purchasing, payroll, refund) — Finance TIDAK input manual ulang ·
Fiscal Period & Closing (tutup buku bulanan) · Daily cash review · Cashier closing
reconciliation review (semua cabang) · Bank Reconciliation (cocokkan non-tunai dengan
settlement gateway + MDR fee) · Revenue by branch/channel/item/payment · Deferred
Revenue (pembayaran di muka, misal Wedding Grooming) · Expense · AP (+ Aging Report
30/60/90 hari) · AR · Expense Allocation (biaya HQ ke cabang) · Inter-branch
Elimination (stock transfer tidak dobel-hitung) · Payroll Integration (komisi dari HR
otomatis jadi expense) · P&L & margin per branch dan konsolidasi (budget vs actual,
MoM/YoY) · Cashflow (posisi + proyeksi) · Neraca (Balance Sheet) ·
Executive/Branch/Sales/Customer/Operational Dashboard · Analytics & BI (Tier 4,
prioritas rendah): Sales/Product/Service Analytics, Customer Behavior (RFM, cohort,
churn risk, next visit), Barber/Branch/Inventory Analytics.

**Settings**: User, Role, Permission · Tax · Payment methods · Receipt template ·
Notifications · API/integration settings · Audit log · System configuration.

---

## Core Business Rules (dari PRD Section 9 — non-negotiable)

1. Setiap transaksi punya transaction ID, branch ID, channel, timestamp, cashier/user,
   status.
2. Setiap produk punya SKU sentral unik.
3. Aksi yang mengubah inventory wajib membuat stock movement record.
4. Refund membalikkan efek stock, revenue, loyalty, dan commission yang berlaku.
5. Service yang sudah dibayar lunas jadi basis komisi (kecuali dikonfigurasi lain).
6. Harga transaksi historis immutable; harga baru pakai effective date.
7. Void, refund, price override, stock adjustment, dan perubahan permission wajib
   otorisasi.
8. Cashier closing membandingkan expected vs actual per metode pembayaran.
9. Rolling schedule wajib respect minimum barber coverage.
10. Komunikasi customer wajib respect consent & batas frekuensi.
11. Setiap transaksi finansial WAJIB generate journal entry berimbang (debit = kredit)
    sesuai Chart of Accounts — tidak ada angka finansial yang muncul di P&L/Cashflow/
    Neraca tanpa jejak jurnal yang bisa ditelusuri baliknya (audit trail penuh).
12. Fiscal period yang sudah di-closing tidak boleh diubah — koreksi pakai jurnal
    penyesuaian di periode berjalan, bukan edit balik periode lama.

## Prinsip Arsitektur Wajib (non-negotiable)

- **Branch adalah dimensi utama.** Hampir semua tabel (order, inventory, employee,
  appointment) harus punya `branch_id` dan query harus branch-scoped sesuai role user.
- **Customer ID tunggal.** Satu customer punya satu identitas di seluruh modul
  (POS, appointment, membership, marketplace nanti) — lintas POV Karyawan/Manajemen.
- **Central Product/SKU Master.** Satu produk = satu SKU pusat, dipakai semua channel.
- **Historical price immutable.** Jangan pernah update harga transaksi lama. Harga baru
  = record baru dengan `effective_date`.
- **Ledger, bukan overwrite.** Stock movement dan loyalty point harus dicatat sebagai
  ledger (append-only), bukan cuma update angka akhir. Ini basis audit trail.
- **Aksi sensitif wajib authorization + audit log**: void, refund, price override,
  stock adjustment, role/permission change. Audit log minimum field: event_id,
  timestamp, actor/user_id, branch_id, action, entity, entity_id, before/after value.
- **Available Stock = On Hand − Reserved − komitmen lain.** Jangan hardcode logic ini
  di banyak tempat — satu fungsi/service, dipakai ulang.
- **State transitions transaksional.** Inventory dan payment state change harus atomic
  (pakai DB transaction) — kegagalan API eksternal tidak boleh corrupt state lokal.
- **Scope Holding vs Branch (eksplisit, bukan cuma branch_id).** Selain branch sebagai
  dimensi utama di tiap transaksi, beberapa entitas/konfigurasi punya *scope* yang
  jelas: **Holding** (company-wide, didefinisikan sekali di HQ, berlaku semua cabang —
  misal Chart of Accounts, Employee Master, Discount rules company-wide, Branch Master
  itu sendiri) vs **Branch** (lokal, milik satu cabang — misal Cash In/Out harian,
  Rolling Schedule, Cashier Closing, Promo lokal cabang tertentu). Tandai tiap
  data/tabel dengan scope ini dari awal desain skema, JANGAN campur logic Holding dan
  Branch di tabel/fungsi yang sama. Owner/HQ harus bisa lihat performa **per-branch**
  (drill-down satu cabang) MAUPUN **konsolidasi Holding** (semua cabang digabung) —
  kedua level ini harus tersedia di Dashboard, bukan cuma salah satu.
- **Auto branch-scoping untuk POV Karyawan (tidak ada pilih cabang manual).** Setiap
  Employee (Kasir/Barber/dst) punya `branch_id` tetap dari data master. Begitu login,
  SELURUH modul operasional (POS, Appointment, Attendance, Inventory, Cashier Closing)
  otomatis ter-scope ke `branch_id` employee tersebut — JANGAN buat dropdown/pilihan
  cabang di layar manapun yang diakses POV Karyawan. Ini beda dengan Owner/HQ/Branch
  Manager di POV Manajemen yang boleh switch context antar cabang (karena mereka
  memang mengawasi lebih dari satu cabang).

---

## Data Model Inti (entitas & relasi, dari PRD Section 14)

| Entity | Core Relationship |
|---|---|
| Company | Parent organization |
| Branch | Company → Branch |
| User/Role | User → role → branch scope |
| Employee | Employee → branch → role |
| Customer | Central customer identity (SATU tabel, diakses ringan dari POS & penuh dari CRM admin) |
| Complaint/Feedback | Customer → complaint entry + status + resolution |
| Customer Merge Log | Duplicate customer records → merged into single customer_id |
| Membership | Customer → membership/tier |
| Loyalty Ledger | Customer → earn/redeem transactions |
| Service | Service master, duration, price |
| Product/SKU | Central retail item |
| Product-Service Linkage | Service → product(s) consumed + quantity per usage (BOM) |
| Variant | Product → variants |
| Inventory | SKU × location |
| Stock Movement | SKU + location + reference |
| Supplier | Supplier master |
| Purchase Order | Supplier → PO → receiving |
| Appointment | Customer + branch + barber + service + slot |
| Order | Customer + channel + branch + totals |
| Order Item | Order → service/product lines |
| Payment | Order → payment method |
| Commission | Employee + order/service |
| Promotion | Promotion rules dan campaign |
| Audit Log | User + action + entity + timestamp |
| Chart of Accounts | Account code + type (asset/liability/equity/revenue/expense) |
| Journal Entry | Transaction reference → journal lines (debit/credit), balanced |
| Journal Line | Journal Entry → account + debit/credit amount |
| Fiscal Period | Period → status (open/closed) |
| Bank Reconciliation | Payment → gateway settlement match + fee |

---

## Core Workflows (ringkas)

**Walk-In**: cari/buat customer (quick-lookup) → antri/assign barber → layani → tambah
produk retail → hitung diskon/poin/pajak/komisi → bayar → selesai → deduct stock →
update history (history lengkap muncul di POV Manajemen).

**Appointment**: pilih cabang/service/barber/waktu → validasi availability → buat
booking → kirim reminder → check-in → convert ke transaksi service → selesai & bayar.

**Inventory Transfer**: buat request (POV Manajemen) → approve (jika perlu) → dispatch
source → in-transit → receive destination → post balance → audit.

**Customer Reminder**: hitung interval historis → identifikasi customer due/overdue →
cek consent → trigger reminder → track respons booking/pembelian → ukur efektivitas.
(Semua di POV Manajemen — karyawan tidak setting reminder campaign.)

---

## Non-Functional Requirements Kunci

- Performance: p95 ≤ 2 detik untuk aksi read/write standar (di luar API eksternal).
- Availability: target ≥ 99,5% (di luar maintenance terjadwal).
- Reliability: kegagalan API eksternal tidak boleh corrupt order/inventory state lokal.
- Consistency: state transitions inventory/payment harus transaksional.
- Usability: POS dioptimalkan untuk kecepatan kerja kasir; dashboard manajemen harus
  responsive di mobile.

---

## Konvensi Kode

<!-- ISI SESUAI PREFERENSI ANDA, contoh: -->
- Penamaan: [snake_case DB, camelCase JS, dst — sesuaikan]
- Setiap migration baru wajib reversible (ada down migration)
- Setiap endpoint yang mengubah stock/finance wajib ada test untuk happy path + reversal
  (refund/void)

---

## Definition of Done (per fitur, dari PRD Section 28)

- [ ] Functional requirement sesuai PRD terpenuhi
- [ ] Role/permission ter-test (branch manager tidak bisa akses cabang lain, dst)
- [ ] Happy path + exception path ter-test
- [ ] Kalau nyentuh inventory: stock movement reconciled
- [ ] Kalau nyentuh uang: financial totals reconciled
- [ ] Audit event ter-generate untuk aksi sensitif
- [ ] Acceptance criteria terkait terpenuhi

---

## Yang HARUS ditanyakan ke user sebelum lanjut

- Kalau business rule tidak jelas / tidak ada di dokumen ini → tanya, jangan asumsi.
- Kalau perubahan menyentuh lebih dari 1 POV/domain sekaligus → konfirmasi dulu, karena
  arsitektur ini saling terhubung (branch/customer/product jadi shared data layer).
