// lib/data/dummy.ts

export const dummyRingkasan = {
  pendapatanBulanIni: 24500000,
  totalReservasi: 142,
  pelangganBaru: 28,
  performaCabang: [
    { cabang: "Bypass", omset: 14500000, transaksi: 85 },
    { cabang: "Samadikun", omset: 10000000, transaksi: 57 }
  ]
};

export const dummyReservasi = [
  { id: "RES-0831-01", pelanggan: "Budi Santoso", layanan: "Haircut Premium + Styling", jam: "10:00", cabang: "Bypass", barber: "Dedi", status: "Selesai" },
  { id: "RES-0831-02", pelanggan: "Andi Wijaya", layanan: "Shaving Klasik", jam: "11:30", cabang: "Samadikun", barber: "Fajar", status: "Proses" },
  { id: "RES-0831-03", pelanggan: "Reza", layanan: "Hair Coloring", jam: "14:00", cabang: "Bypass", barber: "Rio", status: "Menunggu" }
];

export const dummyShift = [
  { id: "SHF-01", karyawan: "Dedi", cabang: "Bypass", tanggal: "2026-08-31", shift: "Pagi (09:00 - 15:00)", status: "Hadir" },
  { id: "SHF-02", karyawan: "Rio", cabang: "Bypass", tanggal: "2026-08-31", shift: "Siang (15:00 - 21:00)", status: "Hadir" },
  { id: "SHF-03", karyawan: "Fajar", cabang: "Samadikun", tanggal: "2026-08-31", shift: "Pagi (09:00 - 15:00)", status: "Off" },
  { id: "SHF-04", karyawan: "Nita", cabang: "Samadikun", tanggal: "2026-08-31", shift: "Siang (15:00 - 21:00)", status: "Hadir" }
];

export const dummyBatchInventory = [
  { sku: "PMD-HLD-01", produk: "Pomade Hold Premium", batch: "B-2601", stok: 24, expired: "2027-12-01", status: "Aman" },
  { sku: "TNC-GSG-02", produk: "Hair Tonic Ginseng", batch: "B-2511", stok: 5, expired: "2026-10-15", status: "Mendekati Expired" },
  { sku: "SHV-CRM-03", produk: "Cooling Shave Cream", batch: "B-2409", stok: 0, expired: "2025-11-20", status: "Habis" }
];

export const dummyPayroll = [
  { id: "PAY-08-01", karyawan: "Dedi Kurniawan", periode: "Agustus 2026", gajiPokok: 2500000, komisi: 1250000, potongan: 50000, total: 3700000, status: "Draft" },
  { id: "PAY-08-02", karyawan: "Nita Amelia", periode: "Agustus 2026", gajiPokok: 2500000, komisi: 950000, potongan: 0, total: 3450000, status: "Draft" }
];

export const dummyAuditLog = [
  { id: "LOG-001", waktu: "2026-08-31 10:15:00", petugas: "Zainal", cabang: "HQ", jenis: "Edit Data", entitas: "Karyawan", deskripsi: "Mengubah shift Fajar" },
  { id: "LOG-002", waktu: "2026-08-31 09:30:00", petugas: "Dedi", cabang: "Bypass", jenis: "Void Transaksi", entitas: "POS", deskripsi: "Salah input layanan premium" }
];

export const dummyOpname = [
  { id: "OPN-08-01", tanggal: "2026-08-30", cabang: "Bypass", totalItem: 45, itemSelisih: 2, netVariance: -150000, status: "Selesai", petugas: "Zainal" },
  { id: "OPN-08-02", tanggal: "2026-08-31", cabang: "Samadikun", totalItem: 30, itemSelisih: 0, netVariance: 0, status: "Draft", petugas: "Reval" }
];

export const dummyTransfer = [
  { id: "TRF-08-01", tanggal: "2026-08-29", asal: "Bypass", tujuan: "Samadikun", totalUnit: 10, totalNilai: 500000, status: "Selesai" },
  { id: "TRF-08-02", tanggal: "2026-08-31", asal: "HQ", tujuan: "Bypass", totalUnit: 25, totalNilai: 1250000, status: "In-Transit" }
];

export const dummyPO = [
  { id: "PO-2608-01", tanggal: "2026-08-25", cabang: "HQ", supplier: "PT Indobeauty", totalNilai: 4500000, termin: "Net 30", status: "Selesai" },
  { id: "PO-2608-02", tanggal: "2026-08-31", cabang: "Bypass", supplier: "CV Barbersupply", totalNilai: 1200000, termin: "Cash", status: "Menunggu Persetujuan" }
];

export const dummySupplier = [
  { id: "SUP-01", nama: "PT Indobeauty", pic: "Hendra", kontak: "08123456789", alamat: "Jakarta Barat", termin: "Net 30", status: "Aktif" },
  { id: "SUP-02", nama: "CV Barbersupply", pic: "Anton", kontak: "08987654321", alamat: "Cirebon", termin: "Cash", status: "Aktif" }
];

export const dummyReward = [
  { id: "RWD-01", nama: "Free Haircut", biayaPoin: 100, deskripsi: "Gratis 1x potong rambut reguler", status: "Aktif" },
  { id: "RWD-02", nama: "Diskon Pomade 50%", biayaPoin: 50, deskripsi: "Potongan harga 50% untuk pomade", status: "Aktif" }
];

export const dummyPromo = [
  { kode: "MERDEKA26", nama: "Promo Kemerdekaan", diskon: "20%", scope: "Semua Cabang", kuota: "45/100", periode: "Aug 2026", status: "Aktif" },
  { kode: "BYPASS10", nama: "Diskon Lokal Bypass", diskon: "10%", scope: "Bypass", kuota: "12/50", periode: "Sep 2026", status: "Draft" }
];

export const dummyReminder = [
  { id: "REM-01", customer: "Budi Santoso", tier: "Gold", terakhir: "2026-07-25", barber: "Dedi", tipe: "Rutin Potong", status: "Aman", pesan: "Halo Budi, sudah waktunya cukur..." },
  { id: "REM-02", customer: "Andi Wijaya", tier: "Silver", terakhir: "2026-06-10", barber: "Fajar", tipe: "Berisiko Churn", status: "Aman", pesan: "Halo Andi, kami kangen..." }
];

export const dummyExpense = [
  { id: "EXP-08-01", tanggal: "2026-08-28", cabang: "Bypass", kategori: "Listrik & Air", penerima: "PLN/PDAM", metode: "Transfer", nominal: 1250000, catatan: "Bulan Agustus" },
  { id: "EXP-08-02", tanggal: "2026-08-30", cabang: "Samadikun", kategori: "Maintenance", penerima: "Tukang AC", metode: "Kas Cabang", nominal: 350000, catatan: "Service AC standing" }
];

export const dummyAP = [
  { po: "PO-2608-01", supplier: "PT Indobeauty", cabang: "HQ", tglTerima: "2026-08-27", jatuhTempo: "2026-09-26", totalTagihan: 4500000, terbayar: 0, sisaHutang: 4500000, status: "Belum Lunas" },
  { po: "PO-2607-15", supplier: "CV Barbersupply", cabang: "Bypass", tglTerima: "2026-07-20", jatuhTempo: "2026-08-20", totalTagihan: 2000000, terbayar: 2000000, sisaHutang: 0, status: "Lunas" }
];