"use server";

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { kamar, pembayaran, penghuni, users } from "@/db/schema";
import {
  bandingkanPeriode,
  daftarTagihanBulanan,
  kunciPeriode,
} from "@/lib/bayar-bulanan";
import type { Periode } from "@/lib/bayar-awal";
import { bacaBuktiDariForm } from "@/lib/bukti";
import { formatIDR, namaBulan, parseTanggal } from "@/lib/format";
import { kirimNotifikasi, kirimNotifikasiKeRole } from "@/lib/notifikasi";

export type BayarBulananState = { error?: string } | undefined;

/** Metode pembayaran online yang disediakan (disimulasikan lewat web). */
const METODE_VALID = [
  "Transfer Bank",
  "Virtual Account",
  "QRIS",
  "E-Wallet",
] as const;

/** Format nilai periode dari form: "tahun-bulan" (mis. "2026-09"). */
const KUNCI_PERIODE_RE = /^(\d{4})-(\d{2})$/;

/**
 * Proses "Bayar Sewa Bulanan" (bayar online via web) dari halaman
 * /portal/bayar untuk penghuni yang sudah aktif.
 *
 * Aturan (fitur 1B — Menunggu Konfirmasi):
 * - hanya akun penghuni berstatus Aktif yang sudah tidak terkunci Pembayaran
 *   Awal dan punya kamar yang boleh mengirim;
 * - tagihan yang bisa diajukan = bulan `tgl_masuk` s.d. bulan berjalan yang
 *   belum Lunas DAN tidak sedang menunggu konfirmasi (daftar dihitung ulang
 *   di server setiap submit);
 * - tiap bulan dicatat "Menunggu Konfirmasi" dalam satu `kelompok_konfirmasi`
 *   lengkap dengan bukti bayar; admin memverifikasi sebelum menjadi Lunas.
 */
export async function simpanPembayaranBulanan(
  _prevState: BayarBulananState,
  formData: FormData
): Promise<BayarBulananState> {
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

  const [penghuniRow] = await db
    .select({
      id: penghuni.id,
      nama: penghuni.nama,
      status: penghuni.status,
      idKamar: penghuni.idKamar,
      tglMasuk: penghuni.tglMasuk,
      perluBayarAwal: penghuni.perluBayarAwal,
    })
    .from(penghuni)
    .where(eq(penghuni.id, akun.idPenghuni))
    .limit(1);

  if (!penghuniRow) return { error: "Data penghuni tidak ditemukan." };
  if (penghuniRow.status !== "Aktif") {
    return { error: "Akun penghuni tidak aktif. Hubungi pengelola." };
  }
  if (penghuniRow.perluBayarAwal) {
    return {
      error:
        "Selesaikan Pembayaran Awal terlebih dahulu sebelum bayar sewa bulanan.",
    };
  }
  if (!penghuniRow.idKamar) {
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
    .where(eq(kamar.id, penghuniRow.idKamar))
    .limit(1);
  if (!room) return { error: "Data kamar tidak ditemukan." };

  const metodeBayar = String(formData.get("metodeBayar") ?? "");
  const tanggalBayar = parseTanggal(formData.get("tanggalBayar"));

  if (!METODE_VALID.includes(metodeBayar as (typeof METODE_VALID)[number])) {
    return { error: "Metode pembayaran online tidak valid." };
  }
  if (!tanggalBayar) return { error: "Tanggal bayar tidak valid." };

  const bukti = await bacaBuktiDariForm(formData);
  if (!bukti.ok) return { error: bukti.error };

  const rawPeriode = formData.getAll("periode").map(String);
  if (rawPeriode.length === 0) {
    return { error: "Pilih minimal satu bulan tagihan yang akan dibayar." };
  }

  // Hitung ulang tagihan di server agar penghuni tidak bisa mengajukan
  // periode yang sudah Lunas/Menunggu atau periode di luar tagihan.
  const tagihan = await daftarTagihanBulanan(
    penghuniRow.id,
    penghuniRow.tglMasuk
  );
  const tagihanSet = new Set(tagihan.map(kunciPeriode));

  const perKunci = new Map<string, Periode>();
  for (const raw of rawPeriode) {
    const match = KUNCI_PERIODE_RE.exec(raw);
    if (!match) return { error: "Periode tagihan tidak valid." };
    const tahun = Number(match[1]);
    const bulan = Number(match[2]);
    if (bulan < 1 || bulan > 12) {
      return { error: "Bulan pada periode tagihan tidak valid." };
    }
    if (!tagihanSet.has(raw)) {
      return {
        error: `Periode ${namaBulan(bulan)} ${tahun} sudah Lunas, sedang menunggu konfirmasi, atau tidak ditagihkan.`,
      };
    }
    perKunci.set(raw, { bulan, tahun });
  }
  const periodeList = [...perKunci.values()].sort(bandingkanPeriode);
  const kelompok = randomUUID();

  // Simpan pengajuan "Menunggu Konfirmasi" per periode secara atomik; setiap
  // bulan menjadi satu baris (berisi bukti & kelompok yang sama).
  let totalBayar = 0;
  await db.transaction(async (tx) => {
    for (const { bulan, tahun } of periodeList) {
      const keteranganBulan = `Pembayaran Sewa Bulanan Online — ${namaBulan(bulan)} ${tahun}`;
      const [catatan] = await tx
        .select({ id: pembayaran.id })
        .from(pembayaran)
        .where(
          and(
            eq(pembayaran.idPenghuni, penghuniRow.id),
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
          idPenghuni: penghuniRow.id,
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

  // Notifikasi otomatis untuk penghuni & admin (menunggu verifikasi).
  const awalPeriode = periodeList[0];
  const akhirPeriode = periodeList[periodeList.length - 1];
  const labelCakupan =
    periodeList.length === 1
      ? `${namaBulan(awalPeriode.bulan)} ${awalPeriode.tahun}`
      : `${namaBulan(awalPeriode.bulan)} ${awalPeriode.tahun} – ${namaBulan(akhirPeriode.bulan)} ${akhirPeriode.tahun}`;

  await kirimNotifikasi(
    session.user.id,
    "Bukti Pembayaran Bulanan Diterima ⏳",
    `Pembayaran sewa ${labelCakupan} sebesar ${formatIDR.format(totalBayar)} via ${metodeBayar} telah kami terima. Bukti sedang diverifikasi pengelola — tagihan berstatus Lunas setelah dikonfirmasi.`
  );
  await kirimNotifikasiKeRole(
    "admin",
    "Pembayaran Bulanan Menunggu Verifikasi",
    `${penghuniRow.nama} (Kamar ${room.noKamar}) mengirim pembayaran sewa ${labelCakupan} sebesar ${formatIDR.format(totalBayar)} via ${metodeBayar}. Silakan verifikasi bukti di halaman Pembayaran.`
  );

  revalidatePath("/portal");
  revalidatePath("/portal/bayar");
  revalidatePath("/portal/riwayat");
  revalidatePath("/portal/notifikasi");
  revalidatePath("/dashboard");
  revalidatePath("/kamar");
  revalidatePath("/penghuni");
  revalidatePath("/pembayaran");

  redirect("/portal/bayar?menunggu=1");
}

/**
 * Batalkan pengajuan pembayaran bulanan yang masih "Menunggu Konfirmasi".
 * Baris dikembalikan menjadi tagihan "Belum Lunas" agar penghuni dapat
 * mengunggah ulang bukti yang benar.
 */
export async function batalkanPengajuanBulanan(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user || session.user.role !== "penghuni") return;

  const kelompok = String(formData.get("kelompok") ?? "").trim();
  if (!kelompok) return;

  const [akun] = await db
    .select({ id: users.id, idPenghuni: users.idPenghuni })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!akun?.idPenghuni) return;

  await db
    .update(pembayaran)
    .set({
      statusBayar: "Belum Lunas",
      kelompokKonfirmasi: null,
      buktiPembayaran: null,
    })
    .where(
      and(
        eq(pembayaran.idPenghuni, akun.idPenghuni),
        eq(pembayaran.kelompokKonfirmasi, kelompok)
      )
    );

  revalidatePath("/portal/bayar");
  revalidatePath("/portal/riwayat");
  revalidatePath("/pembayaran");
}
