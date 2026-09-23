import { and, count, desc, eq, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { kamar, pengaduan, penghuni } from "@/db/schema";
import type { RingkasanPengaduan, StatusPengaduan } from "./pengaduan-status";
import { hariIniUtc } from "./tagihan";

/**
 * Helper modul "Pengaduan & Laporan Kendala" (tabel `pengaduan`).
 *
 * Alur tiga pihak:
 * - **Penghuni** mengirim kendala kamar dari portal (`/portal/pengaduan`) →
 *   baris dibuat dengan status `pending`.
 * - **Admin/pengelola** memverifikasi di lapangan lalu memperbarui status dari
 *   panel (`/pengaduan`) menjadi `diproses` / `selesai` + catatan penanganan.
 * - **Pemilik Kos** memantau daftar & statusnya secara read-only
 *   (`/monitoring/pengaduan`) untuk mengontrol kinerja admin.
 *
 * File ini hanya boleh dipakai dari server (server component / server action /
 * route handler) karena mengakses database. Konstanta & tipe yang juga dipakai
 * komponen client didefinisikan di `lib/pengaduan-status.ts` lalu di-reexport di
 * sini agar pemanggil server cukup mengimpor satu tempat.
 */

export * from "./pengaduan-status";

/** Satu baris pengaduan lengkap dengan identitas pelapornya. */
export type BarisPengaduan = {
  idPengaduan: string;
  idPenghuni: string;
  namaPenghuni: string;
  noKamar: string | null;
  statusPenghuni: string;
  deskripsiKendala: string;
  tanggalLapor: Date;
  statusPenyelesaian: StatusPengaduan;
  catatanAdmin: string | null;
  ditanganiPada: Date | null;
  createdAt: Date;
};

/**
 * Buat pengaduan baru dari penghuni (status awal selalu `pending`).
 * `tanggal_lapor` diisi tanggal UTC hari ini agar deterministik.
 */
export async function buatPengaduan(
  idPenghuni: string,
  deskripsiKendala: string
): Promise<void> {
  await db.insert(pengaduan).values({
    idPenghuni,
    deskripsiKendala,
    tanggalLapor: hariIniUtc(),
    statusPenyelesaian: "pending",
  });
}

/** Pengaduan milik satu penghuni (terbaru di atas) — untuk portal penghuni. */
export async function daftarPengaduanPenghuni(idPenghuni: string) {
  return db
    .select({
      idPengaduan: pengaduan.idPengaduan,
      deskripsiKendala: pengaduan.deskripsiKendala,
      tanggalLapor: pengaduan.tanggalLapor,
      statusPenyelesaian: pengaduan.statusPenyelesaian,
      catatanAdmin: pengaduan.catatanAdmin,
      ditanganiPada: pengaduan.ditanganiPada,
      createdAt: pengaduan.createdAt,
    })
    .from(pengaduan)
    .where(eq(pengaduan.idPenghuni, idPenghuni))
    .orderBy(desc(pengaduan.createdAt));
}

/**
 * Seluruh pengaduan (panel admin & pemantauan pemilik), opsional disaring
 * status. Terbaru di atas; dapat dibatasi jumlah baris lewat `limit`.
 */
export async function daftarPengaduan(
  opsi: { status?: StatusPengaduan; limit?: number } = {}
): Promise<BarisPengaduan[]> {
  const kondisi: SQL[] = [];
  if (opsi.status) kondisi.push(eq(pengaduan.statusPenyelesaian, opsi.status));

  const rows = await db
    .select({
      idPengaduan: pengaduan.idPengaduan,
      idPenghuni: pengaduan.idPenghuni,
      namaPenghuni: penghuni.nama,
      noKamar: kamar.noKamar,
      statusPenghuni: penghuni.status,
      deskripsiKendala: pengaduan.deskripsiKendala,
      tanggalLapor: pengaduan.tanggalLapor,
      statusPenyelesaian: pengaduan.statusPenyelesaian,
      catatanAdmin: pengaduan.catatanAdmin,
      ditanganiPada: pengaduan.ditanganiPada,
      createdAt: pengaduan.createdAt,
    })
    .from(pengaduan)
    .innerJoin(penghuni, eq(penghuni.id, pengaduan.idPenghuni))
    .leftJoin(kamar, eq(kamar.id, penghuni.idKamar))
    .where(kondisi.length > 0 ? and(...kondisi) : undefined)
    .orderBy(desc(pengaduan.createdAt));

  return opsi.limit ? rows.slice(0, opsi.limit) : rows;
}

/** Rekap jumlah pengaduan per status + totalnya. */
export async function ringkasanPengaduan(): Promise<RingkasanPengaduan> {
  const rows = await db
    .select({ status: pengaduan.statusPenyelesaian, total: count() })
    .from(pengaduan)
    .groupBy(pengaduan.statusPenyelesaian);

  const ambil = (status: StatusPengaduan) =>
    rows.find((r) => r.status === status)?.total ?? 0;

  const pending = ambil("pending");
  const diproses = ambil("diproses");
  const selesai = ambil("selesai");

  return { pending, diproses, selesai, total: pending + diproses + selesai };
}

/**
 * Perbarui status penanganan pengaduan (khusus admin) beserta catatan
 * opsional. `ditangani_pada` diisi waktu server.
 * @returns Identitas pelapor + status sebelumnya (untuk notifikasi), atau
 *          null bila pengaduan tidak ditemukan.
 */
export async function ubahStatusPengaduan(input: {
  idPengaduan: string;
  status: StatusPengaduan;
  catatanAdmin?: string | null;
}): Promise<{ idPenghuni: string; sebelumnya: StatusPengaduan } | null> {
  const [existing] = await db
    .select({
      idPengaduan: pengaduan.idPengaduan,
      idPenghuni: pengaduan.idPenghuni,
      statusPenyelesaian: pengaduan.statusPenyelesaian,
    })
    .from(pengaduan)
    .where(eq(pengaduan.idPengaduan, input.idPengaduan))
    .limit(1);

  if (!existing) return null;

  const catatan = input.catatanAdmin?.trim() ?? "";

  await db
    .update(pengaduan)
    .set({
      statusPenyelesaian: input.status,
      catatanAdmin: catatan ? catatan : null,
      ditanganiPada: new Date(),
    })
    .where(eq(pengaduan.idPengaduan, input.idPengaduan));

  return {
    idPenghuni: existing.idPenghuni,
    sebelumnya: existing.statusPenyelesaian,
  };
}
