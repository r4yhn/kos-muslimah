"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { kamar, penghuni } from "@/db/schema";

export type KamarState = { error?: string } | undefined;

const STATUS_VALID = ["Tersedia", "Terisi", "Perbaikan"] as const;
type StatusKamar = (typeof STATUS_VALID)[number];

async function isAutentik(): Promise<boolean> {
  const session = await auth();
  // Hanya pengelola (role "admin") yang boleh menambah/mengubah/menghapus data
  // master. Role "pemilik" bersifat read-only di /monitoring.
  return session?.user?.role === "admin";
}

/**
 * Simpan kamar (tambah/ubah). Dibedakan dari ada/tidaknya field `id`.
 * - Kamar baru tidak boleh langsung "Terisi" (hanya via pendaftaran penghuni).
 * - Kamar terisi penghuni aktif tidak boleh diubah statusnya secara manual.
 */
export async function simpanKamar(
  _prevState: KamarState,
  formData: FormData
): Promise<KamarState> {
  if (!(await isAutentik())) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }

  const noKamar = String(formData.get("noKamar") ?? "").trim();
  const tipeKamar = String(formData.get("tipeKamar") ?? "").trim();
  const hargaSewa = Number(formData.get("hargaSewa"));
  const statusRaw = String(formData.get("statusKamar") ?? "Tersedia");
  const id = String(formData.get("id") ?? "").trim() || null;

  if (!noKamar) return { error: "Nomor kamar wajib diisi." };
  if (!tipeKamar) return { error: "Tipe kamar wajib diisi." };
  if (!Number.isInteger(hargaSewa) || hargaSewa <= 0) {
    return { error: "Harga sewa harus berupa angka bulat lebih dari 0." };
  }
  if (!STATUS_VALID.includes(statusRaw as StatusKamar)) {
    return { error: "Status kamar tidak valid." };
  }
  const status = statusRaw as StatusKamar;

  if (id) {
    const [existing] = await db
      .select({ id: kamar.id, statusKamar: kamar.statusKamar })
      .from(kamar)
      .where(eq(kamar.id, id))
      .limit(1);
    if (!existing) return { error: "Kamar tidak ditemukan." };

    if (existing.statusKamar === "Terisi" && status !== "Terisi") {
      const [penghuniAktif] = await db
        .select({ total: count() })
        .from(penghuni)
        .where(and(eq(penghuni.idKamar, id), eq(penghuni.status, "Aktif")));
      if ((penghuniAktif?.total ?? 0) > 0) {
        return {
          error:
            "Kamar sedang terisi penghuni aktif — status dikelola otomatis hingga kamar kosong.",
        };
      }
    }

    const [duplicate] = await db
      .select({ id: kamar.id })
      .from(kamar)
      .where(eq(kamar.noKamar, noKamar))
      .limit(1);
    if (duplicate && duplicate.id !== id) {
      return { error: `Nomor kamar "${noKamar}" sudah dipakai kamar lain.` };
    }

    await db
      .update(kamar)
      .set({ noKamar, tipeKamar, hargaSewa, statusKamar: status })
      .where(eq(kamar.id, id));
  } else {
    const [duplicate] = await db
      .select({ id: kamar.id })
      .from(kamar)
      .where(eq(kamar.noKamar, noKamar))
      .limit(1);
    if (duplicate) {
      return { error: `Nomor kamar "${noKamar}" sudah terdaftar.` };
    }

    await db.insert(kamar).values({
      noKamar,
      tipeKamar,
      hargaSewa,
      statusKamar: status === "Terisi" ? "Tersedia" : status,
    });
  }

  revalidatePath("/kamar");
  redirect("/kamar");
}

/** Hapus kamar. Hanya untuk kamar tanpa penghuni (aman secara historis). */
export async function hapusKamar(formData: FormData): Promise<void> {
  if (!(await isAutentik())) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const [penghuniTerkait] = await db
    .select({ total: count() })
    .from(penghuni)
    .where(eq(penghuni.idKamar, id));
  if ((penghuniTerkait?.total ?? 0) > 0) return;

  await db.delete(kamar).where(eq(kamar.id, id));
  revalidatePath("/kamar");
}
