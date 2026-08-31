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

export const dummyOpname = [
  { id: "OPN-08-01", tanggal: "2026-08-30", cabang: "Bypass", totalItem: 45, itemSelisih: 2, netVariance: -150000, status: "Selesai", petugas: "Zainal" },
  { id: "OPN-08-02", tanggal: "2026-08-31", cabang: "Samadikun", totalItem: 30, itemSelisih: 0, netVariance: 0, status: "Draft", petugas: "Reval" }
];

export const dummyTransfer = [
  { id: "TRF-08-01", tanggal: "2026-08-29", asal: "Bypass", tujuan: "Samadikun", totalUnit: 10, totalNilai: 500000, status: "Selesai" },
  { id: "TRF-08-02", tanggal: "2026-08-31", asal: "HQ", tujuan: "Bypass", totalUnit: 25, totalNilai: 1250000, status: "In-Transit" }
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

export const dummyAP = [
  { po: "PO-2608-01", supplier: "PT Indobeauty", cabang: "HQ", tglTerima: "2026-08-27", jatuhTempo: "2026-09-26", totalTagihan: 4500000, terbayar: 0, sisaHutang: 4500000, status: "Belum Lunas" },
  { po: "PO-2607-15", supplier: "CV Barbersupply", cabang: "Bypass", tglTerima: "2026-07-20", jatuhTempo: "2026-08-20", totalTagihan: 2000000, terbayar: 2000000, sisaHutang: 0, status: "Lunas" }
];

export const dummyKasbon = [
  { id: "KSB-08-01", tanggal: "2026-08-15", karyawan: "Fajar", cabang: "Samadikun", nominal: 500000, alasan: "Biaya sekolah anak", status: "Disetujui" },
  { id: "KSB-08-02", tanggal: "2026-08-30", karyawan: "Rio", cabang: "Bypass", nominal: 300000, alasan: "Keperluan mendesak keluarga", status: "Menunggu Persetujuan" }
];