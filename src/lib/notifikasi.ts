import { and, count, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { notifikasi, users } from "@/db/schema";
import type { UserRole } from "@/types/next-auth";

/**
 * Helper notifikasi dalam aplikasi (portal penghuni & panel admin).
 *
 * Hanya boleh dipakai dari server (server action / server component / route
 * handler) karena mengakses database. Notifikasi otomatis dibuat misalnya saat
 * penghuni baru mendaftar mandiri atau saat pembayaran awal berhasil.
 */

/** Buat satu notifikasi untuk satu akun penerima. */
export async function kirimNotifikasi(
  idUser: string,
  judul: string,
  pesan: string
): Promise<void> {
  await db.insert(notifikasi).values({ idUser, judul, pesan });
}

/** Kirim notifikasi ke seluruh akun ber-role tertentu (mis. semua admin). */
export async function kirimNotifikasiKeRole(
  role: UserRole,
  judul: string,
  pesan: string
): Promise<void> {
  const penerima = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, role));

  if (penerima.length === 0) return;

  await db.insert(notifikasi).values(
    penerima.map((p) => ({ idUser: p.id, judul, pesan }))
  );
}

/**
 * Kirim notifikasi ke akun portal milik satu data penghuni (bila akunnya ada).
 * Dipakai saat status pembayaran berubah menjadi Lunas — termasuk ketika admin
 * mencatat pembayaran atas nama penghuni.
 */
export async function kirimNotifikasiKePenghuni(
  idPenghuni: string,
  judul: string,
  pesan: string
): Promise<void> {
  const [akun] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.idPenghuni, idPenghuni))
    .limit(1);

  if (!akun) return;

  await db.insert(notifikasi).values({ idUser: akun.id, judul, pesan });
}

/** Jumlah notifikasi belum dibaca milik satu akun. */
export async function hitungNotifikasiBelumDibaca(
  idUser: string
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(notifikasi)
    .where(and(eq(notifikasi.idUser, idUser), eq(notifikasi.dibaca, false)));

  return row?.total ?? 0;
}

/** Tandai seluruh notifikasi milik satu akun sebagai sudah dibaca. */
export async function tandaiSemuaNotifikasiDibaca(idUser: string): Promise<void> {
  await db
    .update(notifikasi)
    .set({ dibaca: true })
    .where(and(eq(notifikasi.idUser, idUser), eq(notifikasi.dibaca, false)));
}

/** Ambil daftar notifikasi satu akun (terbaru di atas). */
export async function daftarNotifikasi(idUser: string) {
  return db
    .select({
      id: notifikasi.id,
      judul: notifikasi.judul,
      pesan: notifikasi.pesan,
      dibaca: notifikasi.dibaca,
      createdAt: notifikasi.createdAt,
    })
    .from(notifikasi)
    .where(eq(notifikasi.idUser, idUser))
    .orderBy(desc(notifikasi.createdAt));
}
