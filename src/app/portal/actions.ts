"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { db } from "@/db";
import { kamar, pembayaran, penghuni, users } from "@/db/schema";
import { arsipkanPenghuni } from "@/lib/arsip";
import {
  daftarPeriodeAwal,
  PAKET_BAYAR_AWAL,
  sinkronPembayaranAwal,
  type PaketBayarAwal,
} from "@/lib/bayar-awal";
import { bacaBuktiDariForm } from "@/lib/bukti";
import { formatIDR, namaBulan, parseTanggal } from "@/lib/format";
import {
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

/**
 * Logout dari portal penghuni — data penghuni otomatis dipindahkan ke arsip.
 *
 * Dipakai tombol *Keluar* pada layout portal. Karena pengarsipan kini menjadi
 * satu-satunya mekanisme keluar dari sisi penghuni (tanpa kartu *Keluar dari
 * Kos* terpisah), tidak ada pemberitahuan apa pun ke penghuni.
 */
export async function logoutPortal() {
  await arsipkanPenghuniPadaLogout();
  await signOut({ redirectTo: "/login" });
}

/**
 * Fitur **Arsip Otomatis & Pengosongan Kamar**: saat penghuni keluar (*logout*)
 * dari portal, datanya **tidak dihapus permanen** — seluruh identitas, kamar
 * yang ditinggalkan, dan salinan riwayat pembayarannya dipindahkan otomatis ke
 * tabel `arsip_penghuni` (menu **Arsip** pada panel pengelola), lalu kamar
 * dikembalikan menjadi "Tersedia". Dipakai oleh `logoutPortal`.
 */
async function arsipkanPenghuniPadaLogout(): Promise<void> {
  const idPenghuni = await idPenghuniDariSesi();
  if (!idPenghuni) return;

  const hasil = await arsipkanPenghuni(
    idPenghuni,
    "Proses Keluar",
    "Penghuni keluar (logout) dari portal penghuni."
  );
  if (!hasil) return;

  revalidatePath("/arsip");
  revalidatePath("/penghuni");
  revalidatePath("/kamar");
  revalidatePath("/dashboard");
}

/** Id data penghuni yang tertaut ke sesi portal yang sedang aktif. */
async function idPenghuniDariSesi(): Promise<string | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "penghuni") return null;

  const [akun] = await db
    .select({ idPenghuni: users.idPenghuni })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return akun?.idPenghuni ?? null;
}

/**
 * Proses "Pembayaran Awal" (bayar online via web) dari halaman /portal/bayar-awal.
 *
 * Alur (pembayaran otomatis Lunas):
 * - hanya akun penghuni yang masih `perlu_bayar_awal` yang boleh mengirim;
 * - penghuni memilih paket 1, 2, atau 6 bulan + metode online + tanggal &
 *   melampirkan **bukti bayar**;
 * - seluruh bulan pada paket **langsung dicatat Lunas** (bukti disimpan sebagai
 *   lampiran audit, bukan antrean verifikasi) sehingga tidak ada lagi status
 *   "Menunggu Konfirmasi" untuk pembayaran baru;
 * - kunci portal otomatis dibuka, kamar resmi "Terisi", dan notifikasi dikirim
 *   ke penghuni & seluruh admin.
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

  // Pastikan tidak ada bulan yang sudah Lunas / sedang menunggu (hindari
  // pembayaran ganda) sebelum menulis apa pun.
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
        error: `Periode ${namaBulan(bulan)} ${tahun} sudah dibayar.`,
      };
    }
  }

  // Catat LUNAS langsung untuk setiap bulan pada paket; bukti tetap disimpan
  // sebagai lampiran agar pengelola dapat mengauditnya di panel Pembayaran.
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
            statusBayar: "Lunas",
            buktiPembayaran: bukti.dataUrl,
            kelompokKonfirmasi: null,
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
          statusBayar: "Lunas",
          buktiPembayaran: bukti.dataUrl,
          kelompokKonfirmasi: null,
        });
      }
      totalBayar += room.hargaSewa;
    }
  });

  // Status sudah Lunas → buka kunci portal & aktifkan kamar secara otomatis.
  await sinkronPembayaranAwal(baris.id);

  // Notifikasi otomatis untuk penghuni & admin.
  const awalPeriode = periodeList[0];
  const akhirPeriode = periodeList[periodeList.length - 1];
  const labelCakupan =
    periodeList.length === 1
      ? `${namaBulan(awalPeriode.bulan)} ${awalPeriode.tahun}`
      : `${namaBulan(awalPeriode.bulan).slice(0, 3)} ${awalPeriode.tahun} – ${namaBulan(akhirPeriode.bulan).slice(0, 3)} ${akhirPeriode.tahun}`;

  await kirimNotifikasi(
    session.user.id,
    "Pembayaran Awal Lunas ✅",
    `Pembayaran awal paket ${paket} bulan (${labelCakupan}) sebesar ${formatIDR.format(totalBayar)} via ${metodeBayar} langsung tercatat LUNAS. Status kamar Anda resmi aktif dan seluruh menu portal sudah terbuka. Terima kasih!`
  );
  await kirimNotifikasiKeRole(
    "admin",
    "Pembayaran Awal Lunas",
    `${baris.nama} (Kamar ${room.noKamar}) melunasi pembayaran awal paket ${paket} bulan (${labelCakupan}) sebesar ${formatIDR.format(totalBayar)} via ${metodeBayar}. Status otomatis menjadi Lunas & kamar resmi Terisi — bukti bayar tersimpan di halaman Pembayaran.`
  );

  revalidatePath("/portal");
  revalidatePath("/portal/bayar-awal");
  revalidatePath("/portal/riwayat");
  revalidatePath("/portal/notifikasi");
  revalidatePath("/dashboard");
  revalidatePath("/kamar");
  revalidatePath("/penghuni");
  revalidatePath("/pembayaran");
  revalidatePath("/laporan");

  redirect(`/portal?selesai=1&paket=${paket}`);
}

/**
 * Tandai seluruh notifikasi portal akun yang sedang login sebagai dibaca.
 */
export async function tandaiSemuaNotifikasiDibacaPortal(): Promise<void> {
  const session = await auth();
  if (!session?.user) return;

  await tandaiSemuaNotifikasiDibaca(session.user.id);
  revalidatePath("/portal/notifikasi");
}
