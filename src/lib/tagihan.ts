import { eq } from "drizzle-orm";

import { db } from "@/db";
import { kamar, pembayaran, penghuni } from "@/db/schema";
import {
  kunciPeriode,
  periodeSekarang,
  rentangPeriode,
  selisihPeriode,
} from "./bayar-bulanan";
import { periodeAwal, type Periode } from "./bayar-awal";
import { namaBulan } from "./format";

/**
 * Auto-generate tagihan sewa bulanan + jatuh tempo (Roadmap 1A).
 *
 * Prinsip:
 * - Tagihan direpresentasikan sebagai baris `pembayaran` ber-status
 *   "Belum Lunas" yang diterbitkan sistem, berisi nominal = harga sewa kamar,
 *   `tanggal_bayar = null`, dan `jatuh_tempo` = tanggal dalam bulan tagihan.
 * - Sistem menerbitkan tagihan untuk seluruh bulan yang **sudah berjalan**
 *   (periode `tgl_masuk` s.d. bulan berjalan) yang belum punya baris sama
 *   sekali (Lunas maupun Belum Lunas). Karena itu idempotent & aman dipanggil
 *   berulang; tagihan lama yang belum dibayar tetap menjadi tagihan menunggak.
 * - Saat penghuni/admin membayar, baris "Belum Lunas" ini diperbarui menjadi
 *   Lunas (logika `simpanPembayaranBulanan` & `simpanPembayaran`).
 *
 * File ini hanya boleh dipakai dari server.
 */

/** Tanggal jatuh tempo default tiap bulan (tanggal X bulan tagihan). */
export const HARI_JATUH_TEMPO = 5;

/** Tanggal jatuh tempo untuk satu periode tagihan (UTC tengah malam). */
export function tanggalJatuhTempo(periode: Periode): Date {
  return new Date(Date.UTC(periode.tahun, periode.bulan - 1, HARI_JATUH_TEMPO));
}

/** Hari ini sebagai Date UTC tengah malam (untuk perbandingan jatuh tempo). */
export function hariIniUtc(): Date {
  const sekarang = new Date();
  return new Date(
    Date.UTC(sekarang.getFullYear(), sekarang.getMonth(), sekarang.getDate())
  );
}

/** True bila tagihan (baris belum Lunas) sudah lewat jatuh temponya. */
export function sudahTerlambat(
  jatuhTempo: Date | null | undefined,
  hariIni: Date = hariIniUtc()
): boolean {
  if (!jatuhTempo) return false;
  return jatuhTempo.getTime() < hariIni.getTime();
}

/**
 * Terbitkan tagihan yang belum ada untuk satu penghuni aktif.
 * @returns jumlah tagihan baru yang dibuat (0 jika tidak ada).
 */
export async function sinkronTagihanPenghuni(
  idPenghuni: string
): Promise<number> {
  const [p] = await db
    .select({
      id: penghuni.id,
      status: penghuni.status,
      idKamar: penghuni.idKamar,
      tglMasuk: penghuni.tglMasuk,
      perluBayarAwal: penghuni.perluBayarAwal,
    })
    .from(penghuni)
    .where(eq(penghuni.id, idPenghuni))
    .limit(1);

  // Hanya penghuni aktif yang sudah resmi menempati (pembayaran awal tuntas).
  if (!p || p.status !== "Aktif" || !p.idKamar || p.perluBayarAwal) return 0;

  const [room] = await db
    .select({ id: kamar.id, hargaSewa: kamar.hargaSewa })
    .from(kamar)
    .where(eq(kamar.id, p.idKamar))
    .limit(1);
  if (!room) return 0;

  const awal = periodeAwal(p.tglMasuk);
  const sampai = periodeSekarang();
  if (selisihPeriode(awal, sampai) < 0) return 0; // belum mulai menghuni

  const periodeList = rentangPeriode(awal, sampai);
  if (periodeList.length === 0) return 0;

  // Baris yang sudah ada (Lunas = sudah dibayar; Belum Lunas = tagihan/manual).
  const existingRows = await db
    .select({ bulan: pembayaran.bulan, tahun: pembayaran.tahun })
    .from(pembayaran)
    .where(eq(pembayaran.idPenghuni, idPenghuni));
  const ada = new Set(existingRows.map((r) => kunciPeriode(r)));

  const belumAda = periodeList.filter(
    (periode) => !ada.has(kunciPeriode(periode))
  );
  if (belumAda.length === 0) return 0;

  await db.insert(pembayaran).values(
    belumAda.map(({ bulan, tahun }) => ({
      idPenghuni,
      tanggalBayar: null,
      jatuhTempo: tanggalJatuhTempo({ bulan, tahun }),
      bulan,
      tahun,
      jumlahBayar: room.hargaSewa,
      metodeBayar: "",
      keterangan: `Tagihan Sewa Bulanan — ${namaBulan(bulan)} ${tahun}`,
      statusBayar: "Belum Lunas" as const,
    }))
  );

  return belumAda.length;
}

/**
 * Terbitkan tagihan yang belum ada untuk seluruh penghuni aktif.
 * Idempotent — aman dipanggil dari halaman admin ataupun cron.
 * @returns jumlah total tagihan baru yang dibuat.
 */
export async function sinkronTagihanSemuaPenghuni(): Promise<number> {
  const penghuniAktif = await db
    .select({ id: penghuni.id })
    .from(penghuni)
    .where(eq(penghuni.status, "Aktif"));

  let total = 0;
  for (const p of penghuniAktif) {
    total += await sinkronTagihanPenghuni(p.id);
  }
  return total;
}

export type TagihanTerlambat = {
  jumlahTagihan: number;
  totalNominal: number;
  terlama: Date | null;
};

/**
 * Kumpulkan tagihan yang sudah lewat jatuh tempo (Belum Lunas & jatuh_tempo
 * < hari ini), dikelompokkan per penghuni. Dipakai dashboard admin.
 */
export async function daftarTagihanTerlambatPerPenghuni(): Promise<
  Map<string, TagihanTerlambat>
> {
  const hariIni = hariIniUtc();
  const rows = await db
    .select({
      idPenghuni: pembayaran.idPenghuni,
      jatuhTempo: pembayaran.jatuhTempo,
      jumlahBayar: pembayaran.jumlahBayar,
    })
    .from(pembayaran)
    .where(eq(pembayaran.statusBayar, "Belum Lunas"));

  const perPenghuni = new Map<string, TagihanTerlambat>();
  for (const r of rows) {
    if (!r.jatuhTempo) continue; // tanpa jatuh tempo -> tidak dihitung terlambat
    if (!sudahTerlambat(r.jatuhTempo, hariIni)) continue;

    const entry = perPenghuni.get(r.idPenghuni) ?? {
      jumlahTagihan: 0,
      totalNominal: 0,
      terlama: null,
    };
    entry.jumlahTagihan += 1;
    entry.totalNominal += r.jumlahBayar;
    if (!entry.terlama || r.jatuhTempo < entry.terlama) {
      entry.terlama = r.jatuhTempo;
    }
    perPenghuni.set(r.idPenghuni, entry);
  }

  return perPenghuni;
}
