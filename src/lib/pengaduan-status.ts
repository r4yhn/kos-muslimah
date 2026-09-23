/**
 * Bagian modul "Pengaduan & Laporan Kendala" yang **aman diimpor komponen
 * client** (tanpa akses database sama sekali): konstanta status, label, batas
 * panjang deskripsi, dan validatornya.
 *
 * Query Drizzle-nya ada di `lib/pengaduan.ts` (server-only), yang meng-reexport
 * berkas ini sehingga halaman/Server Action cukup mengimpor dari
 * `@/lib/pengaduan`. Komponen client (`"use client"`) **wajib** mengimpor dari
 * sini agar bundel browser tidak ikut menarik driver PostgreSQL.
 */

/** Status penanganan yang valid — selaras dengan enum `status_pengaduan`. */
export const STATUS_PENGADUAN = ["pending", "diproses", "selesai"] as const;
export type StatusPengaduan = (typeof STATUS_PENGADUAN)[number];

/** Label siap tampil (huruf awal kapital sesuai istilah di UI). */
export const LABEL_STATUS_PENGADUAN: Record<StatusPengaduan, string> = {
  pending: "Pending",
  diproses: "Diproses",
  selesai: "Selesai",
};

/** Panjang deskripsi kendala yang diterima (karakter). */
export const DESKRIPSI_MIN = 10;
export const DESKRIPSI_MAX = 2000;

/** Validasi nilai status dari input pengguna / query string. */
export function isStatusPengaduan(nilai: unknown): nilai is StatusPengaduan {
  return (
    typeof nilai === "string" &&
    (STATUS_PENGADUAN as readonly string[]).includes(nilai)
  );
}

/** Jumlah pengaduan per status (untuk kartu ringkasan dashboard). */
export type RingkasanPengaduan = Record<StatusPengaduan, number> & {
  total: number;
};
