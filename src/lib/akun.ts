import bcrypt from "bcryptjs";
import { asc, eq, inArray, ne, and } from "drizzle-orm";

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
 * Halaman "Kelola Akun" (`/akun`, khusus pengelola/admin).
 *
 * Fungsinya mengelola **akun staf** — `admin` (pengelola) & `pemilik` (Pemilik
 * Kos): melihat daftar akun, membuat akun baru lengkap dengan email/username &
 * password, mengubah nama/email, serta mereset password akun.
 *
 * Akun `penghuni` tidak dikelola di sini karena terikat data penghuni
 * (`users.id_penghuni`) dan dibuat lewat pendaftaran/aktivasi portal.
 *
 * File ini hanya boleh dipakai dari server (server action).
 */

/** Peran staf yang dikelola di halaman ini. */
export const PERAN_STAF = ["admin", "pemilik"] as const;

/** Satu baris akun staf untuk tabel Kelola Akun. */
export type BarisAkunStaf = {
  id: string;
  nama: string;
  email: string;
  peran: UserRole;
  createdAt: Date;
};

/** Hasil operasi kelola akun untuk ditampilkan pada form. */
export type HasilAkun = { error?: string; sukses?: string };

/** Daftar akun staf (admin & pemilik), urut peran lalu email. */
export async function daftarAkunStaf(): Promise<BarisAkunStaf[]> {
  return db
    .select({
      id: users.id,
      nama: users.name,
      email: users.email,
      peran: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(inArray(users.role, [...PERAN_STAF]))
    .orderBy(asc(users.role), asc(users.email));
}

/** Validasi nama & email bersama; mengembalikan pesan galat atau null. */
async function validasiIdentitas(
  nama: string,
  email: string,
  idDikecualikan?: string
): Promise<string | null> {
  if (nama.length < NAMA_MIN) return `Nama minimal ${NAMA_MIN} karakter.`;
  if (nama.length > NAMA_MAX) return `Nama maksimal ${NAMA_MAX} karakter.`;
  if (!emailValid(email)) {
    return "Email tidak valid (contoh: nama@domain.com).";
  }

  const kondisi = idDikecualikan
    ? and(eq(users.email, email), ne(users.id, idDikecualikan))
    : eq(users.email, email);

  const [bentrok] = await db
    .select({ id: users.id })
    .from(users)
    .where(kondisi)
    .limit(1);

  return bentrok ? `Email "${email}" sudah dipakai akun lain.` : null;
}

function peranValid(nilai: string): nilai is (typeof PERAN_STAF)[number] {
  return (PERAN_STAF as readonly string[]).includes(nilai);
}

/**
 * Buat akun staf baru (admin/pemilik) — email dipakai sebagai username login.
 * Password disimpan sebagai hash bcrypt dan langsung bisa dipakai masuk.
 */
export async function buatAkunStaf(input: {
  nama: string;
  email: string;
  peran: string;
  password: string;
}): Promise<HasilAkun> {
  const nama = input.nama.trim();
  const email = input.email.trim().toLowerCase();
  const peran = input.peran.trim();

  if (!peranValid(peran)) {
    return { error: "Peran akun tidak valid (pilih admin atau pemilik)." };
  }

  const galatIdentitas = await validasiIdentitas(nama, email);
  if (galatIdentitas) return { error: galatIdentitas };

  if (input.password.length < PASSWORD_MIN) {
    return { error: `Password minimal ${PASSWORD_MIN} karakter.` };
  }

  const hash = await bcrypt.hash(input.password, 10);
  await db.insert(users).values({
    name: nama,
    email,
    password: hash,
    role: peran,
  });

  return {
    sukses: `Akun ${peran} "${email}" dibuat. Username/email & password siap dipakai untuk login.`,
  };
}

/** True bila peran termasuk staf yang dikelola halaman ini. */
function peranStaf(nilai: UserRole): boolean {
  return (PERAN_STAF as readonly string[]).includes(nilai);
}

/**
 * Ubah nama & email akun staf. Akun milik pengelola yang sedang login diarahkan
 * ke halaman Profil (`/profil`) supaya klaim sesi ikut disegarkan.
 */
export async function perbaruiAkunStaf(
  idPemanggil: string,
  idAkun: string,
  input: { nama: string; email: string }
): Promise<HasilAkun> {
  if (!idAkun) return { error: "Akun tidak dikenal." };
  if (idAkun === idPemanggil) {
    return {
      error:
        "Itu akun Anda sendiri — ubah nama/email Anda lewat halaman Profil agar sesi ikut diperbarui.",
    };
  }

  const nama = input.nama.trim();
  const email = input.email.trim().toLowerCase();

  const [target] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, idAkun))
    .limit(1);
  if (!target) return { error: "Akun tidak ditemukan." };
  if (!peranStaf(target.role)) {
    return {
      error: "Hanya akun staf (admin/pemilik) yang dapat diubah di halaman ini.",
    };
  }

  const galat = await validasiIdentitas(nama, email, idAkun);
  if (galat) return { error: galat };

  await db
    .update(users)
    .set({ name: nama, email })
    .where(eq(users.id, idAkun));

  return { sukses: `Akun "${email}" diperbarui.` };
}

/**
 * Reset password akun staf tanpa perlu password lama (khusus pengelola).
 * Untuk akun sendiri, gunakan halaman Profil yang mewajibkan password lama.
 */
export async function resetPasswordAkunStaf(
  idPemanggil: string,
  idAkun: string,
  input: { password: string; konfirmasi: string }
): Promise<HasilAkun> {
  if (!idAkun) return { error: "Akun tidak dikenal." };
  if (idAkun === idPemanggil) {
    return {
      error:
        "Untuk akun Anda sendiri, gunakan halaman Profil (wajib memasukkan password lama).",
    };
  }
  if (input.password.length < PASSWORD_MIN) {
    return { error: `Password minimal ${PASSWORD_MIN} karakter.` };
  }
  if (input.password !== input.konfirmasi) {
    return { error: "Konfirmasi password tidak sama." };
  }

  const [target] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, idAkun))
    .limit(1);
  if (!target) return { error: "Akun tidak ditemukan." };
  if (!peranStaf(target.role)) {
    return {
      error:
        "Hanya akun staf (admin/pemilik) yang passwordnya dapat direset di sini.",
    };
  }

  const hash = await bcrypt.hash(input.password, 10);
  await db.update(users).set({ password: hash }).where(eq(users.id, idAkun));

  return {
    sukses:
      "Password akun berhasil direset. Sampaikan password baru kepada pemilik akun tersebut.",
  };
}
