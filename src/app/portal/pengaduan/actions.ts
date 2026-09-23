"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { db } from "@/db";
import { penghuni, users } from "@/db/schema";
import { kirimNotifikasiKeRole } from "@/lib/notifikasi";
import {
  buatPengaduan,
  DESKRIPSI_MAX,
  DESKRIPSI_MIN,
} from "@/lib/pengaduan";

export type PengaduanState = { error?: string; sukses?: string } | undefined;

/**
 * Kirim pengaduan / laporan kendala kamar dari portal penghuni
 * (`/portal/pengaduan`).
 *
 * - Hanya akun role "penghuni" yang tertaut ke data penghuni yang boleh kirim;
 * - status awal selalu `pending` (menunggu verifikasi pengelola di lapangan);
 * - seluruh pengelola (admin) langsung diberi notifikasi agar cepat ditangani.
 */
export async function kirimPengaduan(
  _prevState: PengaduanState,
  formData: FormData
): Promise<PengaduanState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }
  if (session.user.role !== "penghuni") {
    return { error: "Halaman ini khusus akun penghuni." };
  }

  const [akun] = await db
    .select({ id: users.id, idPenghuni: users.idPenghuni, nama: users.name })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!akun?.idPenghuni) {
    return { error: "Akun tidak tertaut ke data penghuni. Hubungi pengelola." };
  }

  // Selaras dengan kunci menu portal: penghuni yang belum melunasi Pembayaran
  // Awal belum boleh mengirim pengaduan, dan mantan penghuni (sudah keluar /
  // diarsipkan) tidak lagi boleh mengirim laporan baru.
  const [pelapor] = await db
    .select({
      perluBayarAwal: penghuni.perluBayarAwal,
      status: penghuni.status,
    })
    .from(penghuni)
    .where(eq(penghuni.id, akun.idPenghuni))
    .limit(1);

  if (!pelapor) return { error: "Data penghuni tidak ditemukan." };
  if (pelapor.status !== "Aktif") {
    return {
      error:
        "Akun penghuni sudah tidak aktif (data telah dipindahkan ke arsip kos). Hubungi pengelola bila perlu bantuan.",
    };
  }
  if (pelapor.perluBayarAwal) {
    return {
      error:
        "Selesaikan Pembayaran Awal terlebih dahulu sebelum mengirim pengaduan.",
    };
  }

  const deskripsi = String(formData.get("deskripsiKendala") ?? "").trim();

  if (deskripsi.length < DESKRIPSI_MIN) {
    return {
      error: `Uraikan kendala minimal ${DESKRIPSI_MIN} karakter agar pengelola dapat menindaklanjuti.`,
    };
  }
  if (deskripsi.length > DESKRIPSI_MAX) {
    return { error: `Uraian kendala maksimal ${DESKRIPSI_MAX} karakter.` };
  }

  await buatPengaduan(akun.idPenghuni, deskripsi);

  // Beri tahu seluruh pengelola bahwa ada laporan kendala baru (pending).
  const ringkas =
    deskripsi.length > 140 ? `${deskripsi.slice(0, 140)}…` : deskripsi;
  await kirimNotifikasiKeRole(
    "admin",
    "Pengaduan Baru Masuk",
    `${akun.nama} melaporkan kendala kamar: "${ringkas}". Verifikasi di lapangan lalu perbarui statusnya pada menu Pengaduan.`
  );

  revalidatePath("/portal/pengaduan");
  revalidatePath("/pengaduan");
  revalidatePath("/monitoring");
  revalidatePath("/monitoring/pengaduan");

  return {
    sukses:
      "Pengaduan terkirim dengan status Pending — menunggu verifikasi pengelola.",
  };
}
