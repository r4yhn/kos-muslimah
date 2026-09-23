"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { pembayaran, penghuni, users } from "@/db/schema";
import { parseTanggal, namaBulan, formatIDR } from "@/lib/format";
import { sinkronPembayaranAwal } from "@/lib/bayar-awal";
import { kirimNotifikasi, kirimNotifikasiKePenghuni } from "@/lib/notifikasi";

export type PembayaranState = { error?: string } | undefined;

const METODE_VALID = ["Cash", "Transfer", "E-Wallet", "Lainnya"] as const;
const STATUS_VALID = [
  "Lunas",
  "Menunggu Konfirmasi",
  "Belum Lunas",
] as const;

async function isAutentik(): Promise<boolean> {
  const session = await auth();
  // Hanya pengelola (role "admin") yang boleh mencatat/mengubah/menghapus
  // pembayaran. Role "pemilik" bersifat read-only di /monitoring.
  return session?.user?.role === "admin";
}

/** Simpan catatan pembayaran sewa (tambah/ubah). */
export async function simpanPembayaran(
  _prevState: PembayaranState,
  formData: FormData
): Promise<PembayaranState> {
  if (!(await isAutentik())) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }

  const id = String(formData.get("id") ?? "").trim() || null;
  const idPenghuni = String(formData.get("idPenghuni") ?? "").trim();
  const bulan = Number(formData.get("bulan"));
  const tahun = Number(formData.get("tahun"));
  const jumlahBayar = Number(formData.get("jumlahBayar"));
  const metodeBayar = String(formData.get("metodeBayar") ?? "");
  const statusBayarRaw = String(formData.get("statusBayar") ?? "Lunas");
  const keterangan = String(formData.get("keterangan") ?? "").trim();
  const tanggalBayar = parseTanggal(formData.get("tanggalBayar"));

  // Jatuh tempo bersifat opsional (umumnya sudah diisi tagihan otomatis).
  const jatuhTempoRaw = String(formData.get("jatuhTempo") ?? "").trim();
  const jatuhTempo = jatuhTempoRaw ? parseTanggal(jatuhTempoRaw) : null;
  if (jatuhTempoRaw && !jatuhTempo) {
    return { error: "Tanggal jatuh tempo tidak valid." };
  }

  if (!idPenghuni) return { error: "Pilih penghuni terlebih dahulu." };
  if (!Number.isInteger(bulan) || bulan < 1 || bulan > 12) {
    return { error: "Bulan tidak valid (1–12)." };
  }
  if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) {
    return { error: "Tahun tidak valid." };
  }
  if (!Number.isInteger(jumlahBayar) || jumlahBayar <= 0) {
    return { error: "Jumlah bayar harus berupa angka bulat lebih dari 0." };
  }
  if (!METODE_VALID.includes(metodeBayar as (typeof METODE_VALID)[number])) {
    return { error: "Metode bayar tidak valid." };
  }
  if (!STATUS_VALID.includes(statusBayarRaw as (typeof STATUS_VALID)[number])) {
    return { error: "Status bayar tidak valid." };
  }
  if (!tanggalBayar) return { error: "Tanggal bayar tidak valid." };

  const [penghuniRow] = await db
    .select({ id: penghuni.id, status: penghuni.status })
    .from(penghuni)
    .where(eq(penghuni.id, idPenghuni))
    .limit(1);
  if (!penghuniRow) return { error: "Penghuni tidak ditemukan." };
  if (!id && penghuniRow.status !== "Aktif") {
    return { error: "Hanya penghuni berstatus aktif yang dapat dicatat." };
  }

  const statusBayar = statusBayarRaw as (typeof STATUS_VALID)[number];

  // Status sebelum perubahan — dipakai untuk mendeteksi perubahan
  // "Belum Lunas" → "Lunas" agar penghuni mendapat notifikasi otomatis.
  let statusSebelumnya: string | null = null;

  if (id) {
    const [existing] = await db
      .select({ id: pembayaran.id, statusBayar: pembayaran.statusBayar })
      .from(pembayaran)
      .where(eq(pembayaran.id, id))
      .limit(1);
    if (!existing) return { error: "Catatan pembayaran tidak ditemukan." };
    statusSebelumnya = existing.statusBayar;

    await db
      .update(pembayaran)
      .set({
        idPenghuni,
        tanggalBayar,
        jatuhTempo,
        bulan,
        tahun,
        jumlahBayar,
        metodeBayar,
        keterangan: keterangan || null,
        statusBayar,
        // Bukan lagi pengajuan -> lepas dari grup konfirmasi.
        ...(statusBayar !== "Menunggu Konfirmasi" ? { kelompokKonfirmasi: null } : {}),
      })
      .where(eq(pembayaran.id, id));
  } else {
    // Maksimal satu baris per penghuni per periode (bulan & tahun).
    const [sudahAda] = await db
      .select({ id: pembayaran.id, statusBayar: pembayaran.statusBayar })
      .from(pembayaran)
      .where(
        and(
          eq(pembayaran.idPenghuni, idPenghuni),
          eq(pembayaran.bulan, bulan),
          eq(pembayaran.tahun, tahun)
        )
      )
      .limit(1);
    statusSebelumnya = sudahAda?.statusBayar ?? null;

    if (sudahAda?.statusBayar === "Lunas") {
      return {
        error:
          "Periode tersebut sudah tercatat Lunas. Gunakan Edit untuk mengubah catatan yang ada.",
      };
    }
    if (sudahAda?.statusBayar === "Menunggu Konfirmasi") {
      return {
        error:
          "Periode tersebut sedang menunggu konfirmasi penghuni. Verifikasi pengajuan atau gunakan Edit.",
      };
    }

    if (sudahAda?.statusBayar === "Belum Lunas") {
      // Melunasi tagihan yang sudah diterbitkan (otomatis maupun manual).
      await db
        .update(pembayaran)
        .set({
          idPenghuni,
          tanggalBayar,
          jatuhTempo,
          bulan,
          tahun,
          jumlahBayar,
          metodeBayar,
          keterangan: keterangan || null,
          statusBayar,
          ...(statusBayar !== "Menunggu Konfirmasi"
            ? { kelompokKonfirmasi: null }
            : {}),
        })
        .where(eq(pembayaran.id, sudahAda.id));
    } else {
      await db.insert(pembayaran).values({
        idPenghuni,
        tanggalBayar,
        jatuhTempo,
        bulan,
        tahun,
        jumlahBayar,
        metodeBayar,
        keterangan: keterangan || null,
        statusBayar,
      });
    }
  }

  // Aturan Bayar di Awal: bila catatan Lunas ini menutup periode awal penghuni
  // baru, kunci portal otomatis terbuka & kamar resmi menjadi "Terisi".
  await sinkronPembayaranAwal(idPenghuni);

  // Notifikasi otomatis ke penghuni saat tagihan berubah menjadi Lunas
  // (mis. admin mencatat pembayaran tunai/transfer yang diterima).
  if (statusBayar === "Lunas" && statusSebelumnya !== "Lunas") {
    await kirimNotifikasiKePenghuni(
      idPenghuni,
      "Pembayaran Lunas ✅",
      `Pembayaran sewa ${namaBulan(bulan)} ${tahun} sebesar ${formatIDR.format(jumlahBayar)} sudah dicatat pengelola via ${metodeBayar} dan berstatus LUNAS. Terima kasih!`
    );
  }

  revalidatePath("/pembayaran");
  revalidatePath("/dashboard");
  revalidatePath("/laporan");
  revalidatePath("/portal");
  revalidatePath("/portal/riwayat");
  redirect("/pembayaran");
}

/** Hapus catatan pembayaran. */
export async function hapusPembayaran(formData: FormData): Promise<void> {
  if (!(await isAutentik())) return;

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  await db.delete(pembayaran).where(eq(pembayaran.id, id));
  revalidatePath("/pembayaran");
}

/**
 * Verifikasi pengajuan pembayaran online (Roadmap 1B).
 * Seluruh baris bertanda `kelompok_konfirmasi` yang sama diproses sekaligus:
 * - "terima" -> semua menjadi Lunas (kunci bayar-awal dibuka bila relevan);
 * - "tolak"  -> kembali menjadi tagihan "Belum Lunas" & penghuni diberi tahu.
 */
export async function verifikasiPembayaran(formData: FormData): Promise<void> {
  const session = await auth();
  if (session?.user?.role !== "admin") return;

  const kelompok = String(formData.get("kelompok") ?? "").trim();
  const aksi = String(formData.get("aksi") ?? "");
  if (!kelompok || !["terima", "tolak"].includes(aksi)) return;

  const rows = await db
    .select({
      id: pembayaran.id,
      idPenghuni: pembayaran.idPenghuni,
      bulan: pembayaran.bulan,
      tahun: pembayaran.tahun,
      jumlahBayar: pembayaran.jumlahBayar,
      metodeBayar: pembayaran.metodeBayar,
    })
    .from(pembayaran)
    .where(eq(pembayaran.kelompokKonfirmasi, kelompok));

  if (rows.length === 0) return;

  // Satu pengajuan normalnya milik satu penghuni.
  const idPenghuniList = [...new Set(rows.map((r) => r.idPenghuni))];

  const daftarPeriode = [...rows]
    .sort(
      (a, b) =>
        a.tahun * 12 + a.bulan - (b.tahun * 12 + b.bulan)
    )
    .map((r) => `${namaBulan(r.bulan)} ${r.tahun}`);
  const total = rows.reduce((acc, r) => acc + r.jumlahBayar, 0);
  const labelCakupan =
    daftarPeriode.length === 1
      ? daftarPeriode[0]
      : `${daftarPeriode[0]} – ${daftarPeriode[daftarPeriode.length - 1]}`;

  if (aksi === "terima") {
    await db
      .update(pembayaran)
      .set({
        statusBayar: "Lunas",
        kelompokKonfirmasi: null,
      })
      .where(eq(pembayaran.kelompokKonfirmasi, kelompok));
  } else {
    await db
      .update(pembayaran)
      .set({
        statusBayar: "Belum Lunas",
        kelompokKonfirmasi: null,
        buktiPembayaran: null,
      })
      .where(eq(pembayaran.kelompokKonfirmasi, kelompok));
  }

  // Kirim notifikasi hasil verifikasi ke penghuni yang bersangkutan.
  const akunPenghuni = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.idPenghuni, idPenghuniList));
  const pesan =
    aksi === "terima"
      ? `Pembayaran ${labelCakupan} sebesar ${formatIDR.format(total)} telah dikonfirmasi dan dicatat Lunas. Terima kasih!`
      : `Pembayaran ${labelCakupan} sebesar ${formatIDR.format(total)} ditolak dan dikembalikan menjadi tagihan. Silakan periksa kembali bukti/metode lalu unggah ulang.`;

  for (const akun of akunPenghuni) {
    await kirimNotifikasi(
      akun.id,
      aksi === "terima" ? "Pembayaran Dikonfirmasi ✅" : "Pembayaran Ditolak ⚠️",
      pesan
    );
  }

  if (aksi === "terima") {
    for (const id of idPenghuniList) {
      await sinkronPembayaranAwal(id);
    }
  }

  revalidatePath("/pembayaran");
  revalidatePath("/dashboard");
  revalidatePath("/laporan");
  revalidatePath("/portal");
  revalidatePath("/portal/bayar");
  revalidatePath("/portal/riwayat");
  revalidatePath("/penghuni");
}
