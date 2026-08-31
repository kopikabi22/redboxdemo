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