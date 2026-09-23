/**
 * Aturan (batas panjang) data profil & password yang **aman dipakai komponen
 * client** — tanpa akses database. Dipakai bersama oleh form profil di panel
 * pengelola (`/profil`) dan area pemantauan pemilik (`/monitoring/profil`).
 *
 * Validasi sesungguhnya tetap dijalankan di server (`lib/profil.ts`), yang
 * meng-reexport berkas ini supaya pemanggil server cukup satu impor.
 */

export const NAMA_MIN = 3;
export const NAMA_MAX = 255;
export const PASSWORD_MIN = 8;

/**
 * Validasi format email sederhana (dipakai form profil & halaman Kelola Akun).
 * Tidak menyentuh database sehingga aman dipakai komponen client.
 */
export function emailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
