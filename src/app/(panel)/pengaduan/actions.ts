"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { kirimNotifikasiKePenghuni } from "@/lib/notifikasi";
import {
  LABEL_STATUS_PENGADUAN,
  isStatusPengaduan,
  ubahStatusPengaduan,
} from "@/lib/pengaduan";

export type StatusPengaduanState =
  | { error?: string; sukses?: string }
  | undefined;

/**
 * Perbarui status penanganan pengaduan dari panel pengelola (`/pengaduan`).
 *
 * Alur kerja: admin memverifikasi kendala **di lapangan** terlebih dahulu, lalu
 * mencatat hasilnya di sini dan mengubah status menjadi `diproses` (sedang
 * ditangani) atau `selesai` (sudah tuntas). Catatan wajib diisi untuk kedua
 * status tersebut supaya penanganan dapat diaudit Pemilik Kos.
 *
 * Penghuni pelapor otomatis menerima notifikasi setiap status berubah.
 */
export async function simpanStatusPengaduan(
  _prevState: StatusPengaduanState,
  formData: FormData
): Promise<StatusPengaduanState> {
  const session = await auth();
  // Hanya pengelola (role "admin"); role "pemilik" bersifat read-only.
  if (session?.user?.role !== "admin") {
    return { error: "Hanya pengelola yang dapat memperbarui status pengaduan." };
  }

  const idPengaduan = String(formData.get("idPengaduan") ?? "").trim();
  const statusRaw = String(formData.get("status") ?? "").trim();
  const catatanAdmin = String(formData.get("catatanAdmin") ?? "").trim();

  if (!idPengaduan) return { error: "Pengaduan tidak dikenal." };
  if (!isStatusPengaduan(statusRaw)) {
    return { error: "Status pengaduan tidak valid." };
  }
  if (statusRaw === "diproses" && !catatanAdmin) {
    return {
      error:
        "Tuliskan hasil verifikasi lapangan sebelum menandai pengaduan Diproses.",
    };
  }
  if (statusRaw === "selesai" && !catatanAdmin) {
    return {
      error: "Tuliskan tindakan penyelesaian sebelum menandai pengaduan Selesai.",
    };
  }

  const hasil = await ubahStatusPengaduan({
    idPengaduan,
    status: statusRaw,
    catatanAdmin,
  });
  if (!hasil) return { error: "Pengaduan tidak ditemukan." };

  const label = LABEL_STATUS_PENGADUAN[statusRaw];
  await kirimNotifikasiKePenghuni(
    hasil.idPenghuni,
    `Pengaduan Anda: ${label}`,
    `Laporan kendala kamar Anda kini berstatus ${label}.${
      catatanAdmin ? ` Catatan pengelola: ${catatanAdmin}` : ""
    }`
  );

  revalidatePath("/pengaduan");
  revalidatePath("/monitoring");
  revalidatePath("/monitoring/pengaduan");
  revalidatePath("/portal/pengaduan");
  revalidatePath("/portal/notifikasi");

  return { sukses: `Status pengaduan diperbarui menjadi ${label}.` };
}
