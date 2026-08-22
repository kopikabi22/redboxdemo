# Data Dictionary — RedBox ERP (Tabel Kunci)

Mendampingi `ERD_RedBoxERP.mermaid`. Konvensi: `snake_case` untuk nama tabel/kolom,
`bigint` untuk semua PK/FK (AUTO_INCREMENT), `decimal(15,2)` untuk semua nilai uang.

## `customer`

| Kolom | Tipe | Nullable | Default | Keterangan |
|---|---|:---:|:---:|---|
| `customer_id` | `bigint` | NO | `AUTO_INCREMENT` | Primary Key |
| `name` | `varchar(150)` | YES | `NULL` | NULL untuk Guest yang belum kasih nama |
| `phone_number` | `varchar(20)` | NO | - | UNIQUE — identifier utama, dipakai untuk Guest maupun Member |
| `type` | `enum('guest','member')` | NO | `'guest'` | Berubah ke `member` saat aktivasi membership |
| `created_at` | `datetime` | NO | `CURRENT_TIMESTAMP` | Timestamp pertama kali tercatat (transaksi guest pertama atau daftar member langsung) |

## `membership`

| Kolom | Tipe | Nullable | Default | Keterangan |
|---|---|:---:|:---:|---|
| `membership_id` | `bigint` | NO | `AUTO_INCREMENT` | Primary Key |
| `customer_id` | `bigint` | NO | - | FK → `customer.customer_id`, UNIQUE (1 customer maks 1 membership aktif) |
| `tier` | `enum('bronze','silver','gold','platinum')` | NO | `'bronze'` | Naik otomatis berdasarkan akumulasi spend/poin (rule di POV Manajemen) |
| `activated_at` | `datetime` | NO | - | Tanggal aktivasi (bayar Rp100.000) |
| `activation_fee` | `decimal(15,2)` | NO | `100000.00` | Historical — jangan diubah walau kebijakan harga berubah di masa depan |

## `orders`

| Kolom | Tipe | Nullable | Default | Keterangan |
|---|---|:---:|:---:|---|
| `order_id` | `bigint` | NO | `AUTO_INCREMENT` | Primary Key |
| `customer_id` | `bigint` | NO | - | FK → `customer.customer_id` |
| `branch_id` | `bigint` | NO | - | FK → `branch.branch_id` — WAJIB ada di setiap query (branch-scoping) |
| `employee_id` | `bigint` | NO | - | FK → `employee.employee_id`, kasir yang memproses |
| `promotion_id` | `bigint` | YES | `NULL` | FK → `promotion.promotion_id`, jika ada diskon diterapkan |
| `total` | `decimal(15,2)` | NO | - | Total setelah diskon & pajak |
| `channel` | `varchar(20)` | NO | `'pos'` | `'pos'` saat ini; `'marketplace'` reserved untuk fase Marketplace nanti |
| `status` | `enum('open','paid','void','refunded')` | NO | `'open'` | `void`/`refunded` WAJIB audit log |
| `created_at` | `datetime` | NO | `CURRENT_TIMESTAMP` | - |

## `inventory`

| Kolom | Tipe | Nullable | Default | Keterangan |
|---|---|:---:|:---:|---|
| `inventory_id` | `bigint` | NO | `AUTO_INCREMENT` | Primary Key |
| `product_id` | `bigint` | NO | - | FK → `product.product_id` |
| `branch_id` | `bigint` | NO | - | FK → `branch.branch_id` — kombinasi (product_id, branch_id) harus UNIQUE |
| `on_hand` | `int` | NO | `0` | Stok fisik tercatat |
| `reserved` | `int` | NO | `0` | Stok yang sudah di-booking tapi belum keluar (misal appointment yang butuh produk tertentu) |
| `expiry_date` | `date` | YES | `NULL` | NULL untuk produk non-perishable |
| `batch_no` | `varchar(50)` | YES | `NULL` | Untuk FEFO tracking |

**Catatan penting:** `available_stock` (On Hand − Reserved) TIDAK disimpan sebagai
kolom — dihitung on-the-fly lewat 1 fungsi/service terpusat (sesuai prinsip arsitektur
di CLAUDE.md), supaya tidak ada logic yang duplikat/drift antar endpoint.

## `stock_movement`

| Kolom | Tipe | Nullable | Default | Keterangan |
|---|---|:---:|:---:|---|
| `movement_id` | `bigint` | NO | `AUTO_INCREMENT` | Primary Key |
| `inventory_id` | `bigint` | NO | - | FK → `inventory.inventory_id` |
| `quantity` | `int` | NO | - | Positif = stok masuk, Negatif = stok keluar |
| `movement_type` | `enum('sale','purchase_receiving','transfer','adjustment','writeoff','consumption')` | NO | - | `'consumption'` khusus untuk Product-Service Linkage (BOM) |
| `reference` | `varchar(100)` | YES | `NULL` | order_id / po_id / transfer_id terkait, untuk audit trail |
| `created_at` | `datetime` | NO | `CURRENT_TIMESTAMP` | APPEND-ONLY — tabel ini tidak pernah di-UPDATE atau DELETE |

## `chart_of_accounts`

| Kolom | Tipe | Nullable | Default | Keterangan |
|---|---|:---:|:---:|---|
| `account_id` | `bigint` | NO | `AUTO_INCREMENT` | Primary Key |
| `account_code` | `varchar(20)` | NO | - | UNIQUE, konvensi misal `1-1000` = Kas, `4-xxxx` = Revenue |
| `account_name` | `varchar(150)` | NO | - | - |
| `account_type` | `enum('asset','liability','equity','revenue','expense')` | NO | - | Menentukan posisi normal debit/kredit |

## `journal_entry` + `journal_line`

| Kolom | Tipe | Nullable | Default | Keterangan |
|---|---|:---:|:---:|---|
| `journal_id` | `bigint` | NO | `AUTO_INCREMENT` | Primary Key `journal_entry` |
| `branch_id` | `bigint` | NO | - | FK → `branch.branch_id` |
| `fiscal_period_id` | `bigint` | NO | - | FK → `fiscal_period.fiscal_period_id` |
| `reference` | `varchar(100)` | YES | `NULL` | order_id / po_id / payroll_id sumber jurnal |
| `line_id` | `bigint` | NO | `AUTO_INCREMENT` | Primary Key `journal_line` |
| `account_id` | `bigint` | NO | - | FK → `chart_of_accounts.account_id` |
| `debit` | `decimal(15,2)` | NO | `0.00` | - |
| `credit` | `decimal(15,2)` | NO | `0.00` | - |

**Constraint wajib:** SUM(`debit`) harus SELALU SAMA DENGAN SUM(`credit`) dalam 1
`journal_id` yang sama (jurnal berimbang) — validasi ini di level aplikasi DAN
sebaiknya juga jadi database constraint/trigger kalau memungkinkan.
