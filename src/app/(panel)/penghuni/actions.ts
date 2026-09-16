"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import bcrypt from "bcryptjs";

import { auth } from "@/auth";
import { db } from "@/db";
import { kamar, pembayaran, penghuni, users } from "@/db/schema";
import { parseTanggal } from "@/lib/format";
import { sinkronTagihanPenghuni } from "@/lib/tagihan";

export type PenghuniState = { error?: string } | undefined;

const JENIS_VALID = ["Perempuan", "Laki-laki"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function isAutentik(): Promise<boolean> {
  const session = await auth();
  return Boolean(session?.user);
}

/**
 * Simpan penghuni (tambah/ubah) + sinkronisasi status kamar:
 * - kamar pilihan diubah otomatis menjadi "Terisi";
 * - kamar lama otomatis kembali "Tersedia" bila sudah tidak ada penghuni aktif.
 */
export async function simpanPenghuni(
  _prevState: PenghuniState,
  formData: FormData
): Promise<PenghuniState> {
  if (!(await isAutentik())) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }

  const id = String(formData.get("id") ?? "").trim() || null;
  const nama = String(formData.get("nama") ?? "").trim();
  const jenisKelamin = String(formData.get("jenisKelamin") ?? "");
  const alamat = String(formData.get("alamat") ?? "").trim();
  const noHp = String(formData.get("noHp") ?? "").trim();
  const tglMasuk = parseTanggal(formData.get("tglMasuk"));
  const idKamarRaw = String(formData.get("idKamar") ?? "").trim() || null;

  // Akun login penghuni (opsional, hanya saat mendaftarkan penghuni baru).
  const emailAkun = String(formData.get("emailAkun") ?? "")
    .trim()
    .toLowerCase();
  const passwordAkun = String(formData.get("passwordAkun") ?? "");
  const akunDibuat = Boolean(emailAkun || passwordAkun);

  if (!nama) return { error: "Nama penghuni wajib diisi." };
  if (!JENIS_VALID.includes(jenisKelamin as (typeof JENIS_VALID)[number])) {
    return { error: "Jenis kelamin tidak valid." };
  }
  if (!alamat) return { error: "Alamat wajib diisi." };
  if (!noHp) return { error: "Nomor HP wajib diisi." };
  if (!tglMasuk) return { error: "Tanggal masuk tidak valid." };

  if (Boolean(emailAkun) !== Boolean(passwordAkun)) {
    return { error: "Isi email dan password akun sekaligus, atau kosongkan keduanya." };
  }
  if (akunDibuat && id) {
    return { error: "Akun login hanya dapat dibuat saat mendaftarkan penghuni baru." };
  }
  if (akunDibuat && !EMAIL_RE.test(emailAkun)) {
    return { error: "Email akun tidak valid." };
  }
  if (akunDibuat && passwordAkun.length < 6) {
    return { error: "Password akun minimal 6 karakter." };
  }

  let idKamarLama: string | null = null;
  let isKeluar = false;
  let perluBayarAwalLama = false;

  if (id) {
    const [existing] = await db
      .select({
        id: penghuni.id,
        status: penghuni.status,
        idKamar: penghuni.idKamar,
        perluBayarAwal: penghuni.perluBayarAwal,
      })
      .from(penghuni)
      .where(eq(penghuni.id, id))
      .limit(1);
    if (!existing) return { error: "Data penghuni tidak ditemukan." };
    idKamarLama = existing.idKamar;
    isKeluar = existing.status === "Keluar";
    perluBayarAwalLama = existing.perluBayarAwal;
  }

  // Penghuni berstatus Keluar tidak boleh ditempatkan di kamar lagi.
  const idKamarBaru = isKeluar ? null : idKamarRaw;

  if (akunDibuat && !id && !idKamarBaru) {
    return {
      error:
        "Akun penghuni baru wajib memilih kamar agar tagihan Pembayaran Awal dapat dibuat.",
    };
  }
  // Validasi email akun tidak bentrok dengan akun lain (admin/penghuni).
  if (akunDibuat) {
    const [dupe] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, emailAkun))
      .limit(1);
    if (dupe) return { error: "Email akun sudah terdaftar. Gunakan email lain." };
  }

  if (idKamarBaru) {
    const [room] = await db
      .select({ id: kamar.id, statusKamar: kamar.statusKamar })
      .from(kamar)
      .where(eq(kamar.id, idKamarBaru))
      .limit(1);
    if (!room) return { error: "Kamar yang dipilih tidak ditemukan." };
    const kamarSamaDenganLama = Boolean(id && idKamarLama === idKamarBaru);
    if (!kamarSamaDenganLama && room.statusKamar !== "Tersedia") {
      return {
        error: `Kamar tersebut tidak tersedia (status saat ini: ${room.statusKamar}).`,
      };
    }
    // Aturan Bayar di Awal: kamar boleh berstatus "Tersedia" tetapi sedang
    // dipesan penghuni lain yang belum bayar awal — jangan sampai dipesan dua kali.
    if (room.statusKamar === "Tersedia") {
      const [pemesan] = await db
        .select({ idPenghuni: penghuni.id })
        .from(penghuni)
        .where(
          and(
            eq(penghuni.idKamar, idKamarBaru),
            eq(penghuni.perluBayarAwal, true)
          )
        )
        .limit(1);
      if (pemesan && (!id || pemesan.idPenghuni !== id)) {
        return {
          error:
            "Kamar sedang dipesan penghuni lain yang belum menyelesaikan Pembayaran Awal.",
        };
      }
    }
  }

  /**
   * Status "perlu bayar awal":
   * - penghuni BARU + akun dibuat  -> wajib bayar awal (true);
   * - penghuni yang sedang disunting: tetap menunggu selama masih ada kamar
   *   (bila kamar dilepas, kunci dibuka agar tidak terkunci tanpa kamar);
   * - selain itu false (perilaku lama).
   */
  const perluBayarAwalBaru = id
    ? Boolean(perluBayarAwalLama && idKamarBaru)
    : akunDibuat;

  const passwordHash = akunDibuat ? await bcrypt.hash(passwordAkun, 10) : null;

  let idBaru: string | null = null;

  await db.transaction(async (tx) => {
    if (id) {
      await tx
        .update(penghuni)
        .set({
          nama,
          jenisKelamin,
          alamat,
          noHp,
          tglMasuk,
          idKamar: idKamarBaru,
          perluBayarAwal: perluBayarAwalBaru,
        })
        .where(eq(penghuni.id, id));
    } else {
      const [baru] = await tx
        .insert(penghuni)
        .values({
          nama,
          jenisKelamin,
          alamat,
          noHp,
          tglMasuk,
          idKamar: idKamarBaru,
          perluBayarAwal: perluBayarAwalBaru,
        })
        .returning({ id: penghuni.id });
      idBaru = baru?.id ?? null;

      // Buat akun login role "penghuni" yang tertaut ke data penghuni baru.
      if (akunDibuat && idBaru && passwordHash) {
        await tx.insert(users).values({
          name: nama,
          email: emailAkun,
          password: passwordHash,
          role: "penghuni",
          idPenghuni: idBaru,
        });
      }
    }

    // Kamar baru resmi "Terisi" HANYA bila penghuni tidak sedang menunggu
    // Pembayaran Awal (aturan Bayar di Awal: kamar aktif setelah bayar awal).
    if (idKamarBaru && !perluBayarAwalBaru) {
      const [room] = await tx
        .select({ id: kamar.id, statusKamar: kamar.statusKamar })
        .from(kamar)
        .where(eq(kamar.id, idKamarBaru))
        .limit(1);
      if (room && room.statusKamar !== "Terisi") {
        await tx
          .update(kamar)
          .set({ statusKamar: "Terisi" })
          .where(eq(kamar.id, idKamarBaru));
      }
    }

    if (id && idKamarLama && idKamarLama !== idKamarBaru) {
      const [sisa] = await tx
        .select({ total: count() })
        .from(penghuni)
        .where(
          and(eq(penghuni.idKamar, idKamarLama), eq(penghuni.status, "Aktif"))
        );
      if ((sisa?.total ?? 0) === 0) {
        await tx
          .update(kamar)
          .set({ statusKamar: "Tersedia" })
          .where(eq(kamar.id, idKamarLama));
      }
    }
  });

  // Penghuni aktif yang resmi menempati kamar -> pastikan tagihan bulanan
  // (mulai periode tgl_masuk) sudah diterbitkan.
  const idFinal = id ?? idBaru;
  if (idFinal && idKamarBaru && !perluBayarAwalBaru && !isKeluar) {
    await sinkronTagihanPenghuni(idFinal);
  }

  revalidatePath("/penghuni");
  revalidatePath("/kamar");
  revalidatePath("/dashboard");
  revalidatePath("/portal");
  redirect("/penghuni");
}

/** Tandai penghuni keluar: kamar dikosongkan otomatis. */
export async function keluarkanPenghuni(formData: FormData): Promise<void> {
  if (!(await isAutentik())) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const [row] = await db
    .select({
      id: penghuni.id,
      status: penghuni.status,
      idKamar: penghuni.idKamar,
    })
    .from(penghuni)
    .where(eq(penghuni.id, id))
    .limit(1);
  if (!row || row.status === "Keluar") return;

  await db.transaction(async (tx) => {
    await tx
      .update(penghuni)
      .set({ status: "Keluar", idKamar: null, perluBayarAwal: false })
      .where(eq(penghuni.id, id));

    if (row.idKamar) {
      const [sisa] = await tx
        .select({ total: count() })
        .from(penghuni)
        .where(
          and(eq(penghuni.idKamar, row.idKamar), eq(penghuni.status, "Aktif"))
        );
      if ((sisa?.total ?? 0) === 0) {
        await tx
          .update(kamar)
          .set({ statusKamar: "Tersedia" })
          .where(eq(kamar.id, row.idKamar));
      }
    }
  });

  revalidatePath("/penghuni");
  revalidatePath("/kamar");
}

/**
 * Hapus penghuni. Hanya diizinkan bila belum punya riwayat pembayaran
 * (tombol disembunyikan oleh UI bila ada riwayat).
 */
export async function hapusPenghuni(formData: FormData): Promise<void> {
  if (!(await isAutentik())) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const [row] = await db
    .select({ id: penghuni.id, idKamar: penghuni.idKamar })
    .from(penghuni)
    .where(eq(penghuni.id, id))
    .limit(1);
  if (!row) return;

  const [riwayat] = await db
    .select({ total: count() })
    .from(pembayaran)
    .where(eq(pembayaran.idPenghuni, id));
  if ((riwayat?.total ?? 0) > 0) return;

  await db.transaction(async (tx) => {
    await tx.delete(penghuni).where(eq(penghuni.id, id));

    if (row.idKamar) {
      const [sisa] = await tx
        .select({ total: count() })
        .from(penghuni)
        .where(
          and(eq(penghuni.idKamar, row.idKamar), eq(penghuni.status, "Aktif"))
        );
      if ((sisa?.total ?? 0) === 0) {
        await tx
          .update(kamar)
          .set({ statusKamar: "Tersedia" })
          .where(eq(kamar.id, row.idKamar));
      }
    }
  });

  revalidatePath("/penghuni");
  revalidatePath("/kamar");
}

