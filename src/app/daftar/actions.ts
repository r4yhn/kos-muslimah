"use server";

import bcrypt from "bcryptjs";
import { and, count, eq, sql } from "drizzle-orm";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";

import { signIn } from "@/auth";
import { db } from "@/db";
import { kamar, penghuni, users } from "@/db/schema";
import { formatIDR, parseTanggal } from "@/lib/format";
import { KAPASITAS_KAMAR } from "@/lib/kamar-options";
import { kirimNotifikasiKeRole } from "@/lib/notifikasi";

export type DaftarState = { error?: string } | undefined;

const JENIS_VALID = ["Perempuan", "Laki-laki"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Penanda error internal saat kamar ternyata sudah penuh di dalam transaksi. */
const KODE_KAMAR_PENUH = "KAMAR_PENUH";

/**
 * Pendaftaran mandiri penghuni baru (halaman publik /daftar).
 *
 * Alur "Bayar di Awal":
 * 1. Penghuni mengisi data identitas + memilih kamar yang masih punya slot
 *    (maksimal 2 penghuni per kamar; setiap penghuni punya akun sendiri),
 *    lalu membuat email & password sendiri.
 * 2. Sistem membuat data penghuni (`perlu_bayar_awal = true`) + akun login
 *    role `penghuni` yang tertaut, dan memberi tahu admin via notifikasi.
 * 3. Penghuni langsung masuk (auto-login) lalu diarahkan ke /portal/bayar-awal;
 *    menu portal terkunci sampai pembayaran awal lunas.
 */
export async function daftarPenghuni(
  _prevState: DaftarState,
  formData: FormData
): Promise<DaftarState> {
  const nama = String(formData.get("nama") ?? "").trim();
  const jenisKelamin = String(formData.get("jenisKelamin") ?? "");
  const alamat = String(formData.get("alamat") ?? "").trim();
  const noHp = String(formData.get("noHp") ?? "").trim();
  const tglMasuk = parseTanggal(formData.get("tglMasuk"));
  const idKamar = String(formData.get("idKamar") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!nama) return { error: "Nama lengkap wajib diisi." };
  if (!JENIS_VALID.includes(jenisKelamin as (typeof JENIS_VALID)[number])) {
    return { error: "Jenis kelamin tidak valid." };
  }
  if (!alamat) return { error: "Alamat wajib diisi." };
  if (!noHp) return { error: "Nomor HP / WA wajib diisi." };
  if (!tglMasuk) return { error: "Tanggal masuk tidak valid." };
  if (!EMAIL_RE.test(email)) return { error: "Email tidak valid." };
  if (password.length < 6) {
    return { error: "Password minimal 6 karakter." };
  }
  if (!idKamar) {
    return {
      error: "Silakan pilih kamar yang tersedia terlebih dahulu.",
    };
  }

  // Email harus unik (admin maupun penghuni lain).
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

  // Kamar yang dipilih harus masih punya slot: maksimal KAPASITAS_KAMAR (2)
  // penghuni aktif per kamar, dan tidak sedang dalam perbaikan.
  const [room] = await db
    .select({
      id: kamar.id,
      noKamar: kamar.noKamar,
      statusKamar: kamar.statusKamar,
      hargaSewa: kamar.hargaSewa,
    })
    .from(kamar)
    .where(eq(kamar.id, idKamar))
    .limit(1);
  if (!room) return { error: "Kamar yang dipilih tidak ditemukan." };
  if (room.statusKamar === "Perbaikan") {
    return {
      error: `Kamar ${room.noKamar} sedang dalam perbaikan. Silakan pilih kamar lain.`,
    };
  }
  const [terisiRow] = await db
    .select({ total: count() })
    .from(penghuni)
    .where(and(eq(penghuni.idKamar, idKamar), eq(penghuni.status, "Aktif")));
  const terisi = terisiRow?.total ?? 0;
  if (terisi >= KAPASITAS_KAMAR) {
    return {
      error: `Kamar ${room.noKamar} sudah penuh (maksimal ${KAPASITAS_KAMAR} penghuni). Silakan pilih kamar lain.`,
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await db.transaction(async (tx) => {
      // Kunci baris kamar agar dua pendaftaran yang berbarengan tidak
      // melewati kapasitas (maksimal KAPASITAS_KAMAR penghuni per kamar).
      await tx.execute(
        sql`select "id" from "kamar" where "id" = ${idKamar} for update`
      );

      const [cek] = await tx
        .select({ total: count() })
        .from(penghuni)
        .where(and(eq(penghuni.idKamar, idKamar), eq(penghuni.status, "Aktif")));
      if ((cek?.total ?? 0) >= KAPASITAS_KAMAR) {
        throw new Error(KODE_KAMAR_PENUH);
      }

      const [baru] = await tx
        .insert(penghuni)
        .values({
          nama,
          jenisKelamin,
          alamat,
          noHp,
          tglMasuk,
          idKamar,
          perluBayarAwal: true,
        })
        .returning({ id: penghuni.id });

      if (!baru) throw new Error("Gagal membuat data penghuni.");

      await tx.insert(users).values({
        name: nama,
        email,
        password: passwordHash,
        role: "penghuni",
        idPenghuni: baru.id,
      });
    });
  } catch (error) {
    // Penuh karena pendaftaran lain menyelesaikan lebih dulu.
    if (error instanceof Error && error.message === KODE_KAMAR_PENUH) {
      return {
        error: `Kamar ${room.noKamar} baru saja penuh (maksimal ${KAPASITAS_KAMAR} penghuni). Silakan pilih kamar lain.`,
      };
    }
    return { error: "Pendaftaran gagal. Silakan coba lagi." };
  }

  // Notifikasi otomatis ke admin bahwa ada penghuni baru menunggu bayar awal.
  await kirimNotifikasiKeRole(
    "admin",
    "Penghuni Baru Mendaftar",
    `${nama} mendaftar mandiri dan memilih Kamar ${room.noKamar} (${formatIDR.format(room.hargaSewa)}/bulan, slot ${terisi + 1}/${KAPASITAS_KAMAR}). Menunggu Pembayaran Awal untuk resmi aktif.`
  );

  revalidatePath("/penghuni");
  revalidatePath("/kamar");
  revalidatePath("/dashboard");

  // Auto-login: setelah ini NextAuth mengarahkan ke /portal, lalu karena
  // perlu_bayar_awal = true, sistem otomatis membawa penghuni ke pembayaran.
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
          "Akun berhasil dibuat, tetapi gagal masuk otomatis. Silakan masuk manual di halaman login.",
      };
    }
    throw error;
  }
}
