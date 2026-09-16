import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { pembayaran } from "@/db/schema";
import { geserPeriode, periodeAwal, type Periode } from "./bayar-awal";

/**
 * Helper tagihan "Sewa Bulanan" untuk penghuni yang sudah aktif (portal
 * /portal/bayar).
 *
 * Berbeda dengan "Pembayaran Awal" (paket 1/2/6 bulan saat penghuni baru),
 * pembayaran bulanan ini menagih seluruh periode yang sudah berjalan sejak
 * penghuni masuk sampai bulan berjalan selama belum tercatat Lunas. Setiap
 * tagihan yang dipilih dicatat Lunas satu per satu lewat web.
 *
 * File ini hanya boleh dipakai dari server (server action / server
 * component / route handler) karena mengakses database.
 */

export const STATUS_LUNAS = "Lunas";
export const STATUS_MENUNGGU = "Menunggu Konfirmasi";
export const STATUS_BELUM = "Belum Lunas";

/** Periode kalender saat ini (bulan & tahun) menurut waktu server. */
export function periodeSekarang(): Periode {
  const sekarang = new Date();
  return { bulan: sekarang.getMonth() + 1, tahun: sekarang.getFullYear() };
}

/** Bandingkan dua periode secara kronologis (untuk sorting/urutan). */
export function bandingkanPeriode(a: Periode, b: Periode): number {
  return a.tahun * 12 + a.bulan - (b.tahun * 12 + b.bulan);
}

/** Jarak bulan dari `awal` menuju `sampai`. Negatif bila `sampai` sebelum `awal`. */
export function selisihPeriode(awal: Periode, sampai: Periode): number {
  return bandingkanPeriode(sampai, awal);
}

/** Daftar periode berurutan inklusif dari `awal` sampai `sampai`. */
export function rentangPeriode(awal: Periode, sampai: Periode): Periode[] {
  const n = selisihPeriode(awal, sampai);
  if (n < 0) return [];
  return Array.from({ length: n + 1 }, (_, i) => geserPeriode(awal, i));
}

/** Kunci string tunggal untuk satu periode, mis. "2026-09". */
export function kunciPeriode(periode: Periode): string {
  return `${periode.tahun}-${String(periode.bulan).padStart(2, "0")}`;
}

/** Status pembayaran yang dipakai untuk menyaring himpunan periode. */
export type StatusPembayaran = "Lunas" | "Menunggu Konfirmasi" | "Belum Lunas";

/** Himpunan kunci periode yang ber-status tertentu milik satu penghuni. */
async function himpunanPeriodeStatus(
  idPenghuni: string,
  status: StatusPembayaran
): Promise<Set<string>> {
  const rows = await db
    .select({ bulan: pembayaran.bulan, tahun: pembayaran.tahun })
    .from(pembayaran)
    .where(
      and(eq(pembayaran.idPenghuni, idPenghuni), eq(pembayaran.statusBayar, status))
    );

  return new Set(rows.map((r) => kunciPeriode(r)));
}

/** Himpunan kunci periode yang sudah tercatat Lunas milik satu penghuni. */
export async function himpunanPeriodeLunas(
  idPenghuni: string
): Promise<Set<string>> {
  return himpunanPeriodeStatus(idPenghuni, STATUS_LUNAS);
}

/** Himpunan kunci periode yang sedang menunggu konfirmasi. */
export async function himpunanPeriodeMenunggu(
  idPenghuni: string
): Promise<Set<string>> {
  return himpunanPeriodeStatus(idPenghuni, STATUS_MENUNGGU);
}

/**
 * Tagihan sewa bulanan yang masih bisa dibayar oleh penghuni aktif: seluruh
 * bulan dari periode `tgl_masuk` sampai bulan berjalan yang tidak/belum punya
 * catatan Lunas DAN tidak sedang menunggu konfirmasi (bulan yang sudah diajukan
 * buktinya tidak bisa ditagih dua kali). Periode yang belum dimulai (masa
 * depan) tidak ditagihkan — tagihan baru otomatis muncul setiap awal periode.
 */
export async function daftarTagihanBulanan(
  idPenghuni: string,
  tglMasuk: Date
): Promise<Periode[]> {
  const awal = periodeAwal(tglMasuk);
  const sampai = periodeSekarang();
  if (selisihPeriode(awal, sampai) < 0) return [];

  const [lunas, menunggu] = await Promise.all([
    himpunanPeriodeStatus(idPenghuni, STATUS_LUNAS),
    himpunanPeriodeStatus(idPenghuni, STATUS_MENUNGGU),
  ]);

  return rentangPeriode(awal, sampai).filter(
    (p) =>
      !lunas.has(kunciPeriode(p)) && !menunggu.has(kunciPeriode(p))
  );
}

/** Daftar periode (bulan & tahun) yang sedang menunggu konfirmasi. */
export async function daftarPeriodeMenunggu(
  idPenghuni: string,
  tglMasuk: Date
): Promise<Periode[]> {
  const awal = periodeAwal(tglMasuk);
  const sampai = periodeSekarang();
  if (selisihPeriode(awal, sampai) < 0) return [];

  const menunggu = await himpunanPeriodeStatus(idPenghuni, STATUS_MENUNGGU);
  return rentangPeriode(awal, sampai).filter((p) =>
    menunggu.has(kunciPeriode(p))
  );
}

/** Jumlah bulan maksimum yang dapat dibayar sekaligus lewat pembayaran online. */
export const MAKS_PAKET_ONLINE = 6;

/**
 * Periode yang boleh dibayar online oleh penghuni aktif: rangkaian bulan
 * berurutan mulai dari tagihan terawal — **termasuk bulan yang belum jatuh
 * tempo** ("sewa dibayar di muka") sehingga opsi paket 1/2/6 bulan seperti
 * pada Pembayaran Awal juga tersedia untuk pembayaran berikutnya.
 *
 * Rangkaian berhenti begitu menemui bulan yang sudah Lunas atau sedang
 * menunggu konfirmasi (tidak boleh melompati bulan), dan paling banyak
 * `MAKS_PAKET_ONLINE` bulan.
 */
export async function daftarPeriodeBayarOnline(
  idPenghuni: string,
  tglMasuk: Date
): Promise<Periode[]> {
  const tagihan = await daftarTagihanBulanan(idPenghuni, tglMasuk);
  const awal = tagihan[0];
  if (!awal) return [];

  const [lunas, menunggu] = await Promise.all([
    himpunanPeriodeStatus(idPenghuni, STATUS_LUNAS),
    himpunanPeriodeStatus(idPenghuni, STATUS_MENUNGGU),
  ]);

  const periode: Periode[] = [];
  for (let i = 0; i < MAKS_PAKET_ONLINE; i++) {
    const p = geserPeriode(awal, i);
    const kunci = kunciPeriode(p);
    if (lunas.has(kunci) || menunggu.has(kunci)) break;
    periode.push(p);
  }
  return periode;
}
