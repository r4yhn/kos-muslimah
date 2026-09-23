"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  buatAkunStaf,
  perbaruiAkunStaf,
  resetPasswordAkunStaf,
  type HasilAkun,
} from "@/lib/akun";

export type AkunState = HasilAkun | undefined;

/**
 * Hanya pengelola (role `admin`) yang boleh mengelola akun staf.
 * Role `pemilik` bersifat read-only; role `penghuni` memakai portal.
 */
async function idAdminBerhak(): Promise<string | null> {
  const session = await auth();
  if (session?.user?.role !== "admin") return null;
  return session.user.id;
}

/** Tambah akun staf baru (admin/pemilik) beserta email & password login. */
export async function tambahAkunStaf(
  _prevState: AkunState,
  formData: FormData
): Promise<AkunState> {
  const idPemanggil = await idAdminBerhak();
  if (!idPemanggil) {
    return { error: "Hanya pengelola yang dapat menambah akun staf." };
  }

  const password = String(formData.get("password") ?? "");
  const konfirmasi = String(formData.get("konfirmasi") ?? "");
  if (password !== konfirmasi) {
    return { error: "Konfirmasi password tidak sama." };
  }

  const hasil = await buatAkunStaf({
    nama: String(formData.get("nama") ?? ""),
    email: String(formData.get("email") ?? ""),
    peran: String(formData.get("peran") ?? ""),
    password,
  });

  if (hasil.sukses) revalidatePath("/akun");
  return hasil;
}

/** Ubah nama & email akun staf. */
export async function ubahAkunStaf(
  _prevState: AkunState,
  formData: FormData
): Promise<AkunState> {
  const idPemanggil = await idAdminBerhak();
  if (!idPemanggil) {
    return { error: "Hanya pengelola yang dapat mengubah akun staf." };
  }

  const hasil = await perbaruiAkunStaf(
    idPemanggil,
    String(formData.get("idAkun") ?? "").trim(),
    {
      nama: String(formData.get("nama") ?? ""),
      email: String(formData.get("email") ?? ""),
    }
  );

  if (hasil.sukses) revalidatePath("/akun");
  return hasil;
}

/** Reset password akun staf (tanpa password lama). */
export async function resetPasswordStaf(
  _prevState: AkunState,
  formData: FormData
): Promise<AkunState> {
  const idPemanggil = await idAdminBerhak();
  if (!idPemanggil) {
    return { error: "Hanya pengelola yang dapat mereset password akun staf." };
  }

  const hasil = await resetPasswordAkunStaf(
    idPemanggil,
    String(formData.get("idAkun") ?? "").trim(),
    {
      password: String(formData.get("password") ?? ""),
      konfirmasi: String(formData.get("konfirmasi") ?? ""),
    }
  );

  return hasil;
}
