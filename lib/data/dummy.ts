// lib/data/dummy.ts

// 1. AGREGAT GLOBAL (Acuan Utama)
export const globalStats = {
  omzet: 185500000,
  transaksi: 842,
  pelangganBaru: 156,
  memberAktif: 450,
  aov: 220308, // 185.5M / 842
  labaKotor: 160500000,
  labaBersih: 125500000
};

// 2. KONSOLIDASI CABANG (Total: 185.5M Omzet, 842 Trx)
export const dummyExecutive = [
  { rank: 1, cabang: "Bypass", kota: "Cirebon", omset: 65000000, kontribusi: 35, vol: 280, aov: 232142, laba: 43925000, memberPct: 65 },
  { rank: 2, cabang: "Samadikun", kota: "Cirebon", omset: 45000000, kontribusi: 24, vol: 210, aov: 214285, laba: 30425000, memberPct: 58 },
  { rank: 3, cabang: "CSB Mall", kota: "Cirebon", omset: 40000000, kontribusi: 22, vol: 190, aov: 210526, laba: 27000000, memberPct: 70 },
  { rank: 4, cabang: "Sumber", kota: "Kab. Cirebon", omset: 20500000, kontribusi: 11, vol: 95, aov: 215789, laba: 13850000, memberPct: 45 },
  { rank: 5, cabang: "Tegal", kota: "Kota Tegal", omset: 15000000, kontribusi: 8, vol: 67, aov: 223880, laba: 10300000, memberPct: 40 }
];

export const dummyRingkasan = {
  pendapatanBulanIni: globalStats.omzet,
  totalReservasi: globalStats.transaksi,
  pelangganBaru: globalStats.pelangganBaru,
  performaCabang: dummyExecutive.map(c => ({ cabang: c.cabang, omset: c.omset, transaksi: c.vol }))
};

// 3. PRODUKTIVITAS BARBER (Total Omzet: 185.5M)
export const dummyProductivity = {
  barbers: [
    { rank: 1, nama: "Rio Saputra", cabang: "Bypass", hadir: 24, output: "11/hr", jasa: 45000000, retail: 15000000, total: 60000000, komisi: 12000000, efisiensi: 88 },
    { rank: 2, nama: "Dedi Kurniawan", cabang: "Bypass", hadir: 25, output: "10/hr", jasa: 40000000, retail: 12000000, total: 52000000, komisi: 10400000, efisiensi: 85 },
    { rank: 3, nama: "Fajar Ramadhan", cabang: "Samadikun", hadir: 24, output: "9/hr", jasa: 35000000, retail: 8000000, total: 43000000, komisi: 8600000, efisiensi: 80 },
    { rank: 4, nama: "Nita Amelia", cabang: "Samadikun", hadir: 23, output: "7/hr", jasa: 25500000, retail: 5000000, total: 30500000, komisi: 6100000, efisiensi: 72 }
  ],
  occupancy: dummyExecutive.map(c => ({ cabang: c.cabang, kursi: 4, rate: c.vol > 150 ? 78.5 : 45.0, status: c.vol > 150 ? "Optimal" : "Underutilized" }))
};

// 4. MENU VELOCITY (Sinkron dengan 842 Trx)
export const dummyMenuVelocity = {
  services: [
    { layanan: "Haircut Reguler", harga: 60000, margin: "57%", terjual: 400, laba: 13680000, kuadran: "Workhorses" },
    { layanan: "Haircut Premium + Styling", harga: 95000, margin: "60%", terjual: 242, laba: 13794000, kuadran: "Stars" },
    { layanan: "Hair Coloring", harga: 150000, margin: "62%", terjual: 150, laba: 13950000, kuadran: "Puzzles" },
    { layanan: "Shaving Klasik", harga: 45000, margin: "54%", terjual: 50, laba: 1215000, kuadran: "Dogs" }
  ],
  retail: [
    { produk: "Pomade Matte 100g", harga: 55000, margin: "55%", terjual: 300, stok: 45, velocity: "Fast Moving" },
    { produk: "Shampoo Anti Ketombe 200ml", harga: 40000, margin: "55%", terjual: 150, stok: 30, velocity: "Medium Moving" },
    { produk: "Beard Oil 30ml", harga: 65000, margin: "54%", terjual: 12, stok: 25, velocity: "Dead Stock" }
  ]
};

// 5. TARGET & KPI (Berdasarkan data Executive)
export const dummyTargets = dummyExecutive.map(c => ({
  cabang: c.cabang, 
  omsetAktual: c.omset, 
  omsetTarget: c.omset + 5000000, 
  trxAktual: c.vol, 
  trxTarget: c.vol + 20, 
  custAktual: Math.round(c.vol * 0.2), 
  custTarget: Math.round(c.vol * 0.25), 
  skor: (c.omset / (c.omset + 5000000)) * 100, 
  status: (c.omset / (c.omset + 5000000)) >= 0.9 ? "Hampir Tercapai" : "Di Bawah Target"
}));

// 6. CRM & INTELLIGENCE
export const dummyCRM = [
  { nama: "Andi Pratama", kontak: "081234567890", tier: "Gold", rfm: "555", segmen: "Champions", kunjungan: "2026-08-30", prediksi: "2026-09-27", belanja: 2450000 },
  { nama: "Budi Santoso", kontak: "081987654321", tier: "Silver", rfm: "443", segmen: "Loyal Customers", kunjungan: "2026-08-15", prediksi: "2026-09-15", belanja: 1750000 },
  { nama: "Caca Marissa", kontak: "08122334455", tier: "Guest", rfm: "511", segmen: "New Customers", kunjungan: "2026-08-28", prediksi: "2026-09-28", belanja: 295000 },
  { nama: "Deni Irawan", kontak: "08567890123", tier: "Bronze", rfm: "222", segmen: "At Risk", kunjungan: "2026-06-10", prediksi: "Overdue", belanja: 850000 },
  { nama: "Eko Purwanto", kontak: "08234567890", tier: "Guest", rfm: "111", segmen: "Hibernating", kunjungan: "2026-01-15", prediksi: "Overdue", belanja: 160000 }
];

export const dummyPnL = {
  revenue: globalStats.omzet,
  transaksi: globalStats.transaksi,
  cogs: 25000000,
  grossProfit: globalStats.labaKotor,
  opex: 35000000,
  netProfit: globalStats.labaBersih,
  margin: "67.6%"
};

// Data Operasional Pelengkap
export const dummyReservasi = [
  { id: "RES-0831-01", pelanggan: "Budi Santoso", layanan: "Haircut Premium", jam: "10:00", cabang: "Bypass", barber: "Dedi", status: "Selesai" },
  { id: "RES-0831-02", pelanggan: "Andi Wijaya", layanan: "Shaving Klasik", jam: "11:30", cabang: "Samadikun", barber: "Fajar", status: "Proses" },
  { id: "RES-0831-03", pelanggan: "Reza", layanan: "Hair Coloring", jam: "14:00", cabang: "CSB Mall", barber: "Rio", status: "Menunggu" }
];
export const dummyAuditLog = [{ id: "LOG-001", waktu: "2026-08-31 10:15:00", petugas: "Zainal", cabang: "HQ", jenis: "Edit Data", entitas: "Karyawan", deskripsi: "Mengubah shift" }];
export const dummyExpense = [{ id: "EXP-01", tanggal: "2026-08-28", cabang: "Bypass", kategori: "Listrik", penerima: "PLN", metode: "Transfer", nominal: 1250000, catatan: "Agustus" }];
export const dummyPO = [{ id: "PO-01", tanggal: "2026-08-25", cabang: "HQ", supplier: "PT Indobeauty", totalNilai: 14500000, termin: "Net 30", status: "Selesai" }];
export const dummyShift = [{ id: "SHF-01", karyawan: "Dedi", cabang: "Bypass", tanggal: "2026-08-31", shift: "Pagi", status: "Hadir" }];
export const dummyBatchInventory = [{ sku: "PMD-01", produk: "Pomade", batch: "B-26", stok: 24, expired: "2027-12-01", status: "Aman" }];
export const dummyPayroll = [{ id: "PAY-01", karyawan: "Dedi", periode: "Agustus 2026", gajiPokok: 2500000, komisi: 1250000, potongan: 50000, total: 3700000, status: "Draft" }];
export const dummyOpname = [{ id: "OPN-01", tanggal: "2026-08-30", cabang: "Bypass", totalItem: 45, itemSelisih: 2, netVariance: -150000, status: "Selesai", petugas: "Zainal" }];
export const dummyTransfer = [{ id: "TRF-01", tanggal: "2026-08-29", asal: "Bypass", tujuan: "Samadikun", totalUnit: 10, totalNilai: 500000, status: "Selesai" }];
export const dummySupplier = [{ id: "SUP-01", nama: "PT Indobeauty", pic: "Hendra", kontak: "0812", alamat: "Jakarta", termin: "Net 30", status: "Aktif" }];
export const dummyReward = [{ id: "RWD-01", nama: "Free Haircut", biayaPoin: 100, deskripsi: "Gratis", status: "Aktif" }];
export const dummyPromo = [{ kode: "MERDEKA", nama: "Promo Kemerdekaan", diskon: "20%", scope: "Semua", kuota: "45/100", periode: "Aug 2026", status: "Aktif" }];
export const dummyReminder = [{ id: "REM-01", customer: "Budi", tier: "Gold", terakhir: "2026-07-25", barber: "Dedi", tipe: "Rutin", status: "Aman", pesan: "Halo" }];
export const dummyAP = [{ po: "PO-01", supplier: "PT Indobeauty", cabang: "HQ", tglTerima: "2026-08-27", jatuhTempo: "2026-09-26", totalTagihan: 4500000, terbayar: 0, sisaHutang: 4500000, status: "Belum Lunas" }];
export const dummyKasbon = [{ id: "KSB-01", tanggal: "2026-08-15", karyawan: "Fajar", cabang: "Samadikun", nominal: 500000, alasan: "Sekolah", status: "Disetujui" }];