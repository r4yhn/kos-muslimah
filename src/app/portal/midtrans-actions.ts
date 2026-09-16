"use server";

import { randomUUID } from "node:crypto";

import { and, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { db } from "@/db";
import { kamar, pembayaran, penghuni, transaksiOnline, users } from "@/db/schema";
import { daftarPeriodeAwal, PAKET_BAYAR_AWAL } from "@/lib/bayar-awal";
import {
  bandingkanPeriode,
  daftarPeriodeBayarOnline,
  kunciPeriode,
  MAKS_PAKET_ONLINE,
} from "@/lib/bayar-bulanan";
import { formatIDR, namaBulan } from "@/lib/format";
import {
  buatSnapTransaksi,
  cekStatusMidtrans,
  isMidtransConfigured,
  normalisasiStatusMidtrans,
} from "@/lib/midtrans";
import { kirimNotifikasi } from "@/lib/notifikasi";
import {
  perbaruiStatusTransaksi,
  terapkanSettlementTransaksi,
} from "@/lib/payment-online";

export type HasilBuatTransaksi =
  | { ok: true; snapToken: string; redirectUrl: string; orderId: string }
  | { ok: false; error: string };

export type HasilCekStatus =
  | { ok: true; status: string; final: boolean }
  | { ok: false; error: string };

/** Label ringkas beberapa periode, mis. "Sep 2026 – Feb 2027". */
function labelRentangPeriode(periodeList: { bulan: number; tahun: number }[]) {
  const awal = periodeList[0];
  const akhir = periodeList[periodeList.length - 1];
  if (!awal) return "";
  if (periodeList.length === 1) return `${namaBulan(awal.bulan)} ${awal.tahun}`;
  return `${namaBulan(awal.bulan).slice(0, 3)} ${awal.tahun} – ${namaBulan(
    akhir.bulan
  ).slice(0, 3)} ${akhir.tahun}`;
}

/**
 * Beri tahu penghuni bahwa order pembayaran online sudah dibuat (status
 * "pending" / menunggu pembayaran) supaya juga tampil di pusat notifikasi —
 * bukan hanya saat pembayaran sudah lunas.
 */
async function notifikasiMenungguPembayaran(params: {
  idUser: string;
  orderId: string;
  nominal: number;
  label: string;
}): Promise<void> {
  await kirimNotifikasi(
    params.idUser,
    "Menunggu Pembayaran Online ⏳",
    `Order ${params.orderId} untuk ${params.label} sebesar ${formatIDR.format(
      params.nominal
    )} sudah dibuat. Selesaikan pembayaran sebelum kedaluwarsa (24 jam) — status tagihan otomatis berubah menjadi Lunas begitu pembayaran diterima.`
  );

  revalidatePath("/portal");
  revalidatePath("/portal/bayar");
  revalidatePath("/portal/bayar-awal");
  revalidatePath("/portal/notifikasi");
}

/**
 * Buat order pembayaran online (Midtrans Snap) untuk "Pembayaran Awal" dari
 * halaman /portal/bayar-awal. Order hanya dibuat bila:
 * - akun adalah penghuni yang masih wajib bayar awal (perlu_bayar_awal);
 * - kamar sudah ditetapkan;
 * - tidak ada transaksi Midtrans lain yang masih pending;
 * - tidak ada bulan pada paket yang sudah Lunas / sedang menunggu konfirmasi.
 */
export async function buatTransaksiAwal(
  paket: number
): Promise<HasilBuatTransaksi> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sesi berakhir. Silakan masuk kembali." };
  if (session.user.role !== "penghuni") {
    return { ok: false, error: "Halaman ini khusus akun penghuni." };
  }

  if (!isMidtransConfigured()) {
    return {
      ok: false,
      error: "Pembayaran online belum tersedia. Hubungi pengelola kos.",
    };
  }

  const [akun] = await db
    .select({ id: users.id, email: users.email, idPenghuni: users.idPenghuni })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!akun?.idPenghuni) {
    return { ok: false, error: "Akun tidak tertaut ke data penghuni. Hubungi pengelola." };
  }

  const [penghuniRow] = await db
    .select({
      id: penghuni.id,
      nama: penghuni.nama,
      noHp: penghuni.noHp,
      tglMasuk: penghuni.tglMasuk,
      perluBayarAwal: penghuni.perluBayarAwal,
      idKamar: penghuni.idKamar,
    })
    .from(penghuni)
    .where(eq(penghuni.id, akun.idPenghuni))
    .limit(1);

  if (!penghuniRow) return { ok: false, error: "Data penghuni tidak ditemukan." };
  if (!penghuniRow.perluBayarAwal) {
    return { ok: false, error: "Tidak ada tagihan pembayaran awal untuk akun ini." };
  }
  if (!penghuniRow.idKamar) {
    return {
      ok: false,
      error: "Kamar belum ditetapkan. Hubungi pengelola untuk mengaktifkan kamar Anda.",
    };
  }
  if (!PAKET_BAYAR_AWAL.includes(paket as (typeof PAKET_BAYAR_AWAL)[number])) {
    return { ok: false, error: "Paket pembayaran tidak valid." };
  }

  const [room] = await db
    .select({ noKamar: kamar.noKamar, hargaSewa: kamar.hargaSewa })
    .from(kamar)
    .where(eq(kamar.id, penghuniRow.idKamar))
    .limit(1);
  if (!room) return { ok: false, error: "Data kamar tidak ditemukan." };

  const periodeList = daftarPeriodeAwal(penghuniRow.tglMasuk, paket);

  // Pastikan belum ada transaksi gateway lain yang masih berjalan.
  const [pending] = await db
    .select({ orderId: transaksiOnline.orderId })
    .from(transaksiOnline)
    .where(
      and(
        eq(transaksiOnline.idPenghuni, penghuniRow.id),
        eq(transaksiOnline.tipe, "bayar_awal"),
        eq(transaksiOnline.statusMidtrans, "pending")
      )
    )
    .limit(1);
  if (pending) {
    return {
      ok: false,
      error:
        "Masih ada transaksi pembayaran yang belum selesai. Buka halaman pembayaran atau cek status terlebih dahulu.",
    };
  }

  // Hindari periode yang sudah Lunas / sedang menunggu konfirmasi manual.
  for (const { bulan, tahun } of periodeList) {
    const [catatan] = await db
      .select({ statusBayar: pembayaran.statusBayar })
      .from(pembayaran)
      .where(
        and(
          eq(pembayaran.idPenghuni, penghuniRow.id),
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
        ok: false,
        error: "Sebagian periode pada paket sudah dibayar atau sedang menunggu konfirmasi.",
      };
    }
  }

  const nominal = room.hargaSewa * paket;
  const orderId = `KOS-${randomUUID()}`;

  let snap;
  try {
    snap = await buatSnapTransaksi({
      orderId,
      grossAmount: nominal,
      customerDetails: {
        first_name: penghuniRow.nama,
        email: akun.email,
        phone: penghuniRow.noHp,
      },
      itemDetails: [
        {
          id: `KAMAR-${room.noKamar}`,
          price: room.hargaSewa,
          quantity: paket,
          name: `Sewa awal Kamar ${room.noKamar} (${paket} bulan)`,
        },
      ],
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Gagal membuat pembayaran.",
    };
  }

  await db.insert(transaksiOnline).values({
    orderId,
    idPenghuni: penghuniRow.id,
    tipe: "bayar_awal",
    nominal,
    statusMidtrans: "pending",
    snapToken: snap.token,
    redirectUrl: snap.redirect_url,
    detail: {
      paket,
      periode: periodeList.map((p) => ({ bulan: p.bulan, tahun: p.tahun })),
      label: `Pembayaran Awal paket ${paket} bulan (Kamar ${room.noKamar})`,
    },
  });

  // Notifikasi "menunggu pembayaran" agar status pending juga terlihat
  // penghuni di pusat notifikasi.
  await notifikasiMenungguPembayaran({
    idUser: akun.id,
    orderId,
    nominal,
    label: `Pembayaran Awal paket ${paket} bulan (${labelRentangPeriode(
      periodeList
    )})`,
  });

  return {
    ok: true,
    snapToken: snap.token,
    redirectUrl: snap.redirect_url,
    orderId,
  };
}

/**
 * Cek status order Midtrans dari sisi server. Dipanggil setelah popup Snap
 * sukses / saat penghuni menekan "Saya sudah bayar". Bila settlement,
 * pembayaran langsung dicatat Lunas (idempoten).
 */
export async function cekStatusTransaksiMidtrans(
  orderId: string
): Promise<HasilCekStatus> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "Sesi berakhir. Silakan masuk kembali." };
  if (session.user.role !== "penghuni") {
    return { ok: false, error: "Halaman ini khusus akun penghuni." };
  }

  const [akun] = await db
    .select({ idPenghuni: users.idPenghuni })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!akun?.idPenghuni) {
    return { ok: false, error: "Akun tidak tertaut ke data penghuni." };
  }

  const [transaksi] = await db
    .select({
      id: transaksiOnline.id,
      statusMidtrans: transaksiOnline.statusMidtrans,
    })
    .from(transaksiOnline)
    .where(
      and(
        eq(transaksiOnline.orderId, orderId),
        eq(transaksiOnline.idPenghuni, akun.idPenghuni)
      )
    )
    .limit(1);
  if (!transaksi) return { ok: false, error: "Transaksi tidak ditemukan." };

  // Sudah settlement — tidak perlu tanya Midtrans lagi.
  if (transaksi.statusMidtrans === "settlement") {
    return { ok: true, status: "settlement", final: true };
  }

  try {
    const data = await cekStatusMidtrans(orderId);
    const status = normalisasiStatusMidtrans({
      transaction_status: String(data.transaction_status ?? ""),
      fraud_status: String(data.fraud_status ?? ""),
    });
    const paymentType = String(data.payment_type ?? "");

    if (status === "settlement") {
      await terapkanSettlementTransaksi(orderId, paymentType || undefined);
      return { ok: true, status: "settlement", final: true };
    }

    await perbaruiStatusTransaksi(orderId, status, paymentType || undefined);
    return {
      ok: true,
      status,
      final: status === "expire" || status === "cancel" || status === "deny",
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Gagal mengecek status pembayaran. Silakan coba lagi.",
    };
  }
}

/**
 * Buat order pembayaran online (Midtrans Snap) untuk "Sewa Bulanan" dari
 * halaman /portal/bayar. Tersedia untuk penghuni yang sudah aktif — yaitu
 * setelah Pembayaran Awal tuntas dan seluruh menu portal terbuka.
 *
 * Order hanya dibuat bila:
 * - akun adalah penghuni berstatus Aktif dengan kamar & tarif sewa yang jelas;
 * - setiap bulan yang dipilih benar-benar tagihan belum Lunas milik penghuni
 *   ini (dihitung ulang di server, bukan dipercaya dari form);
 * - tidak ada transaksi gateway bulanan lain yang masih berjalan.
 *
 * Saat Midtrans melaporkan `settlement`, baris `pembayaran` per bulan dicatat
 * Lunas otomatis (lihat `lib/payment-online.ts`) tanpa verifikasi manual.
 */
export async function buatTransaksiBulanan(
  periodeKeys: string[]
): Promise<HasilBuatTransaksi> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, error: "Sesi berakhir. Silakan masuk kembali." };
  }
  if (session.user.role !== "penghuni") {
    return { ok: false, error: "Halaman ini khusus akun penghuni." };
  }

  if (!isMidtransConfigured()) {
    return {
      ok: false,
      error: "Pembayaran online belum tersedia. Hubungi pengelola kos.",
    };
  }

  const [akun] = await db
    .select({ id: users.id, email: users.email, idPenghuni: users.idPenghuni })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!akun?.idPenghuni) {
    return {
      ok: false,
      error: "Akun tidak tertaut ke data penghuni. Hubungi pengelola.",
    };
  }

  const [penghuniRow] = await db
    .select({
      id: penghuni.id,
      nama: penghuni.nama,
      noHp: penghuni.noHp,
      status: penghuni.status,
      tglMasuk: penghuni.tglMasuk,
      perluBayarAwal: penghuni.perluBayarAwal,
      idKamar: penghuni.idKamar,
    })
    .from(penghuni)
    .where(eq(penghuni.id, akun.idPenghuni))
    .limit(1);

  if (!penghuniRow) return { ok: false, error: "Data penghuni tidak ditemukan." };
  if (penghuniRow.status !== "Aktif") {
    return { ok: false, error: "Akun penghuni tidak aktif. Hubungi pengelola." };
  }
  if (penghuniRow.perluBayarAwal) {
    return {
      ok: false,
      error:
        "Selesaikan Pembayaran Awal terlebih dahulu sebelum bayar sewa bulanan.",
    };
  }
  if (!penghuniRow.idKamar) {
    return {
      ok: false,
      error:
        "Kamar belum ditetapkan. Hubungi pengelola untuk mengaktifkan kamar Anda.",
    };
  }

  const [room] = await db
    .select({ noKamar: kamar.noKamar, hargaSewa: kamar.hargaSewa })
    .from(kamar)
    .where(eq(kamar.id, penghuniRow.idKamar))
    .limit(1);
  if (!room) return { ok: false, error: "Data kamar tidak ditemukan." };
  if (room.hargaSewa <= 0) {
    return {
      ok: false,
      error: "Biaya sewa kamar belum ditetapkan. Hubungi pengelola.",
    };
  }

  // Periode yang boleh dibayar online: rangkaian bulan berurutan mulai dari
  // tagihan terawal, termasuk bulan mendatang ("bayar di muka") sehingga paket
  // 1/2/6 bulan seperti Pembayaran Awal juga tersedia di sini.
  const bolehBayar = new Set(
    (
      await daftarPeriodeBayarOnline(penghuniRow.id, penghuniRow.tglMasuk)
    ).map(kunciPeriode)
  );
  if (bolehBayar.size === 0) {
    return { ok: false, error: "Tidak ada tagihan yang perlu dibayar saat ini." };
  }

  const dipilih = [...new Set(periodeKeys)].filter((k) =>
    /^\d{4}-\d{2}$/.test(k)
  );
  if (dipilih.length === 0) {
    return { ok: false, error: "Pilih minimal satu bulan tagihan untuk dibayar." };
  }
  if (dipilih.length > MAKS_PAKET_ONLINE) {
    return {
      ok: false,
      error: `Maksimal ${MAKS_PAKET_ONLINE} bulan dalam satu pembayaran online.`,
    };
  }
  if (!dipilih.every((k) => bolehBayar.has(k))) {
    return {
      ok: false,
      error:
        "Sebagian bulan yang dipilih tidak dapat dibayar (sudah lunas, menunggu konfirmasi, atau terlalu jauh ke depan). Muat ulang halaman lalu coba lagi.",
    };
  }

  const periodeList = dipilih
    .map((k) => ({ tahun: Number(k.slice(0, 4)), bulan: Number(k.slice(5, 7)) }))
    .sort(bandingkanPeriode);

  // Pastikan belum ada transaksi gateway bulanan lain yang masih berjalan.
  const [pending] = await db
    .select({ orderId: transaksiOnline.orderId })
    .from(transaksiOnline)
    .where(
      and(
        eq(transaksiOnline.idPenghuni, penghuniRow.id),
        eq(transaksiOnline.tipe, "bayar_bulanan"),
        or(
          eq(transaksiOnline.statusMidtrans, "pending"),
          eq(transaksiOnline.statusMidtrans, "challenge")
        )
      )
    )
    .limit(1);
  if (pending) {
    return {
      ok: false,
      error:
        "Masih ada transaksi pembayaran online yang belum selesai. Lanjutkan pembayaran atau cek statusnya terlebih dahulu.",
    };
  }

  const nominal = room.hargaSewa * periodeList.length;
  const orderId = `KOS-${randomUUID()}`;

  let snap;
  try {
    snap = await buatSnapTransaksi({
      orderId,
      grossAmount: nominal,
      customerDetails: {
        first_name: penghuniRow.nama,
        email: akun.email,
        phone: penghuniRow.noHp,
      },
      itemDetails: periodeList.map((p) => ({
        id: `SEWA-${p.tahun}-${String(p.bulan).padStart(2, "0")}`,
        price: room.hargaSewa,
        quantity: 1,
        name: `Sewa ${namaBulan(p.bulan)} ${p.tahun} - Kamar ${room.noKamar}`.slice(
          0,
          50
        ),
      })),
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Gagal membuat pembayaran.",
    };
  }

  await db.insert(transaksiOnline).values({
    orderId,
    idPenghuni: penghuniRow.id,
    tipe: "bayar_bulanan",
    nominal,
    statusMidtrans: "pending",
    snapToken: snap.token,
    redirectUrl: snap.redirect_url,
    detail: {
      periode: periodeList,
      label: `Pembayaran Sewa Bulanan ${periodeList.length} bulan (Kamar ${room.noKamar})`,
    },
  });

  // Notifikasi "menunggu pembayaran" agar status pending juga terlihat
  // penghuni di pusat notifikasi (bukan hanya setelah lunas).
  await notifikasiMenungguPembayaran({
    idUser: akun.id,
    orderId,
    nominal,
    label: `sewa ${labelRentangPeriode(periodeList)} (Kamar ${room.noKamar})`,
  });

  return {
    ok: true,
    snapToken: snap.token,
    redirectUrl: snap.redirect_url,
    orderId,
  };
}
