// lib/data/dummy.ts

export const dummyRingkasan = {
  pendapatanBulanIni: 185500000,
  totalReservasi: 842,
  pelangganBaru: 156,
  performaCabang: [
    { cabang: "Bypass", omset: 65000000, transaksi: 280 },
    { cabang: "Samadikun", omset: 45000000, transaksi: 210 },
    { cabang: "CSB Mall", omset: 40000000, transaksi: 190 },
    { cabang: "Sumber", omset: 20500000, transaksi: 95 },
    { cabang: "Tegal", omset: 15000000, transaksi: 67 }
  ]
};

export const dummyExecutive = [
  { rank: 1, cabang: "Bypass", kota: "Cirebon", omset: 65000000, kontribusi: 35, vol: 280, aov: 232000, laba: 25000000, memberPct: 65 },
  { rank: 2, cabang: "Samadikun", kota: "Cirebon", omset: 45000000, kontribusi: 24, vol: 210, aov: 214000, laba: 18000000, memberPct: 58 },
  { rank: 3, cabang: "CSB Mall", kota: "Cirebon", omset: 40000000, kontribusi: 22, vol: 190, aov: 210000, laba: 15000000, memberPct: 70 },
  { rank: 4, cabang: "Sumber", kota: "Kab. Cirebon", omset: 20500000, kontribusi: 11, vol: 95, aov: 215000, laba: 6000000, memberPct: 45 },
  { rank: 5, cabang: "Tegal", kota: "Kota Tegal", omset: 15000000, kontribusi: 8, vol: 67, aov: 223000, laba: 4000000, memberPct: 40 }
];

export const dummyProductivity = {
  barbers: [
    { rank: 1, nama: "Rio Saputra", cabang: "Bypass", hadir: 24, output: "8.5/hr", jasa: 15000000, retail: 2000000, total: 17000000, komisi: 3500000, efisiensi: 85 },
    { rank: 2, nama: "Dedi Kurniawan", cabang: "Bypass", hadir: 23, output: "7.2/hr", jasa: 12000000, retail: 1500000, total: 13500000, komisi: 2800000, efisiensi: 78 },
    { rank: 3, nama: "Fajar Ramadhan", cabang: "Samadikun", hadir: 25, output: "7.0/hr", jasa: 11500000, retail: 1000000, total: 12500000, komisi: 2500000, efisiensi: 75 },
    { rank: 4, nama: "Nita Amelia", cabang: "Samadikun", hadir: 22, output: "6.5/hr", jasa: 10000000, retail: 800000, total: 10800000, komisi: 2100000, efisiensi: 70 }
  ],
  occupancy: [
    { cabang: "Bypass", kursi: 4, rate: 78.5, status: "Optimal" },
    { cabang: "Samadikun", kursi: 4, rate: 65.0, status: "Normal" },
    { cabang: "CSB Mall", kursi: 3, rate: 82.0, status: "Overutilized" },
    { cabang: "Sumber", kursi: 4, rate: 45.0, status: "Underutilized" },
    { cabang: "Tegal", kursi: 5, rate: 30.0, status: "Underutilized" }
  ]
};

export const dummyTargets = [
  { cabang: "Bypass", omsetAktual: 65000000, omsetTarget: 60000000, trxAktual: 280, trxTarget: 250, custAktual: 45, custTarget: 50, skor: 98.5, status: "Tercapai" },
  { cabang: "Samadikun", omsetAktual: 45000000, omsetTarget: 50000000, trxAktual: 210, trxTarget: 220, custAktual: 30, custTarget: 40, skor: 88.0, status: "Hampir Tercapai" },
  { cabang: "CSB Mall", omsetAktual: 40000000, omsetTarget: 35000000, trxAktual: 190, trxTarget: 150, custAktual: 50, custTarget: 30, skor: 115.0, status: "Melampaui Target" },
  { cabang: "Sumber", omsetAktual: 20500000, omsetTarget: 30000000, trxAktual: 95, trxTarget: 150, custAktual: 15, custTarget: 25, skor: 68.3, status: "Di Bawah Target" },
  { cabang: "Tegal", omsetAktual: 15000000, omsetTarget: 25000000, trxAktual: 67, trxTarget: 120, custAktual: 10, custTarget: 20, skor: 60.0, status: "Di Bawah Target" }
];

export const dummyMenuVelocity = {
  services: [
    { layanan: "Haircut Reguler", harga: 60000, margin: "57%", terjual: 450, laba: 15300000, kuadran: "Workhorses" },
    { layanan: "Haircut Premium + Styling", harga: 95000, margin: "60%", terjual: 180, laba: 10260000, kuadran: "Stars" },
    { layanan: "Hair Coloring", harga: 150000, margin: "62%", terjual: 45, laba: 4185000, kuadran: "Puzzles" },
    { layanan: "Shaving Klasik", harga: 45000, margin: "54%", terjual: 30, laba: 729000, kuadran: "Dogs" }
  ],
  retail: [
    { produk: "Pomade Matte 100g", harga: 55000, margin: "55%", terjual: 120, stok: 45, velocity: "Fast Moving" },
    { produk: "Shampoo Anti Ketombe 200ml", harga: 40000, margin: "55%", terjual: 65, stok: 30, velocity: "Medium Moving" },
    { produk: "Beard Oil 30ml", harga: 65000, margin: "54%", terjual: 5, stok: 25, velocity: "Dead Stock" }
  ]
};

export const dummyCRM = [
  { nama: "Andi Pratama", kontak: "081234567890", tier: "Gold", rfm: "555", segmen: "Champions", kunjungan: "2026-08-30", prediksi: "2026-09-27", belanja: 1250000 },
  { nama: "Budi Santoso", kontak: "081987654321", tier: "Silver", rfm: "443", segmen: "Loyal Customers", kunjungan: "2026-08-15", prediksi: "2026-09-15", belanja: 750000 },
  { nama: "Caca Marissa", kontak: "08122334455", tier: "Guest", rfm: "511", segmen: "New Customers", kunjungan: "2026-08-28", prediksi: "2026-09-28", belanja: 95000 },
  { nama: "Deni Irawan", kontak: "08567890123", tier: "Bronze", rfm: "222", segmen: "At Risk", kunjungan: "2026-06-10", prediksi: "Overdue", belanja: 450000 },
  { nama: "Eko Purwanto", kontak: "08234567890", tier: "Guest", rfm: "111", segmen: "Hibernating", kunjungan: "2026-01-15", prediksi: "Overdue", belanja: 60000 }
];

export const dummyReservasi = [
  { id: "RES-0831-01", pelanggan: "Budi Santoso", layanan: "Haircut Premium + Styling", jam: "10:00", cabang: "Bypass", barber: "Dedi", status: "Selesai" },
  { id: "RES-0831-02", pelanggan: "Andi Wijaya", layanan: "Shaving Klasik", jam: "11:30", cabang: "Samadikun", barber: "Fajar", status: "Proses" },
  { id: "RES-0831-03", pelanggan: "Reza", layanan: "Hair Coloring", jam: "14:00", cabang: "CSB Mall", barber: "Rio", status: "Menunggu" },
  { id: "RES-0831-04", pelanggan: "Sandi", layanan: "Haircut Reguler", jam: "15:00", cabang: "Sumber", barber: "Dedi", status: "Menunggu" },
  { id: "RES-0831-05", pelanggan: "Bagus", layanan: "Haircut Reguler", jam: "16:30", cabang: "Tegal", barber: "Fajar", status: "Menunggu" }
];

export const dummyAuditLog = [
  { id: "LOG-001", waktu: "2026-08-31 10:15:00", petugas: "Zainal", cabang: "HQ", jenis: "Edit Data", entitas: "Karyawan", deskripsi: "Mengubah shift Fajar" },
  { id: "LOG-002", waktu: "2026-08-31 09:30:00", petugas: "Dedi", cabang: "Bypass", jenis: "Void Transaksi", entitas: "POS", deskripsi: "Salah input layanan premium" },
  { id: "LOG-003", waktu: "2026-08-30 14:20:00", petugas: "Reval", cabang: "HQ", jenis: "Approval", entitas: "Kasbon", deskripsi: "Menyetujui kasbon Rio" },
  { id: "LOG-004", waktu: "2026-08-30 11:00:00", petugas: "Nita", cabang: "Samadikun", jenis: "Hapus Item", entitas: "Cart POS", deskripsi: "Kustomer batal beli pomade" },
  { id: "LOG-005", waktu: "2026-08-29 18:45:00", petugas: "Gunawan", cabang: "HQ", jenis: "Ubah Harga", entitas: "Katalog", deskripsi: "Kenaikan harga Shaving Klasik" }
];

export const dummyPO = [
  { id: "PO-2608-01", tanggal: "2026-08-25", cabang: "HQ", supplier: "PT Indobeauty", totalNilai: 14500000, termin: "Net 30", status: "Selesai" },
  { id: "PO-2608-02", tanggal: "2026-08-28", cabang: "Bypass", supplier: "CV Barbersupply", totalNilai: 5200000, termin: "Cash", status: "Menunggu Persetujuan" },
  { id: "PO-2608-03", tanggal: "2026-08-29", cabang: "Samadikun", supplier: "Toko Grooming Jaya", totalNilai: 3100000, termin: "Net 14", status: "Disetujui" },
  { id: "PO-2608-04", tanggal: "2026-08-30", cabang: "CSB Mall", supplier: "PT Indobeauty", totalNilai: 8500000, termin: "Net 30", status: "Dalam Pengiriman" }
];

export const dummyExpense = [
  { id: "EXP-08-01", tanggal: "2026-08-28", cabang: "Bypass", kategori: "Listrik & Air", penerima: "PLN/PDAM", metode: "Transfer", nominal: 1250000, catatan: "Bulan Agustus" },
  { id: "EXP-08-02", tanggal: "2026-08-28", cabang: "Samadikun", kategori: "Sewa Tempat", penerima: "Bpk. H. Rahmat", metode: "Transfer", nominal: 25000000, catatan: "Sewa tahunan termin 1" },
  { id: "EXP-08-03", tanggal: "2026-08-29", cabang: "CSB Mall", kategori: "Maintenance", penerima: "Tukang AC", metode: "Kas Cabang", nominal: 350000, catatan: "Service AC 2 unit" },
  { id: "EXP-08-04", tanggal: "2026-08-30", cabang: "Sumber", kategori: "Internet", penerima: "Indihome", metode: "Transfer", nominal: 450000, catatan: "Tagihan Agustus" },
  { id: "EXP-08-05", tanggal: "2026-08-31", cabang: "Tegal", kategori: "Marketing", penerima: "Percetakan Maju", metode: "Kas Cabang", nominal: 800000, catatan: "Cetak 1000 brosur" }
];

// Data pendukung lainnya tetap dipertahankan agar modul lain tidak error
export const dummyShift = [];
export const dummyBatchInventory = [];
export const dummyPayroll = [];
export const dummyOpname = [];
export const dummyTransfer = [];
export const dummySupplier = [];
export const dummyReward = [];
export const dummyPromo = [];
export const dummyReminder = [];
export const dummyAP = [];
export const dummyKasbon = [];