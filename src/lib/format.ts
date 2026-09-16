/**
 * Utilitas format tanggal & angka (locale id-ID) yang dipakai seluruh panel.
 * Tanggal disimpan sebagai date murni; helper di sini konsisten memakai UTC
 * agar tidak bergeser hari akibat perbedaan zona waktu server.
 */

export const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

export function namaBulan(bulan: number): string {
  return NAMA_BULAN[bulan - 1] ?? String(bulan);
}

export const formatIDR = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/**
 * Parse nilai input tanggal (YYYY-MM-DD) menjadi Date tengah malam UTC.
 * Mengembalikan null bila format/tanggal tidak valid.
 */
export function parseTanggal(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const tahun = Number(match[1]);
  const bulan = Number(match[2]);
  const tanggal = Number(match[3]);
  if (bulan < 1 || bulan > 12 || tanggal < 1 || tanggal > 31) return null;

  const date = new Date(Date.UTC(tahun, bulan - 1, tanggal));
  const valid =
    date.getUTCFullYear() === tahun &&
    date.getUTCMonth() === bulan - 1 &&
    date.getUTCDate() === tanggal;
  return valid ? date : null;
}

/** Serialisasi Date menjadi string input tanggal (YYYY-MM-DD), berbasis UTC. */
export function toTanggalInput(date: Date | string | null | undefined): string {
  if (date == null) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const tahun = d.getUTCFullYear();
  const bulan = String(d.getUTCMonth() + 1).padStart(2, "0");
  const tanggal = String(d.getUTCDate()).padStart(2, "0");
  return `${tahun}-${bulan}-${tanggal}`;
}

/** Tanggal hari ini (zona lokal) sebagai string input YYYY-MM-DD. */
export function tanggalInputHariIni(): string {
  const sekarang = new Date();
  const tahun = sekarang.getFullYear();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const tanggal = String(sekarang.getDate()).padStart(2, "0");
  return `${tahun}-${bulan}-${tanggal}`;
}

/** Format tanggal panjang Indonesia, mis. "7 September 2026". Null -> "—". */
export function formatTanggal(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }
): string {
  if (date == null) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    ...options,
    timeZone: "UTC",
  }).format(d);
}

/** Daftar tahun untuk dropdown filter/form (tahun berjalan+1 s.d. tahunMin). */
export function daftarTahun(tahunMin?: number): number[] {
  const sekarang = new Date().getFullYear();
  const dari = tahunMin ?? sekarang - 1;
  const tahun: number[] = [];
  for (let t = sekarang + 1; t >= dari; t--) tahun.push(t);
  return tahun;
}
