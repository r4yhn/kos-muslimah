import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import {
  arsipPenghuni,
  kamar,
  pembayaran,
  penghuni,
  type RiwayatPembayaranArsip,
} from "@/db/schema";
import type { Periode } from "./bayar-awal";
import { namaBulan, toTanggalInput } from "./format";
import { kirimNotifikasiKeRole } from "./notifikasi";
import { HARI_JATUH_TEMPO, hariIniUtc } from "./tagihan";

/**
 * Fitur **Arsip Otomatis & Pengosongan Kamar**.
 *
 * Setiap penghuni yang keluar — diproses pengelola atau karena keluar/*logout*
 * dari portal — akan:
 * 1. disalin sebagai **snapshot** ke tabel `arsip_penghuni` (identitas, kamar
 *    yang ditinggalkan, ringkasan + salinan riwayat pembayarannya) — tidak ada
 *    data yang dihapus permanen;
 * 2. ditandai `status = 'Keluar'` dengan `id_kamar` dilepas; dan
 * 3. kamar yang ditinggalkan otomatis kembali ber-status **Tersedia** bila
 *    sudah tidak ada penghuni aktif lain di kamar tersebut (kapasitas kamar
 *    tetap dihormati).
 *
 * Snapshot inilah yang tampil pada menu **Arsip** di panel admin sebagai pusat
 * informasi riwayat penghuni (mis. permintaan data oleh Kepolisian / Satpol PP).
 *
 * Penghuni **tidak diberi tahu** soal pengarsipan: tidak ada notifikasi, tidak
 * ada peringatan jatuh tempo, dan tidak ada data arsip/jatuh tempo pada navbar
 * portal — keterangan jadwal pembayaran cukup tampil sebagai info di menu
 * *Bayar Sewa*. Penghuni juga tidak pernah dikeluarkan karena belum membayar.
 *
 * File ini hanya boleh dipakai dari server (server action / server component /
 * route handler) karena mengakses database.
 */

/* ================================================================
 * Konstanta alasan pengarsipan
 * ================================================================ */

export const ALASAN_ARSIP = ["Proses Keluar", "Habis Masa Sewa"] as const;
export type AlasanArsip = (typeof ALASAN_ARSIP)[number];

/** True bila string termasuk alasan arsip yang dikenal. */
export function isAlasanArsip(nilai: string): nilai is AlasanArsip {
  return (ALASAN_ARSIP as readonly string[]).includes(nilai);
}

/** Label manusiawi tiap alasan (dipakai badge & ringkasan). */
export const LABEL_ALASAN_ARSIP: Record<AlasanArsip, string> = {
  "Proses Keluar": "Proses Keluar",
  "Habis Masa Sewa": "Habis Masa Sewa",
};

/** Penjelasan default yang disimpan di kolom `catatan` bila tidak diisi. */
export const DESKRIPSI_ALASAN_ARSIP: Record<AlasanArsip, string> = {
  "Proses Keluar":
    "Penghuni mengakhiri masa sewa (proses keluar) — diproses pengelola, diajukan penghuni lewat portal, atau keluar/logout dari portal; kamar dikosongkan kembali.",
  "Habis Masa Sewa":
    "Data lama yang diarsipkan otomatis oleh sistem sebelum aturan arsip saat keluar diberlakukan.",
};

/* ================================================================
 * Jadwal pembayaran bulanan penghuni (keterangan di menu portal —
 * bukan pemberitahuan/peringatan)
 * ================================================================ */

/** Indeks bulan absolut dari sebuah periode (untuk perbandingan kronologis). */
function indeksPeriode(periode: Periode): number {
  return periode.tahun * 12 + (periode.bulan - 1);
}

/** Jumlah hari dalam satu periode bulan (28–31). */
export function jumlahHariPeriode(periode: Periode): number {
  return new Date(Date.UTC(periode.tahun, periode.bulan, 0)).getUTCDate();
}

/**
 * Tanggal jatuh tempo satu periode tagihan, mengikuti **tanggal pembayaran
 * bulanan penghuni** (mis. selalu tanggal 23 karena pembayaran sebelumnya
 * tanggal 23). Bila bulan tersebut lebih pendek dari tanggal itu, jatuh tempo
 * disesuaikan ke hari terakhir bulan tersebut.
 */
export function tanggalJatuhTempoPeriode(
  periode: Periode,
  hariPembayaran: number
): Date {
  const hari = Math.min(
    Math.max(1, hariPembayaran),
    jumlahHariPeriode(periode)
  );
  return new Date(Date.UTC(periode.tahun, periode.bulan - 1, hari));
}

/**
 * True bila tanggal jatuh tempo **sudah tiba** — termasuk tepat pada harinya.
 *
 * Dipakai untuk menampilkan keterangan jadwal pembayaran di menu portal
 * penghuni, bukan sebagai pemberitahuan/peringatan.
 */
export function jatuhTempoTiba(
  jatuhTempo: Date,
  hariIni: Date = hariIniUtc()
): boolean {
  return hariIni.getTime() >= jatuhTempo.getTime();
}

/**
 * Tanggal pembayaran bulanan penghuni (1–31) yang dipakai sebagai acuan jatuh
 * tempo: diambil dari **pembayaran Lunas terakhir** milik penghuni tersebut.
 *
 * Bila belum ada pembayaran Lunas bertanggal (data lama), dipakai tenggang
 * bawaan sistem (`HARI_JATUH_TEMPO`).
 */
export async function hariPembayaranPenghuni(
  idPenghuni: string
): Promise<number> {
  const [row] = await db
    .select({ tanggalBayar: pembayaran.tanggalBayar })
    .from(pembayaran)
    .where(
      and(
        eq(pembayaran.idPenghuni, idPenghuni),
        eq(pembayaran.statusBayar, "Lunas"),
        isNotNull(pembayaran.tanggalBayar)
      )
    )
    .orderBy(desc(pembayaran.tanggalBayar))
    .limit(1);

  const hari = row?.tanggalBayar?.getUTCDate();
  return hari && hari >= 1 && hari <= 31 ? hari : HARI_JATUH_TEMPO;
}

/** Label satu periode untuk pemberitahuan, mis. "September 2026". */
export function labelPeriode(periode: Periode): string {
  return `${namaBulan(periode.bulan)} ${periode.tahun}`;
}

/** Periode paling akhir dari daftar periode yang sudah dibayar. */
function periodeTerakhirDari(periodeLunas: Periode[]): Periode | null {
  if (periodeLunas.length === 0) return null;
  return periodeLunas.reduce((akhir, p) =>
    indeksPeriode(p) > indeksPeriode(akhir) ? p : akhir
  );
}

/* ================================================================
 * Pengarsipan
 * ================================================================ */

/** Ringkasan hasil satu proses pengarsipan penghuni. */
export type HasilArsip = {
  idArsip: string;
  idPenghuni: string;
  nama: string;
  noKamar: string | null;
  tglKeluar: Date;
  alasan: AlasanArsip;
};

/**
 * Pindahkan satu penghuni ke `arsip_penghuni` + kosongkan kamarnya.
 *
 * Bersifat **idempotent**: bila penghuni sudah punya baris arsip, fungsi ini
 * tidak melakukan apa pun dan mengembalikan `null`. Aman dipanggil dari server
 * action (proses keluar) maupun secara otomatis (logout portal / pemindaian
 * berkala).
 *
 * @param idPenghuni data penghuni yang dikeluarkan
 * @param alasan     pemicu pengarsipan (`alasan_arsip`)
 * @param catatan    catatan tambahan opsional (mis. alasan dari penghuni)
 */
export async function arsipkanPenghuni(
  idPenghuni: string,
  alasan: AlasanArsip,
  catatan?: string | null
): Promise<HasilArsip | null> {
  const [row] = await db
    .select({
      id: penghuni.id,
      nama: penghuni.nama,
      jenisKelamin: penghuni.jenisKelamin,
      alamat: penghuni.alamat,
      noHp: penghuni.noHp,
      tglMasuk: penghuni.tglMasuk,
      status: penghuni.status,
      perluBayarAwal: penghuni.perluBayarAwal,
      idKamar: penghuni.idKamar,
      noKamar: kamar.noKamar,
      tipeKamar: kamar.tipeKamar,
      hargaSewa: kamar.hargaSewa,
    })
    .from(penghuni)
    .leftJoin(kamar, eq(kamar.id, penghuni.idKamar))
    .where(eq(penghuni.id, idPenghuni))
    .limit(1);

  if (!row) return null;

  // Sudah pernah diarsipkan -> hentikan agar tidak ada data ganda.
  const [sudahDiarsip] = await db
    .select({ id: arsipPenghuni.id })
    .from(arsipPenghuni)
    .where(eq(arsipPenghuni.idPenghuni, idPenghuni))
    .limit(1);
  if (sudahDiarsip) return null;

  // Penghuni baru yang belum melunasi Pembayaran Awal belum punya masa sewa
  // untuk diarsipkan otomatis (pengarsipan tetap boleh bila dipicu pengelola).
  if (
    row.status === "Aktif" &&
    row.perluBayarAwal &&
    alasan === "Habis Masa Sewa"
  ) {
    return null;
  }

  // Bekukan riwayat pembayaran ke dalam arsip.
  const riwayatRows = await db
    .select({
      bulan: pembayaran.bulan,
      tahun: pembayaran.tahun,
      jumlahBayar: pembayaran.jumlahBayar,
      metodeBayar: pembayaran.metodeBayar,
      keterangan: pembayaran.keterangan,
      statusBayar: pembayaran.statusBayar,
      tanggalBayar: pembayaran.tanggalBayar,
      jatuhTempo: pembayaran.jatuhTempo,
    })
    .from(pembayaran)
    .where(eq(pembayaran.idPenghuni, idPenghuni))
    .orderBy(asc(pembayaran.tahun), asc(pembayaran.bulan));

  const riwayatPembayaran: RiwayatPembayaranArsip[] = riwayatRows.map((r) => ({
    bulan: r.bulan,
    tahun: r.tahun,
    jumlahBayar: r.jumlahBayar,
    statusBayar: r.statusBayar,
    metodeBayar: r.metodeBayar,
    keterangan: r.keterangan,
    tanggalBayar: r.tanggalBayar ? toTanggalInput(r.tanggalBayar) : null,
    jatuhTempo: r.jatuhTempo ? toTanggalInput(r.jatuhTempo) : null,
  }));

  const totalPembayaran = riwayatRows
    .filter((r) => r.statusBayar === "Lunas")
    .reduce((total, r) => total + r.jumlahBayar, 0);
  const totalTunggakan = riwayatRows
    .filter((r) => r.statusBayar !== "Lunas")
    .reduce((total, r) => total + r.jumlahBayar, 0);

  const lunas = periodeTerakhirDari(
    riwayatRows
      .filter((r) => r.statusBayar === "Lunas")
      .map((r) => ({ bulan: r.bulan, tahun: r.tahun }))
  );

  const tglKeluar = hariIniUtc();
  const catatanFinal =
    catatan && catatan.trim() ? catatan.trim() : DESKRIPSI_ALASAN_ARSIP[alasan];

  const hasil = await db.transaction(async (tx) => {
    const [arsip] = await tx
      .insert(arsipPenghuni)
      .values({
        idPenghuni,
        nama: row.nama,
        jenisKelamin: row.jenisKelamin,
        alamat: row.alamat,
        noHp: row.noHp,
        noKamar: row.noKamar,
        tipeKamar: row.tipeKamar,
        hargaSewa: row.hargaSewa,
        tglMasuk: row.tglMasuk,
        tglKeluar,
        alasan,
        jumlahPembayaran: riwayatPembayaran.length,
        totalPembayaran,
        totalTunggakan,
        periodeTerakhir: lunas
          ? `${namaBulan(lunas.bulan)} ${lunas.tahun}`
          : null,
        riwayatPembayaran,
        catatan: catatanFinal,
      })
      .returning({ id: arsipPenghuni.id });

    // Penghuni resmi "Keluar" dan kamarnya dilepas (dikosongkan).
    if (row.status !== "Keluar" || row.idKamar || row.perluBayarAwal) {
      await tx
        .update(penghuni)
        .set({ status: "Keluar", idKamar: null, perluBayarAwal: false })
        .where(eq(penghuni.id, idPenghuni));
    }

    // Kamar kembali "Tersedia" bila tidak ada penghuni aktif lain di kamar itu.
    if (row.idKamar) {
      const [sisa] = await tx
        .select({ total: count() })
        .from(penghuni)
        .where(
          and(eq(penghuni.idKamar, row.idKamar), eq(penghuni.status, "Aktif"))
        );
      if ((sisa?.total ?? 0) === 0) {
        await tx
          .update(kamar)
          .set({ statusKamar: "Tersedia" })
          .where(eq(kamar.id, row.idKamar));
      }
    }

    const hasilArsip: HasilArsip = {
      idArsip: arsip.id,
      idPenghuni,
      nama: row.nama,
      noKamar: row.noKamar,
      tglKeluar,
      alasan,
    };
    return hasilArsip;
  });

  // Notifikasi otomatis **hanya untuk pengelola** (di luar transaksi: kegagalan
  // notifikasi tidak boleh membatalkan pengarsipan yang sudah tersimpan).
  // Penghuni TIDAK diberi tahu apa pun — pengarsipan adalah urusan internal
  // pengelola (agar penghuni tidak perlu tahu soal jatuh tempo/arsip).
  const labelKamar = row.noKamar ? `kamar ${row.noKamar}` : "tanpa kamar";
  const labelAlasan = LABEL_ALASAN_ARSIP[alasan];
  await kirimNotifikasiKeRole(
    "admin",
    "Penghuni Diarsipkan",
    `${row.nama} (${labelKamar}) telah keluar — alasan: ${labelAlasan}. Data riwayat penghuni dipindahkan ke menu Arsip (tidak dihapus permanen) dan kamar otomatis dikembalikan ke status Tersedia bila tidak ada penghuni aktif lain.`
  );

  return hasil;
}

/* ================================================================
 * Sinkronisasi arsip
 * ================================================================ */

/** Jumlah data lama ber-status "Keluar" yang dilengkapi ke arsip. */
export type HasilSinkronArsip = {
  backfill: number;
};

/**
 * Pemindaian **pelengkap arsip** (idempotent) — dipanggil dari halaman
 * pengelola & endpoint cron: memindahkan data lama ber-status `Keluar` yang
 * belum punya baris arsip (mis. ditandai keluar sebelum fitur arsip ada).
 */
export async function sinkronkanArsipPenghuni(): Promise<HasilSinkronArsip> {
  const belumDiarsip = await db
    .select({ id: penghuni.id })
    .from(penghuni)
    .leftJoin(arsipPenghuni, eq(arsipPenghuni.idPenghuni, penghuni.id))
    .where(and(eq(penghuni.status, "Keluar"), isNull(arsipPenghuni.id)));

  let backfill = 0;
  for (const p of belumDiarsip) {
    if (await arsipkanPenghuni(p.id, "Proses Keluar")) backfill += 1;
  }

  return { backfill };
}

/* ================================================================
 * Query untuk halaman Arsip
 * ================================================================ */

/** Filter daftar arsip: pencarian bebas + alasan pengarsipan. */
export type FilterArsip = {
  q?: string;
  alasan?: AlasanArsip;
};

const kolomArsip = {
  id: arsipPenghuni.id,
  idPenghuni: arsipPenghuni.idPenghuni,
  nama: arsipPenghuni.nama,
  jenisKelamin: arsipPenghuni.jenisKelamin,
  alamat: arsipPenghuni.alamat,
  noHp: arsipPenghuni.noHp,
  noKamar: arsipPenghuni.noKamar,
  tipeKamar: arsipPenghuni.tipeKamar,
  hargaSewa: arsipPenghuni.hargaSewa,
  tglMasuk: arsipPenghuni.tglMasuk,
  tglKeluar: arsipPenghuni.tglKeluar,
  alasan: arsipPenghuni.alasan,
  jumlahPembayaran: arsipPenghuni.jumlahPembayaran,
  totalPembayaran: arsipPenghuni.totalPembayaran,
  totalTunggakan: arsipPenghuni.totalTunggakan,
  periodeTerakhir: arsipPenghuni.periodeTerakhir,
  riwayatPembayaran: arsipPenghuni.riwayatPembayaran,
  catatan: arsipPenghuni.catatan,
  createdAt: arsipPenghuni.createdAt,
};

/** Daftar arsip penghuni (yang paling baru keluar tampil paling atas). */
export async function daftarArsipPenghuni(filter: FilterArsip = {}) {
  const kondisi: SQL[] = [];

  if (filter.q) {
    const kata = `%${filter.q}%`;
    kondisi.push(
      or(
        ilike(arsipPenghuni.nama, kata),
        ilike(arsipPenghuni.noKamar, kata),
        ilike(arsipPenghuni.noHp, kata)
      ) as SQL
    );
  }
  if (filter.alasan) {
    kondisi.push(eq(arsipPenghuni.alasan, filter.alasan));
  }

  return db
    .select(kolomArsip)
    .from(arsipPenghuni)
    .where(kondisi.length > 0 ? and(...kondisi) : undefined)
    .orderBy(desc(arsipPenghuni.tglKeluar), asc(arsipPenghuni.nama));
}

/** Baris arsip (hasil `daftarArsipPenghuni`). */
export type BarisArsip = Awaited<
  ReturnType<typeof daftarArsipPenghuni>
>[number];

export type RingkasanArsip = {
  total: number;
  prosesKeluar: number;
  habisMasaSewa: number;
  /** Jumlah arsip dengan tanggal keluar pada tahun berjalan. */
  tahunIni: number;
  /** Akumulasi tunggakan yang tercatat pada seluruh arsip. */
  totalTunggakan: number;
};

/** Ringkasan arsip untuk kartu statistik halaman Arsip. */
export async function ringkasanArsip(): Promise<RingkasanArsip> {
  const awalTahun = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));

  const [kelompokAlasan, tahunIniRows] = await Promise.all([
    db
      .select({
        alasan: arsipPenghuni.alasan,
        total: count(),
        tunggakan: sql<number>`coalesce(sum(${arsipPenghuni.totalTunggakan}), 0)::int`,
      })
      .from(arsipPenghuni)
      .groupBy(arsipPenghuni.alasan),
    db
      .select({ total: count() })
      .from(arsipPenghuni)
      .where(gte(arsipPenghuni.tglKeluar, awalTahun)),
  ]);

  const ringkasan: RingkasanArsip = {
    total: 0,
    prosesKeluar: 0,
    habisMasaSewa: 0,
    tahunIni: tahunIniRows[0]?.total ?? 0,
    totalTunggakan: 0,
  };

  for (const row of kelompokAlasan) {
    ringkasan.total += row.total;
    ringkasan.totalTunggakan += row.tunggakan;
    if (row.alasan === "Proses Keluar") ringkasan.prosesKeluar = row.total;
    if (row.alasan === "Habis Masa Sewa") ringkasan.habisMasaSewa = row.total;
  }

  return ringkasan;
}

/**
 * Arsip terakhir milik satu penghuni — dipakai portal untuk menampilkan
 * keterangan "masa sewa berakhir / data diarsipkan" kepada mantan penghuni.
 */
export async function ambilArsipPenghuni(idPenghuni: string) {
  const [row] = await db
    .select(kolomArsip)
    .from(arsipPenghuni)
    .where(eq(arsipPenghuni.idPenghuni, idPenghuni))
    .orderBy(desc(arsipPenghuni.tglKeluar))
    .limit(1);

  return row ?? null;
}

