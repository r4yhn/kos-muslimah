/**
 * Helper bukti pembayaran online (fitur "Menunggu Konfirmasi", Roadmap 1B).
 *
 * Server-only. Bukti dikirim lewat server action sebagai field `bukti` pada
 * multipart FormData; divalidasi tipe & ukuran lalu disimpan sebagai data URL
 * base64 di kolom `pembayaran.bukti_pembayaran` (solusi tanpa bucket storage).
 *
 * Catatan: simpan bukti sebagai gambar base64 cukup untuk skala kecil; bila
 * volume besar, migrasikan ke Supabase Storage dan simpan path di DB.
 */

/** Ukuran maksimum file bukti (2 MB, batas server action body sudah dinaikkan ke 5 MB). */
export const MAKS_BUKTI_BYTE = 2 * 1024 * 1024;

/** Tipe berkas yang diterima sebagai bukti. */
const TIPE_IZIN = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export type BacaBuktiResult =
  | { ok: true; dataUrl: string; namaFile: string }
  | { ok: false; error: string };

/** Ambil & validasi file bukti dari FormData server action. */
export async function bacaBuktiDariForm(
  formData: FormData
): Promise<BacaBuktiResult> {
  const file = formData.get("bukti");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Lampirkan foto bukti pembayaran terlebih dahulu." };
  }

  if (!TIPE_IZIN.has(file.type)) {
    return {
      ok: false,
      error:
        "Format bukti tidak didukung. Gunakan JPG, PNG, WebP, atau HEIC.",
    };
  }
  if (file.size > MAKS_BUKTI_BYTE) {
    return {
      ok: false,
      error: "Ukuran bukti terlalu besar (maksimal 2 MB).",
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const base64 = Buffer.from(bytes).toString("base64");
  return {
    ok: true,
    dataUrl: `data:${file.type};base64,${base64}`,
    namaFile: file.name,
  };
}
