"use server";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { kamar, pembayaran, penghuni, users } from "@/db/schema";
import {
  daftarPeriodeAwal,
  PAKET_BAYAR_AWAL,
  type PaketBayarAwal,
} from "@/lib/bayar-awal";
import { bacaBuktiDariForm } from "@/lib/bukti";
import { formatIDR, namaBulan, parseTanggal } from "@/lib/format";
import {
  hitungNotifikasiBelumDibaca,
  kirimNotifikasi,
  kirimNotifikasiKeRole,
  tandaiSemuaNotifikasiDibaca,
} from "@/lib/notifikasi";

export type BayarAwalState = { error?: string } | undefined;

const METODE_VALID = [
  "Transfer Bank",
  "Virtual Account",
  "QRIS",
  "E-Wallet",
] as const;

/** Logout dari portal penghuni. */
export async function logoutPortal() {
  await signOut({ redirectTo: "/login" });
}

/**
 * Proses "Pembayaran Awal" (bayar online via web) dari halaman /portal/bayar-awal.
 *
 * Alur (fitur 1B — Menunggu Konfirmasi):
 * - hanya akun penghuni yang masih `perlu_bayar_awal` yang boleh mengirim;
 * - penghuni memilih paket 1, 2, atau 6 bulan + metode online + tanggal &
 *   melampirkan **bukti bayar**;
 * - sistem mencatat setiap bulan pada paket berstatus "Menunggu Konfirmasi"
 *   (satu `kelompok_konfirmasi` untuk seluruh bulan);
 * - kunci portal tetap terkunci & kamar belum "Terisi" sampai admin
 *   memverifikasi bukti → Lunas (lihat `verifikasiPembayaran`).
 */
export async function simpanPembayaranAwal(
  _prevState: BayarAwalState,
  formData: FormData
): Promise<BayarAwalState> {
  const session = await auth();
  if (!session?.user) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }
  if (session.user.role !== "penghuni") {
    return { error: "Halaman ini khusus akun penghuni." };
  }

  const [akun] = await db
    .select({ id: users.id, idPenghuni: users.idPenghuni })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!akun?.idPenghuni) {
    return { error: "Akun tidak tertaut ke data penghuni. Hubungi pengelola." };
  }

  const [baris] = await db
    .select({
      id: penghuni.id,
      nama: penghuni.nama,
      idKamar: penghuni.idKamar,
      tglMasuk: penghuni.tglMasuk,
      perluBayarAwal: penghuni.perluBayarAwal,
    })
    .from(penghuni)
    .where(eq(penghuni.id, akun.idPenghuni))
    .limit(1);

  if (!baris) return { error: "Data penghuni tidak ditemukan." };
  if (!baris.perluBayarAwal) {
    return { error: "Tidak ada tagihan pembayaran awal untuk akun ini." };
  }
  if (!baris.idKamar) {
    return {
      error:
        "Kamar belum ditetapkan. Hubungi pengelola untuk mengaktifkan kamar Anda.",
    };
  }

  const [room] = await db
    .select({
      id: kamar.id,
      noKamar: kamar.noKamar,
      hargaSewa: kamar.hargaSewa,
    })
    .from(kamar)
    .where(eq(kamar.id, baris.idKamar))
    .limit(1);
  if (!room) return { error: "Data kamar tidak ditemukan." };

  const metodeBayar = String(formData.get("metodeBayar") ?? "");
  const tanggalBayar = parseTanggal(formData.get("tanggalBayar"));
  const paket = Number(formData.get("paket")) as PaketBayarAwal;

  if (!METODE_VALID.includes(metodeBayar as (typeof METODE_VALID)[number])) {
    return { error: "Metode pembayaran online tidak valid." };
  }
  if (!tanggalBayar) return { error: "Tanggal bayar tidak valid." };
  if (!PAKET_BAYAR_AWAL.includes(paket)) {
    return { error: "Paket pembayaran tidak valid." };
  }

  const bukti = await bacaBuktiDariForm(formData);
  if (!bukti.ok) return { error: bukti.error };

  const periodeList = daftarPeriodeAwal(baris.tglMasuk, paket);
  const kelompok = randomUUID();

  // Pastikan tidak ada bulan yang sudah Lunas / sedang menunggu (hindari
  // pengajuan ganda) sebelum menulis apa pun.
  for (const { bulan, tahun } of periodeList) {
    const [catatan] = await db
      .select({ statusBayar: pembayaran.statusBayar })
      .from(pembayaran)
      .where(
        and(
          eq(pembayaran.idPenghuni, baris.id),
          eq(pembayaran.bulan, bulan),
          eq(pembayaran.tahun, tahun)
        )
      )
      .limit(1);
    if (
      catatan?.statusBayar === "Lunas" ||
      catatan?.statusBayar === "Menunggu Konfirmasi"
    ) {
      return {
        error: `Periode ${namaBulan(bulan)} ${tahun} sudah dibayar atau sedang menunggu konfirmasi.`,
      };
    }
  }

  // Simpan pengajuan "Menunggu Konfirmasi" untuk setiap bulan pada paket.
  let totalBayar = 0;
  await db.transaction(async (tx) => {
    for (const { bulan, tahun } of periodeList) {
      const keteranganBulan = `Pembayaran Awal Penghuni Baru (paket ${paket} bulan) — ${namaBulan(bulan)} ${tahun}`;
      const [catatan] = await tx
        .select({ id: pembayaran.id })
        .from(pembayaran)
        .where(
          and(
            eq(pembayaran.idPenghuni, baris.id),
            eq(pembayaran.bulan, bulan),
            eq(pembayaran.tahun, tahun)
          )
        )
        .limit(1);

      if (catatan) {
        await tx
          .update(pembayaran)
          .set({
            tanggalBayar,
            jumlahBayar: room.hargaSewa,
            metodeBayar,
            keterangan: keteranganBulan,
            statusBayar: "Menunggu Konfirmasi",
            buktiPembayaran: bukti.dataUrl,
            kelompokKonfirmasi: kelompok,
          })
          .where(eq(pembayaran.id, catatan.id));
      } else {
        await tx.insert(pembayaran).values({
          idPenghuni: baris.id,
          tanggalBayar,
          bulan,
          tahun,
          jumlahBayar: room.hargaSewa,
          metodeBayar,
          keterangan: keteranganBulan,
          statusBayar: "Menunggu Konfirmasi",
          buktiPembayaran: bukti.dataUrl,
          kelompokKonfirmasi: kelompok,
        });
      }
      totalBayar += room.hargaSewa;
    }
  });

  // Kunci portal TIDAK dibuka di sini — menunggu verifikasi admin.
  // Notifikasi otomatis untuk penghuni & admin.
  const awalPeriode = periodeList[0];
  const akhirPeriode = periodeList[periodeList.length - 1];
  const labelCakupan =
    periodeList.length === 1
      ? `${namaBulan(awalPeriode.bulan)} ${awalPeriode.tahun}`
      : `${namaBulan(awalPeriode.bulan).slice(0, 3)} ${awalPeriode.tahun} – ${namaBulan(akhirPeriode.bulan).slice(0, 3)} ${akhirPeriode.tahun}`;

  await kirimNotifikasi(
    session.user.id,
    "Bukti Pembayaran Awal Diterima ⏳",
    `Pembayaran awal paket ${paket} bulan (${labelCakupan}) sebesar ${formatIDR.format(totalBayar)} via ${metodeBayar} telah kami terima. Bukti sedang diverifikasi pengelola — status kamar & menu portal aktif setelah dikonfirmasi.`
  );
  await kirimNotifikasiKeRole(
    "admin",
    "Pembayaran Awal Menunggu Verifikasi",
    `${baris.nama} (Kamar ${room.noKamar}) mengirim pembayaran awal paket ${paket} bulan sebesar ${formatIDR.format(totalBayar)} via ${metodeBayar}. Silakan verifikasi bukti di halaman Pembayaran.`
  );

  revalidatePath("/portal");
  revalidatePath("/portal/bayar-awal");
  revalidatePath("/portal/riwayat");
  revalidatePath("/portal/notifikasi");
  revalidatePath("/dashboard");
  revalidatePath("/kamar");
  revalidatePath("/penghuni");
  revalidatePath("/pembayaran");

  redirect("/portal/bayar-awal?menunggu=1");
}

/** Tandai seluruh notifikasi portal akun yang sedang login sebagai dibaca. */
export async function tandaiSemuaNotifikasiDibacaPortal(): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  await tandaiSemuaNotifikasiDibaca(session.user.id);
  revalidatePath("/portal/notifikasi");
}

/** Jumlah notifikasi belum dibaca akun portal yang sedang login. */
export async function jumlahNotifikasiPortalBelumDibaca(): Promise<number> {
  const session = await auth();
  if (!session?.user) return 0;
  return hitungNotifikasiBelumDibaca(session.user.id);
}
