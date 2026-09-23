import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { pembayaran, penghuni, transaksiOnline, users } from "@/db/schema";
import type { DetailTransaksiOnline } from "@/db/schema";
import { sinkronPembayaranAwal } from "./bayar-awal";
import { formatIDR, namaBulan } from "./format";
import { kirimNotifikasi, kirimNotifikasiKeRole } from "./notifikasi";

/**
 * Terapkan hasil pembayaran online (Midtrans) yang sudah `settlement`:
 * - mencatat/update baris `pembayaran` Lunas untuk setiap periode transaksi;
 * - menandai transaksi lunas;
 * - membuka kunci "Bayar di Awal" (perlu_bayar_awal = false) + kamar Terisi
 *   bila transaksi berjenis "bayar_awal";
 * - mengirim notifikasi ke penghuni & admin.
 *
 * Idempoten: bila transaksi sudah berstatus settlement, tidak ada perubahan.
 * Dipanggil dari webhook Midtrans maupun saat penghuni menekan "cek status".
 */
export async function terapkanSettlementTransaksi(
  orderId: string,
  paymentType?: string
): Promise<"applied" | "noop" | "notfound"> {
  const [transaksi] = await db
    .select()
    .from(transaksiOnline)
    .where(eq(transaksiOnline.orderId, orderId))
    .limit(1);

  if (!transaksi) return "notfound";
  if (transaksi.statusMidtrans === "settlement") return "noop";
  if (
    transaksi.statusMidtrans !== "pending" &&
    transaksi.statusMidtrans !== "challenge"
  ) {
    return "noop";
  }

  const [penghuniRow] = await db
    .select({ id: penghuni.id, nama: penghuni.nama })
    .from(penghuni)
    .where(eq(penghuni.id, transaksi.idPenghuni))
    .limit(1);
  if (!penghuniRow) return "noop";

  const detail = transaksi.detail as DetailTransaksiOnline;
  const periodeList = detail.periode ?? [];
  if (periodeList.length === 0) return "noop";

  const jumlahBulan = periodeList.length;
  const perBulan = Math.round(transaksi.nominal / jumlahBulan);
  const tanggalBayar = new Date();
  const metode = labelMetodeBayar(paymentType ?? transaksi.metodeBayar ?? "");
  const keteranganBulan = `${detail.label} — Midtrans order ${orderId}`;

  await db.transaction(async (tx) => {
    for (const { bulan, tahun } of periodeList) {
      const [catatan] = await tx
        .select({ id: pembayaran.id, statusBayar: pembayaran.statusBayar })
        .from(pembayaran)
        .where(
          and(
            eq(pembayaran.idPenghuni, transaksi.idPenghuni),
            eq(pembayaran.bulan, bulan),
            eq(pembayaran.tahun, tahun)
          )
        )
        .limit(1);

      const nilai = {
        tanggalBayar,
        jumlahBayar: perBulan,
        metodeBayar: metode,
        keterangan: keteranganBulan,
        statusBayar: "Lunas" as const,
        buktiPembayaran: null,
        kelompokKonfirmasi: null,
      };

      if (catatan) {
        if (catatan.statusBayar === "Lunas") continue;
        await tx.update(pembayaran).set(nilai).where(eq(pembayaran.id, catatan.id));
      } else {
        await tx.insert(pembayaran).values({
          idPenghuni: transaksi.idPenghuni,
          bulan,
          tahun,
          ...nilai,
        });
      }
    }

    await tx
      .update(transaksiOnline)
      .set({
        statusMidtrans: "settlement",
        metodeBayar: metode,
        updatedAt: new Date(),
      })
      .where(eq(transaksiOnline.id, transaksi.id));
  });

  // Transaksi "bayar_awal": buka kunci portal & aktifkan kamar bila bulan
  // pertama pada paket sudah tercatat Lunas.
  if (transaksi.tipe === "bayar_awal") {
    await sinkronPembayaranAwal(transaksi.idPenghuni);
  }

  // Notifikasi ke akun portal penghuni.
  const [akunPenghuni] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.idPenghuni, transaksi.idPenghuni))
    .limit(1);

  const labelPeriode = periodeList
    .map((p) => `${namaBulan(p.bulan)} ${p.tahun}`)
    .join(", ");
  const pesanPenghuni = `Pembayaran ${labelPeriode} sebesar ${formatIDR.format(
    transaksi.nominal
  )} via Midtrans (${metode}) telah diterima otomatis. Terima kasih!`;

  if (akunPenghuni) {
    await kirimNotifikasi(
      akunPenghuni.id,
      transaksi.tipe === "bayar_awal"
        ? "Pembayaran Awal Lunas ✅"
        : "Pembayaran Bulanan Lunas ✅",
      pesanPenghuni
    );
  }

  await kirimNotifikasiKeRole(
    "admin",
    "Pembayaran Online Otomatis Dikonfirmasi",
    `${penghuniRow.nama} menyelesaikan ${detail.label} ${formatIDR.format(
      transaksi.nominal
    )} via Midtrans (${metode}) — tercatat Lunas otomatis.`
  );

  revalidatePath("/portal");
  revalidatePath("/portal/bayar-awal");
  revalidatePath("/portal/bayar");
  revalidatePath("/portal/riwayat");
  revalidatePath("/portal/notifikasi");
  revalidatePath("/dashboard");
  revalidatePath("/kamar");
  revalidatePath("/penghuni");
  revalidatePath("/pembayaran");
  revalidatePath("/laporan");

  return "applied";
}

/** Ubah status Midtrans non-final (pending/deny/expire/cancel/challenge). */
export async function perbaruiStatusTransaksi(
  orderId: string,
  statusMidtrans: string,
  paymentType?: string
): Promise<"updated" | "notfound"> {
  const [transaksi] = await db
    .select({
      id: transaksiOnline.id,
      statusMidtrans: transaksiOnline.statusMidtrans,
      metodeBayar: transaksiOnline.metodeBayar,
    })
    .from(transaksiOnline)
    .where(eq(transaksiOnline.orderId, orderId))
    .limit(1);

  if (!transaksi) return "notfound";
  // Jangan menimpa status settlement dengan notifikasi yang datang terlambat.
  if (transaksi.statusMidtrans === "settlement") return "updated";

  await db
    .update(transaksiOnline)
    .set({
      statusMidtrans,
      metodeBayar: paymentType
        ? labelMetodeBayar(paymentType)
        : transaksi.metodeBayar,
      updatedAt: new Date(),
    })
    .where(eq(transaksiOnline.id, transaksi.id));

  return "updated";
}

/** Terjemahkan payment_type Midtrans menjadi label Indonesia yang ramah. */
export function labelMetodeBayar(paymentType: string): string {
  if (!paymentType) return "Midtrans";
  const map: Record<string, string> = {
    bank_transfer: "Transfer Bank",
    bca_va: "Virtual Account (BCA)",
    bni_va: "Virtual Account (BNI)",
    bri_va: "Virtual Account (BRI)",
    permata_va: "Virtual Account (Permata)",
    other_va: "Virtual Account",
    echannel: "Virtual Account (Mandiri)",
    qris: "QRIS",
    gopay: "E-Wallet (GoPay)",
    shopeepay: "E-Wallet (ShopeePay)",
    dana: "E-Wallet (DANA)",
    ovo: "E-Wallet (OVO)",
    cstore: "Convenience Store",
    akulaku: "Akulaku",
    kredivo: "Kredivo",
    bank_qa: "Midtrans (QA)",
  };
  const label = map[paymentType.toLowerCase()];
  return label ? label : `Midtrans ${paymentType}`;
}

