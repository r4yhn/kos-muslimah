import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { kamar, pembayaran, penghuni } from "@/db/schema";

/**
 * Helper aturan "Bayar di Awal" (Penghuni Baru).
 *
 * Saat akun penghuni baru pertama kali login, sistem mengunci menu portal
 * dan mengarahkan ke halaman Pembayaran Awal (sewa bulan pertama berdasar
 * tgl_masuk). Kamar baru dianggap resmi "Terisi" setelah pembayaran awal
 * tercatat Lunas.
 *
 * File ini hanya boleh dipakai dari server (server action / server
 * component / route handler) karena mengakses database.
 */

export type Periode = { bulan: number; tahun: number };

/**
 * Paket pembayaran awal yang ditawarkan ke penghuni baru (jumlah bulan sewa
 * yang dibayar lunas di muka). Sistem menerima 1, 2, atau 6 bulan.
 */
export const PAKET_BAYAR_AWAL = [1, 2, 6] as const;
export type PaketBayarAwal = (typeof PAKET_BAYAR_AWAL)[number];

/**
 * Periode yang harus dibayar di awal = bulan & tahun `tgl_masuk` penghuni.
 * Tanggal disimpan sebagai date murni (UTC), sehingga diproses via UTC agar
 * tidak bergeser karena zona waktu.
 */
export function periodeAwal(tglMasuk: Date | string): Periode {
  const d = typeof tglMasuk === "string" ? new Date(tglMasuk) : tglMasuk;
  return { bulan: d.getUTCMonth() + 1, tahun: d.getUTCFullYear() };
}

/** Geser periode maju `n` bulan (n >= 0). */
export function geserPeriode(periode: Periode, n: number): Periode {
  const total = periode.tahun * 12 + (periode.bulan - 1) + n;
  return { bulan: (total % 12) + 1, tahun: Math.floor(total / 12) };
}

/**
 * Daftar periode (bulan & tahun) yang dicakup pembayaran awal untuk paket
 * `jumlahBulan` mulai dari periode `tgl_masuk`.
 */
export function daftarPeriodeAwal(
  tglMasuk: Date | string,
  jumlahBulan: number
): Periode[] {
  const awal = periodeAwal(tglMasuk);
  return Array.from({ length: jumlahBulan }, (_, i) => geserPeriode(awal, i));
}

/**
 * Sinkronkan status "Pembayaran Awal":
 * - jika sudah ada catatan pembayaran Lunas untuk periode awal, kunci dibuka
 *   (perlu_bayar_awal = false) dan kamar resmi menjadi "Terisi";
 * - jika belum, tidak ada perubahan.
 *
 * Dipanggil setelah pembayaran dicatat (oleh admin maupun portal penghuni)
 * dan saat memuat konteks portal, agar status selalu konsisten.
 *
 * @returns true bila terjadi perubahan (flag dibuka / kamar aktif).
 */
/**
 * Sinkronkan status "Pembayaran Awal":
 * - jika sudah ada catatan pembayaran Lunas untuk periode awal, kunci dibuka
 *   (perlu_bayar_awal = false) dan kamar resmi menjadi "Terisi";
 * - jika belum, tidak ada perubahan (kamar penghuni baru tetap "Tersedia"
 *   meskipun sudah "dipesan", sehingga tidak terhitung sebagai terisi).
 *
 * Dipanggil setelah pembayaran dicatat (oleh admin maupun portal penghuni)
 * dan saat memuat konteks portal, agar status selalu konsisten. Bersifat
 * idempoten & "self-healing": bila kunci sudah terbuka tetapi kamar belum
 * berstatus "Terisi", status kamar diperbaiki.
 *
 * @returns true bila terjadi perubahan (flag dibuka / kamar aktif).
 */
export async function sinkronPembayaranAwal(
  idPenghuni: string
): Promise<boolean> {
  const [row] = await db
    .select({
      id: penghuni.id,
      idKamar: penghuni.idKamar,
      status: penghuni.status,
      perluBayarAwal: penghuni.perluBayarAwal,
      tglMasuk: penghuni.tglMasuk,
    })
    .from(penghuni)
    .where(eq(penghuni.id, idPenghuni))
    .limit(1);

  if (!row) return false;

  const target = periodeAwal(row.tglMasuk);

  const [lunas] = await db
    .select({ id: pembayaran.id })
    .from(pembayaran)
    .where(
      and(
        eq(pembayaran.idPenghuni, idPenghuni),
        eq(pembayaran.bulan, target.bulan),
        eq(pembayaran.tahun, target.tahun),
        eq(pembayaran.statusBayar, "Lunas")
      )
    )
    .limit(1);

  if (!lunas) return false;

  const [room] = row.idKamar
    ? await db
        .select({ id: kamar.id, statusKamar: kamar.statusKamar })
        .from(kamar)
        .where(eq(kamar.id, row.idKamar))
        .limit(1)
    : [];

  const perluBukaKunci = row.perluBayarAwal;
  const perluAktifkanKamar = Boolean(
    row.idKamar && room && row.status === "Aktif" && room.statusKamar !== "Terisi"
  );

  if (!perluBukaKunci && !perluAktifkanKamar) return false;

  await db.transaction(async (tx) => {
    if (perluBukaKunci) {
      await tx
        .update(penghuni)
        .set({ perluBayarAwal: false })
        .where(eq(penghuni.id, idPenghuni));
    }

    if (perluAktifkanKamar && row.idKamar) {
      await tx
        .update(kamar)
        .set({ statusKamar: "Terisi" })
        .where(eq(kamar.id, row.idKamar));
    }
  });

  return true;
}
