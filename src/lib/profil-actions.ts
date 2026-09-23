"use server";

import { revalidatePath } from "next/cache";

import { auth, unstable_update } from "@/auth";
import {
  simpanIdentitasAkun,
  simpanPasswordAkun,
  type HasilProfil,
} from "@/lib/profil";
import type { UserRole } from "@/types/next-auth";

export type ProfilState = HasilProfil | undefined;

/** Peran staf yang punya halaman profil (admin panel & pemilik). */
const PERAN_STAF: readonly UserRole[] = ["admin", "pemilik"];

/**
 * Pastikan pemanggil adalah pengguna staf yang sudah login (admin/pemilik).
 * Penghuni memakai portal sendiri, jadi belum disertakan di halaman ini.
 */
async function idStafBerhak(): Promise<string | null> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return null;
  if (!PERAN_STAF.includes(user.role)) return null;
  return user.id;
}

/**
 * Simpan nama & email akun sendiri (server action halaman profil).
 * Setelah tersimpan, klaim identitas pada sesi JWT disegarkan lewat
 * `unstable_update` supaya header langsung menampilkan data terbaru.
 */
export async function simpanProfil(
  _prevState: ProfilState,
  formData: FormData
): Promise<ProfilState> {
  const idUser = await idStafBerhak();
  if (!idUser) {
    return { error: "Sesi berakhir atau akun tidak berhak. Silakan masuk kembali." };
  }

  const hasil = await simpanIdentitasAkun(idUser, {
    nama: String(formData.get("nama") ?? ""),
    email: String(formData.get("email") ?? ""),
  });

  if (hasil.error) return hasil;

  // Segarkan sesi (jwt `trigger: "update"`) + tampilan header di kedua area.
  await unstable_update({
    user: {
      name: String(formData.get("nama") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
    },
  });
  revalidatePath("/profil");
  revalidatePath("/monitoring/profil");

  return hasil;
}

/**
 * Ganti password akun sendiri (server action halaman profil).
 * Sesi tetap aktif setelah penggantian — password baru dipakai saat login
 * berikutnya.
 */
export async function gantiPassword(
  _prevState: ProfilState,
  formData: FormData
): Promise<ProfilState> {
  const idUser = await idStafBerhak();
  if (!idUser) {
    return { error: "Sesi berakhir atau akun tidak berhak. Silakan masuk kembali." };
  }

  return simpanPasswordAkun(idUser, {
    passwordLama: String(formData.get("passwordLama") ?? ""),
    passwordBaru: String(formData.get("passwordBaru") ?? ""),
    konfirmasi: String(formData.get("konfirmasi") ?? ""),
  });
}
