/**
 * Uji cepat (sementara) perilaku arsip yang baru:
 * 1. penghuni menunggak TIDAK dikeluarkan / tidak diarsipkan otomatis;
 * 2. saat penghuni keluar (logout) data langsung masuk arsip + kamar Tersedia;
 * 3. data asli (baris penghuni & pembayaran) tidak dihapus permanen.
 *
 * Jalankan: npx tsx cek-arsip-logout.ts
 */
import "dotenv/config";
import { eq, like } from "drizzle-orm";

import { client, db } from "./src/db/index";
import {
  arsipPenghuni,
  kamar,
  notifikasi,
  pembayaran,
  penghuni,
} from "./src/db/schema";
import {
  arsipkanPenghuni,
  hariPembayaranPenghuni,
  labelPeriode,
  sinkronkanArsipPenghuni,
  tanggalJatuhTempoPeriode,
} from "./src/lib/arsip";
import { daftarTagihanBulanan } from "./src/lib/bayar-bulanan";
import { formatIDR, formatTanggal } from "./src/lib/format";

const PREFIX = "ZZ UJI LOGOUT ARSIP";
const KAMAR = "ZZ-UJI-LO";

async function hapusUji() {
  const rows = await db
    .select({ id: penghuni.id })
    .from(penghuni)
    .where(like(penghuni.nama, `${PREFIX}%`));
  for (const r of rows) {
    await db.delete(arsipPenghuni).where(eq(arsipPenghuni.idPenghuni, r.id));
    await db.delete(pembayaran).where(eq(pembayaran.idPenghuni, r.id));
    await db.delete(penghuni).where(eq(penghuni.id, r.id));
  }
  await db.delete(kamar).where(eq(kamar.noKamar, KAMAR));
  await db.delete(notifikasi).where(like(notifikasi.pesan, `%${PREFIX}%`));
}

async function main() {
  await hapusUji();

  const [room] = await db
    .insert(kamar)
    .values({
      noKamar: KAMAR,
      tipeKamar: "Uji",
      hargaSewa: 500000,
      statusKamar: "Terisi",
    })
    .returning({ id: kamar.id });

  const [p] = await db
    .insert(penghuni)
    .values({
      nama: `${PREFIX} A`,
      jenisKelamin: "Perempuan",
      alamat: "Alamat uji",
      noHp: "0800000030",
      tglMasuk: new Date(Date.UTC(2026, 0, 10)),
      idKamar: room.id,
      status: "Aktif",
      perluBayarAwal: false,
    })
    .returning({ id: penghuni.id });

  await db.insert(pembayaran).values({
    idPenghuni: p.id,
    tanggalBayar: new Date(Date.UTC(2026, 0, 5)),
    bulan: 1,
    tahun: 2026,
    jumlahBayar: 500000,
    metodeBayar: "Cash",
    statusBayar: "Lunas",
    keterangan: `${PREFIX} — Januari lunas`,
  });

  const menunggak = (await daftarTagihanBulanan(p.id, new Date(Date.UTC(2026, 0, 10))))
    .length;
  console.log("[1] bulan menunggak (belum dibayar):", menunggak);

  const sinkron1 = await sinkronkanArsipPenghuni();
  const [setelahSinkron] = await db
    .select({ status: penghuni.status, idKamar: penghuni.idKamar })
    .from(penghuni)
    .where(eq(penghuni.id, p.id));
  const [roomSetelahSinkron] = await db
    .select({ status: kamar.statusKamar })
    .from(kamar)
    .where(eq(kamar.id, room.id));
  console.log(
    "[2] sinkronkanArsipPenghuni (harus tidak mengeluarkan) -> backfill:",
    sinkron1.backfill,
    "| penghuni:",
    JSON.stringify(setelahSinkron),
    "| kamar:",
    roomSetelahSinkron?.status
  );

  // Simulasi penghuni menekan "Keluar" (logout) dari portal.
  const hasil = await arsipkanPenghuni(
    p.id,
    "Proses Keluar",
    "Penghuni keluar (logout) dari portal penghuni."
  );
  const [penghuniSetelah] = await db
    .select({ status: penghuni.status, idKamar: penghuni.idKamar })
    .from(penghuni)
    .where(eq(penghuni.id, p.id));
  const [roomSetelah] = await db
    .select({ status: kamar.statusKamar })
    .from(kamar)
    .where(eq(kamar.id, room.id));
  const [arsipRow] = await db
    .select({
      nama: arsipPenghuni.nama,
      noKamar: arsipPenghuni.noKamar,
      alasan: arsipPenghuni.alasan,
      catatan: arsipPenghuni.catatan,
      jumlah: arsipPenghuni.jumlahPembayaran,
      lunas: arsipPenghuni.totalPembayaran,
      riwayat: arsipPenghuni.riwayatPembayaran,
    })
    .from(arsipPenghuni)
    .where(eq(arsipPenghuni.idPenghuni, p.id));
  const barisPembayaran = await db
    .select({ id: pembayaran.id })
    .from(pembayaran)
    .where(eq(pembayaran.idPenghuni, p.id));

  console.log("[3] arsip dibuat:", hasil ? hasil.alasan : "TIDAK ADA");
  console.log(
    "[3] penghuni setelah logout ->",
    JSON.stringify(penghuniSetelah),
    "| kamar ->",
    roomSetelah?.status
  );
  console.log(
    "[3] isi arsip ->",
    arsipRow
      ? JSON.stringify({
          nama: arsipRow.nama,
          noKamar: arsipRow.noKamar,
          alasan: arsipRow.alasan,
          catatan: arsipRow.catatan,
          catatanPembayaran: arsipRow.jumlah,
          totalLunas: formatIDR.format(arsipRow.lunas),
          riwayat: arsipRow.riwayat.length,
        })
      : "TIDAK ADA"
  );
  console.log(
    "[4] data asli tetap ada (tidak dihapus permanen) — baris pembayaran:",
    barisPembayaran.length
  );

  // Keterangan jadwal pembayaran yang tampil di menu Bayar Sewa.
  const hari = await hariPembayaranPenghuni(p.id);
  const terawal = (await daftarTagihanBulanan(p.id, new Date(Date.UTC(2026, 0, 10))))[0];
  console.log(
    "[5] info menu Bayar Sewa -> jadwal tiap tanggal",
    hari,
    terawal
      ? `| tagihan berikutnya ${labelPeriode(terawal)} — jatuh tempo ${formatTanggal(
          tanggalJatuhTempoPeriode(terawal, hari)
        )}`
      : "| tidak ada tagihan"
  );

  await hapusUji();
  console.log("CLEANUP selesai — data uji dihapus.");

  await client.end();
}

main().catch(async (error) => {
  console.error("GAGAL:", error);
  try {
    await hapusUji();
    console.log("CLEANUP setelah gagal selesai.");
  } catch (e) {
    console.error("Cleanup gagal:", e);
  }
  process.exit(1);
});
