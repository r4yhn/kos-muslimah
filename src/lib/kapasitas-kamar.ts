/**
 * Aturan kapasitas kamar — dipakai server (validasi pendaftaran & opsi kamar)
 * maupun komponen klien (label pilihan kamar / teks bantuan).
 *
 * File ini **tidak boleh** mengimpor apa pun yang bersifat server (database,
 * auth, dsb.) agar aman dipakai di komponen klien.
 */

/**
 * Jumlah maksimal penghuni (akun) yang boleh menempati satu kamar.
 * Setiap penghuni tetap punya akun portal sendiri (email & password berbeda).
 */
export const KAPASITAS_KAMAR = 2;

/** Label okupansi kamar, mis. "1/2" (dibatasi kapasitas). */
export function labelPenghuniKamar(terisi: number): string {
  const jumlah = Math.max(0, Math.min(terisi, KAPASITAS_KAMAR));
  return `${jumlah}/${KAPASITAS_KAMAR}`;
}

/** True bila kamar sudah tidak punya slot tersisa. */
export function kamarPenuh(terisi: number): boolean {
  return terisi >= KAPASITAS_KAMAR;
}
