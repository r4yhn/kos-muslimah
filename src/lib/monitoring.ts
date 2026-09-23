import { and, count, eq, sum } from "drizzle-orm";

import { db } from "@/db";
import { kamar, pembayaran, penghuni } from "@/db/schema";
import { ringkasanPengaduan, type RingkasanPengaduan } from "./pengaduan";

/**
 * Data ringkasan untuk area pemantauan Pemilik Kos (`/monitoring`).
 *
 * PENTING — area ini **read-only**: seluruh fungsi di file ini hanya membaca
 * database dan tidak pernah menerbitkan tagihan (`sinkronTagihan*`) maupun
 * mengubah data apa pun, sehingga membuka halaman pemantauan tidak mengubah
 * keadaan sistem.
 *
 * File ini hanya boleh dipakai dari server (server component / route handler).
 */

export type RingkasanMonitoring = {
  bulan: number;
  tahun: number;
  totalKamar: number;
  kamarTerisi: number;
  kamarTersedia: number;
  kamarPerbaikan: number;
  /** Persentase kamar terisi (0 bila belum ada data kamar). */
  okupansi: number;
  penghuniAktif: number;
  penghuniTotal: number;
  /** Penghuni aktif yang belum melunasi Pembayaran Awal. */
  penghuniMenungguAwal: number;
  /** Pendapatan sewa (Lunas) pada bulan berjalan. */
  pendapatanBulan: number;
  pendapatanBulanJumlah: number;
  /** Piutang tagihan (Belum Lunas) bulan berjalan. */
  piutangBulan: number;
  piutangBulanJumlah: number;
  /** Pengajuan pembayaran yang masih menunggu konfirmasi admin. */
  menungguBulan: number;
  menungguBulanJumlah: number;
  /** Akumulasi pendapatan (Lunas) tahun berjalan. */
  pendapatanTahun: number;
  pengaduan: RingkasanPengaduan;
};

/** Susun ringkasan pemantauan (kamar, penghuni, keuangan, pengaduan). */
export async function ringkasanMonitoring(): Promise<RingkasanMonitoring> {
  const sekarang = new Date();
  const bulan = sekarang.getMonth() + 1;
  const tahun = sekarang.getFullYear();

  const [kamarCounts, penghuniRows, bayarBulanRows, bayarTahunRows, pengaduan] =
    await Promise.all([
      db
        .select({ status: kamar.statusKamar, total: count() })
        .from(kamar)
        .groupBy(kamar.statusKamar),
      db
        .select({
          status: penghuni.status,
          perluBayarAwal: penghuni.perluBayarAwal,
          total: count(),
        })
        .from(penghuni)
        .groupBy(penghuni.status, penghuni.perluBayarAwal),
      db
        .select({
          status: pembayaran.statusBayar,
          jumlah: count(),
          nominal: sum(pembayaran.jumlahBayar),
        })
        .from(pembayaran)
        .where(
          and(eq(pembayaran.bulan, bulan), eq(pembayaran.tahun, tahun))
        )
        .groupBy(pembayaran.statusBayar),
      db
        .select({ nominal: sum(pembayaran.jumlahBayar) })
        .from(pembayaran)
        .where(
          and(
            eq(pembayaran.tahun, tahun),
            eq(pembayaran.statusBayar, "Lunas")
          )
        ),
      ringkasanPengaduan(),
    ]);

  const kamarStatus = (status: string) =>
    kamarCounts.find((r) => r.status === status)?.total ?? 0;

  const totalKamar = kamarCounts.reduce((acc, r) => acc + r.total, 0);
  const kamarTerisi = kamarStatus("Terisi");

  const penghuniTotal = penghuniRows.reduce((acc, r) => acc + r.total, 0);
  const penghuniAktif = penghuniRows
    .filter((r) => r.status === "Aktif")
    .reduce((acc, r) => acc + r.total, 0);
  const penghuniMenungguAwal = penghuniRows
    .filter((r) => r.perluBayarAwal)
    .reduce((acc, r) => acc + r.total, 0);

  const bayarStatus = (status: string) =>
    bayarBulanRows.find((r) => r.status === status);

  const lunas = bayarStatus("Lunas");
  const belumLunas = bayarStatus("Belum Lunas");
  const menunggu = bayarStatus("Menunggu Konfirmasi");

  return {
    bulan,
    tahun,
    totalKamar,
    kamarTerisi,
    kamarTersedia: kamarStatus("Tersedia"),
    kamarPerbaikan: kamarStatus("Perbaikan"),
    okupansi:
      totalKamar > 0 ? Math.round((kamarTerisi / totalKamar) * 100) : 0,
    penghuniAktif,
    penghuniTotal,
    penghuniMenungguAwal,
    pendapatanBulan: Number(lunas?.nominal ?? 0),
    pendapatanBulanJumlah: lunas?.jumlah ?? 0,
    piutangBulan: Number(belumLunas?.nominal ?? 0),
    piutangBulanJumlah: belumLunas?.jumlah ?? 0,
    menungguBulan: Number(menunggu?.nominal ?? 0),
    menungguBulanJumlah: menunggu?.jumlah ?? 0,
    pendapatanTahun: Number(bayarTahunRows[0]?.nominal ?? 0),
    pengaduan,
  };
}
