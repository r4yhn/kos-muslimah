import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import type { UserRole } from "@/types/next-auth";
import {
  NAMA_MAX,
  NAMA_MIN,
  PASSWORD_MIN,
  emailValid,
} from "./profil-aturan";

/**
 * Halaman "Ubah Password & Profil" (Roadmap 2D) untuk peran staf:
 * - `admin`   -> `/profil` (panel pengelola)
 * - `pemilik` -> `/monitoring/profil` (area pemantauan)
 *
 * File ini hanya boleh dipakai dari server (server action) karena mengakses
 * database & memverifikasi hash password.
 *
 * Catatan keamanan: perubahan di sini hanya menyentuh **akun pengguna sendiri**
 * (nama, email, password) — bukan data utama kos — sehingga tetap aman
 * dilakukan dari area pemantauan yang read-only.
 */

export * from "./profil-aturan";

/** Data akun yang ditampilkan pada halaman profil. */
export type ProfilAkun = {
  id: string;
  nama: string;
  email: string;
  peran: UserRole;
  createdAt: Date;
};

/** Hasil operasi profil/password untuk ditampilkan pada form. */
export type HasilProfil = { error?: string; sukses?: string };

/** Ambil data akun milik pengguna yang sedang login. */
export async function ambilProfilAkun(
  idUser: string
): Promise<ProfilAkun | null> {
  const [row] = await db
    .select({
      id: users.id,
      nama: users.name,
      email: users.email,
      peran: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, idUser))
    .limit(1);

  return row ?? null;
}

/**
 * Simpan perubahan nama & email akun sendiri.
 * Email divalidasi formatnya dan dijaga tetap unik (tidak boleh dipakai akun
 * lain); email disimpan dalam huruf kecil mengikuti alur login.
 */
export async function simpanIdentitasAkun(
  idUser: string,
  input: { nama: string; email: string }
): Promise<HasilProfil> {
  const nama = input.nama.trim();
  const email = input.email.trim().toLowerCase();

  if (nama.length < NAMA_MIN) {
    return { error: `Nama minimal ${NAMA_MIN} karakter.` };
  }
  if (nama.length > NAMA_MAX) {
    return { error: `Nama maksimal ${NAMA_MAX} karakter.` };
  }
  if (!emailValid(email)) {
    return { error: "Email tidak valid (contoh: nama@domain.com)." };
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, idUser))
    .limit(1);
  if (!existing) return { error: "Akun tidak ditemukan." };

  const [bentrok] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email), ne(users.id, idUser)))
    .limit(1);
  if (bentrok) {
    return { error: `Email "${email}" sudah dipakai akun lain.` };
  }

  await db.update(users).set({ name: nama, email }).where(eq(users.id, idUser));

  return {
    sukses: "Profil tersimpan. Nama & email baru langsung dipakai pada sesi ini.",
  };
}

/**
 * Ganti password akun sendiri: password lama wajib benar, password baru minimal
 * `PASSWORD_MIN` karakter, harus sama dengan konfirmasinya, dan berbeda dari
 * password saat ini.
 */
export async function simpanPasswordAkun(
  idUser: string,
  input: { passwordLama: string; passwordBaru: string; konfirmasi: string }
): Promise<HasilProfil> {
  const passwordLama = input.passwordLama;
  const passwordBaru = input.passwordBaru;

  if (!passwordLama) return { error: "Password saat ini wajib diisi." };
  if (passwordBaru.length < PASSWORD_MIN) {
    return { error: `Password baru minimal ${PASSWORD_MIN} karakter.` };
  }
  if (passwordBaru !== input.konfirmasi) {
    return { error: "Konfirmasi password baru tidak sama." };
  }

  const [akun] = await db
    .select({ id: users.id, password: users.password })
    .from(users)
    .where(eq(users.id, idUser))
    .limit(1);
  if (!akun) return { error: "Akun tidak ditemukan." };

  const cocok = await bcrypt.compare(passwordLama, akun.password);
  if (!cocok) return { error: "Password saat ini salah." };

  const samaDenganSekarang = await bcrypt.compare(passwordBaru, akun.password);
  if (samaDenganSekarang) {
    return { error: "Password baru harus berbeda dari password saat ini." };
  }

  const hash = await bcrypt.hash(passwordBaru, 10);
  await db.update(users).set({ password: hash }).where(eq(users.id, idUser));

  return {
    sukses:
      "Password berhasil diganti. Gunakan password baru pada login berikutnya.",
  };
}
