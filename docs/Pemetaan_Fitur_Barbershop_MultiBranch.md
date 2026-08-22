# Pemetaan Fitur — Barbershop Multi-Branch Management System
### Berdasarkan Prioritas Kebutuhan Operasional

Pemetaan ini disusun bukan dari "fitur mana yang jawab masalah", tapi murni dari **seberapa penting fitur itu supaya operasional bisa jalan**. Analytics/BI sengaja diletakkan paling bawah karena sifatnya pendukung keputusan, bukan penggerak operasional harian.

---

## PRIMER
**Tanpa ini, toko tidak bisa buka/beroperasi sama sekali.**

| Modul | Fitur |
|---|---|
| Branch | Branch master, user & role dasar |
| Product & Service | Product/SKU master, Service master, pricing |
| Customer | Customer database, Customer ID dasar |
| Employee/HR | Employee master, **Attendance**, **Break Management** |
| POS | New Transaction (service + product), Payment (cash/QRIS/split), Receipt, Cashier Shift |
| Inventory | Stok on-hand per cabang, deduct stock otomatis saat transaksi selesai |

---

## SEKUNDER
**Bukan syarat buka toko, tapi tanpa ini operasional cepat berantakan/rugi.**

| Modul | Fitur |
|---|---|
| Employee/HR | Shift Management, **Rolling Schedule** + conflict detection, Day-Off, Leave/Permission |
| Appointment & Queue | Booking, Queue, Walk-In, No-Show |
| Inventory | Stock Movement ledger, **Expiry Management (batch/FEFO)**, Low Stock alert |
| Membership | Status member vs non-member, Loyalty Point earning & **Redemption** |
| Finance | Daily Cash, Cashier Closing & reconsiliasi (expected vs actual) |
| Purchasing & Supplier | Supplier master, Purchase Order, Receiving (restock dasar) |
| Notification | Reminder appointment, **Customer Reminder**, alert expired/low stock |

---

## TERSIER
**Untuk skala & kontrol yang lebih rapi, tapi bisa ditunda tanpa toko berhenti jalan.**

| Modul | Fitur |
|---|---|
| Customer/CRM | **Customer Preference**, Visit History, Segmentation dasar |
| Employee/HR | Commission, Overtime, Performance |
| Inventory | Stock Opname & variance, Stock Adjustment (otorisasi), Inter-branch Transfer, Stock Aging |
| Branch | Branch Target, Operating Hours, Performance comparison antar cabang |
| Promotion | Discount, Voucher, Campaign, Birthday Promotion |
| Finance | Revenue by branch/channel, Expense, AP, AR, P&L per cabang |
| E-Commerce & Marketplace | Channel connection (Shopee/Tokopedia/TikTok Shop), Order import, SKU mapping, Fulfillment |
| Security | Audit log untuk aksi sensitif (void, refund, price override, adjustment) |

---

## PRIORITAS PALING RENDAH — Analytics/BI & AI
**Tidak menggerakkan operasional harian; bermanfaat untuk evaluasi & keputusan jangka panjang, tapi bukan hal yang harus ada di awal.**

| Modul | Fitur |
|---|---|
| Analytics & BI | Sales/Product/Service Analytics, Branch Analytics, Barber Analytics, Inventory Analytics |
| Analytics & BI | **Analisa Behavior Customer** (RFM, cohort, churn-risk, prediksi next-visit) |
| Dashboard | Executive Dashboard (konsolidasi lintas cabang) |
| AI Layer (Future) | Churn prediction, Next-best-action, Product recommendation, Demand forecasting, Natural-language BI, Anomaly detection |

---

## Ringkasan

| Prioritas | Alasan |
|---|---|
| **Primer** | Syarat mutlak toko bisa transaksi & jalan hari-1 |
| **Sekunder** | Mencegah kebocoran operasional (stok, jadwal, kas, member) |
| **Tersier** | Kontrol & kerapihan skala multi-cabang, bisa menyusul |
| **Analytics/BI** | Nice-to-have, dikerjakan paling akhir setelah data operasional stabil |

Catatan: lini F&B (sundae) tetap tidak dimasukkan sesuai arahan sebelumnya — bukan prioritas saat ini.
