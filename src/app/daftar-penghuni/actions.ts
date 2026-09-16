"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";

import { signIn } from "@/auth";
import { db } from "@/db";
import { penghuni, users } from "@/db/schema";
import { kirimNotifikasiKeRole } from "@/lib/notifikasi";

export type AktifkanState = { error?: string } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sisakan hanya digit dari nomor telepon. */
function digitNomor(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Kumpulan variasi penulisan nomor HP Indonesia yang dianggap sama:
 * 0812… ⇄ 62812… ⇄ 812…, termasuk format dengan spasi/tanda hubung.
 */
function varianNomor(nomor: string): string[] {
  const d = digitNomor(nomor);
  if (d.length < 9) return [];
  const set = new Set<string>([d]);
  if (d.startsWith("62")) set.add(`0${d.slice(2)}`);
  else if (d.startsWith("0")) set.add(`62${d.slice(1)}`);
  else if (d.startsWith("8")) {
    set.add(`0${d}`);
    set.add(`62${d}`);
  }
  return [...set];
}

/** True bila dua nomor HP saling cocok (dalam satu varian penulisan). */
function nomorCocok(a: string, b: string): boolean {
  const va = varianNomor(a);
  const vb = varianNomor(b);
  return va.some((x) => vb.includes(x));
}

/** True bila dua nama saling cocok tanpa peduli huruf besar/kecil. */
function namaCocok(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  return x.length > 0 && (x.includes(y) || y.includes(x));
}

/**
 * Aktivasi akun portal mandiri bagi penghuni yang SUDAH terdata oleh
 * pengelola (data diri & kamar sudah ada di panel admin, tetapi belum punya
 * akun login). Penghuni mencocokkan datanya lewat Nomor HP/WA, lalu membuat
 * email (username) & password sendiri.
 *
 * Penghuni yang BELUM terdata sama sekali tidak bisa lewat halaman ini —
 * mereka harus mendaftar baru melalui /daftar (pilih kamar + Pembayaran Awal).
 */
export async function aktifkanAkunPortal(
  _prevState: AktifkanState,
  formData: FormData
): Promise<AktifkanState> {
  const noHp = String(formData.get("noHp") ?? "").trim();
  const nama = String(formData.get("nama") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!noHp || digitNomor(noHp).length < 9) {
    return { error: "Nomor HP/WA tidak valid. Isi minimal 9 digit." };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: "Email tidak valid. Gunakan email aktif Anda." };
  }
  if (password.length < 6) {
    return { error: "Password minimal 6 karakter." };
  }

  // Cari data penghuni Aktif yang nomor HP/WA-nya cocok dengan input.
  const semuaAktif = await db
    .select({
      id: penghuni.id,
      nama: penghuni.nama,
      noHp: penghuni.noHp,
      perluBayarAwal: penghuni.perluBayarAwal,
    })
    .from(penghuni)
    .where(eq(penghuni.status, "Aktif"));

  let kandidat = semuaAktif.filter((p) => nomorCocok(noHp, p.noHp));

  if (kandidat.length === 0) {
    return {
      error:
        "Nomor HP/WA tidak ditemukan pada data penghuni pengelola. Pastikan nomor sesuai saat dicatat, hubungi pengelola kos, atau daftar sebagai penghuni baru melalui halaman Pendaftaran Penghuni Baru.",
    };
  }

  // Bila ada lebih dari satu data dengan nomor sama, minta nama untuk memastikan.
  if (kandidat.length > 1) {
    if (!nama) {
      return {
        error:
          "Ditemukan lebih dari satu penghuni dengan nomor HP tersebut. Isi Nama Lengkap agar akun tertaut ke data yang tepat.",
      };
    }
    kandidat = kandidat.filter((p) => namaCocok(p.nama, nama));
    if (kandidat.length !== 1) {
      return {
        error:
          "Nama tidak cocok dengan data yang terdaftar. Periksa kembali Nama & Nomor HP Anda, atau hubungi pengelola kos.",
      };
    }
  }

  const target = kandidat[0];

  // Penghuni tsb mungkin sudah punya akun portal.
  const [akunLama] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.idPenghuni, target.id))
    .limit(1);
  if (akunLama) {
    return {
      error: `Akun portal atas nama "${target.nama}" sudah aktif. Silakan langsung masuk.`,
    };
  }

  // Email harus unik (tidak dipakai admin/penghuni lain).
  const [dupe] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (dupe) {
    return {
      error: "Email sudah terdaftar. Gunakan email lain atau masuk ke akun Anda.",
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await db.insert(users).values({
      name: target.nama,
      email,
      password: passwordHash,
      role: "penghuni",
      idPenghuni: target.id,
    });
  } catch {
    return {
      error:
        "Aktivasi akun gagal. Kemungkinan email sudah terdaftar — gunakan email lain atau hubungi pengelola.",
    };
  }

  // Beri tahu admin bahwa ada penghuni yang mengaktifkan akun portalnya.
  await kirimNotifikasiKeRole(
    "admin",
    "Akun Portal Penghuni Diaktifkan",
    `${target.nama} berhasil mengaktifkan akun portalnya sendiri. Email akun: ${email}.`
  );

  revalidatePath("/penghuni");
  revalidatePath("/dashboard");

  // Auto-login → portal (bila perlu_bayar_awal masih true, sistem otomatis
  // mengarahkan ke /portal/bayar-awal sampai Pembayaran Awal lunas).
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/portal",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error:
          "Akun berhasil diaktifkan, tetapi gagal masuk otomatis. Silakan masuk manual di halaman login.",
      };
    }
    throw error;
  }
}
