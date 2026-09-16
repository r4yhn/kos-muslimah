import type { Metadata } from "next";
import { and, desc, eq, or } from "drizzle-orm";
import { Hourglass } from "lucide-react";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { pembayaran, transaksiOnline } from "@/db/schema";
import { cardClass, eyebrowClass, headingClass, labelClass } from "@/lib/ui";
import { formatIDR, formatTanggal, namaBulan } from "@/lib/format";
import {
  getMidtransClientKey,
  getMidtransSnapJsUrl,
  isMidtransConfigured,
} from "@/lib/midtrans";
import { getPortalData } from "@/lib/portal";
import {
  daftarPeriodeAwal,
  PAKET_BAYAR_AWAL,
} from "@/lib/bayar-awal";
import { BayarAwalForm } from "./bayar-awal-form";
import { MidtransCheckout } from "./midtrans-checkout";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pembayaran Awal",
};

/**
 * Halaman Pembayaran Awal — satu-satunya halaman yang bisa diakses penghuni
 * baru sebelum "Bayar di Awal" tuntas (menu lain terkunci).
 *
 * Fitur 1B: setelah penghuni mengirim bukti, sistem menyimpan pengajuan
 * "Menunggu Konfirmasi" dan halaman menampilkan status tersebut (bukan form)
 * sampai admin memverifikasi → Lunas → kunci terbuka.
 */
export default async function BayarAwalPage({
  searchParams,
}: {
  searchParams: Promise<{ menunggu?: string | string[] }>;
}) {
  const data = await getPortalData();
  if (!data) redirect("/dashboard");
  if (!data.terkunci) redirect("/portal");

  const sp = await searchParams;
  const baruDikirim = typeof sp.menunggu === "string" && sp.menunggu === "1";

  // Ada pengajuan pembayaran awal yang sedang menunggu verifikasi admin?
  const [menunggu] = await db
    .select({ id: pembayaran.id })
    .from(pembayaran)
    .where(
      and(
        eq(pembayaran.idPenghuni, data.penghuniId),
        eq(pembayaran.statusBayar, "Menunggu Konfirmasi")
      )
    )
    .limit(1);

  const hargaSewa = data.hargaSewa ?? 0;
  const mulai = daftarPeriodeAwal(data.tglMasuk, 1)[0];
  const periodeLabel = `${namaBulan(mulai.bulan)} ${mulai.tahun}`;

  // Label cakupan periode untuk tiap paket (1/2/6 bulan).
  const cakupanLabel: Record<number, string> = {};
  for (const p of PAKET_BAYAR_AWAL) {
    const periode = daftarPeriodeAwal(data.tglMasuk, p);
    const awal = periode[0];
    const akhir = periode[periode.length - 1];
    cakupanLabel[p] =
      p === 1
        ? periodeLabel
        : `${namaBulan(awal.bulan).slice(0, 3)} ${awal.tahun} – ${namaBulan(akhir.bulan).slice(0, 3)} ${akhir.tahun}`;
  }

  const midtransTersedia = isMidtransConfigured();

  // Transaksi Midtrans yang masih aktif (belum settlement) milik penghuni ini.
  const [transaksiGateway] = midtransTersedia
    ? await db
        .select({
          orderId: transaksiOnline.orderId,
          redirectUrl: transaksiOnline.redirectUrl,
          nominal: transaksiOnline.nominal,
        })
        .from(transaksiOnline)
        .where(
          and(
            eq(transaksiOnline.idPenghuni, data.penghuniId),
            eq(transaksiOnline.tipe, "bayar_awal"),
            or(
              eq(transaksiOnline.statusMidtrans, "pending"),
              eq(transaksiOnline.statusMidtrans, "challenge")
            )
          )
        )
        .orderBy(desc(transaksiOnline.createdAt))
        .limit(1)
    : [];

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <p className={eyebrowClass}>Portal Penghuni · Bayar di Awal</p>
        <h1 className={headingClass}>Pembayaran Awal Penghuni Baru</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
          Selesaikan pembayaran awal untuk mengaktifkan status kamar secara
          resmi. Pilih paket sewa <strong>1, 2, atau 6 bulan</strong> lalu{" "}
          <strong>bayar online otomatis via Midtrans</strong> (Virtual Account,
          QRIS, E-Wallet) — kamar langsung aktif begitu pembayaran diterima.
          Butuh cara lain? Opsi kirim <em>bukti bayar</em> manual tetap
          tersedia di bawah.
        </p>
      </div>

      {baruDikirim ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-md border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
        >
          <Hourglass aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-300" />
          <span>
            <strong className="font-bold">Bukti pembayaran diterima.</strong>{" "}
            Pengelola akan memverifikasi pengajuan Anda. Status kamar aktif dan
            menu portal terbuka setelah pembayaran dikonfirmasi.
          </span>
        </div>
      ) : null}

      <div className={`${cardClass} p-6`}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className={labelClass}>Penghuni</span>
            <span className="text-base font-bold text-white">{data.nama}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className={labelClass}>Kamar</span>
            <span className="text-base font-bold text-white">
              {data.noKamar ?? "Belum ditetapkan"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className={labelClass}>Tanggal Masuk</span>
            <span className="text-sm text-white/70">
              {formatTanggal(data.tglMasuk)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className={labelClass}>Biaya Sewa / Bulan</span>
            <span className="text-sm text-white/70">
              {hargaSewa ? formatIDR.format(hargaSewa) : "—"}
            </span>
          </div>
        </div>

        <div className="mt-6 border-t border-white/10 pt-6">
          {!data.idKamar || !data.hargaSewa ? (
            <p className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2.5 text-sm text-red-200">
              Kamar Anda belum ditetapkan oleh pengelola. Hubungi pengelola kos
              untuk melanjutkan.
            </p>
          ) : menunggu ? (
            <div className="flex flex-col items-start gap-4 rounded-md border border-amber-400/30 bg-amber-400/10 px-4 py-5">
              <div className="flex items-start gap-2.5">
                <Hourglass
                  aria-hidden
                  className="mt-0.5 size-5 shrink-0 text-amber-300"
                />
                <div>
                  <p className="font-display text-lg font-bold tracking-tight text-white">
                    Pengajuan sedang diverifikasi
                  </p>
                  <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-white/70">
                    Bukti pembayaran awal Anda sudah kami terima dan sedang
                    diperiksa pengelola. Begitu dikonfirmasi{" "}
                    <strong className="text-white">Lunas</strong>, status kamar
                    Anda resmi aktif dan seluruh menu portal terbuka. Jika ada
                    kendala, hubungi pengelola kos.
                  </p>
                </div>
              </div>
            </div>
          ) : midtransTersedia ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
                  Pembayaran Online Otomatis — Midtrans
                </p>
                <MidtransCheckout
                  noKamar={data.noKamar ?? ""}
                  hargaSewa={data.hargaSewa}
                  periodeLabel={periodeLabel}
                  cakupanLabel={cakupanLabel}
                  snapClientKey={getMidtransClientKey()}
                  snapJsUrl={getMidtransSnapJsUrl()}
                  transaksiAktif={transaksiGateway ?? null}
                />
              </div>

              {transaksiGateway ? null : (
                <>
                  <div className="flex items-center gap-3" aria-hidden>
                    <span className="h-px flex-1 bg-white/10" />
                    <span className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-white/35">
                      atau kirim bukti manual (diverifikasi pengelola)
                    </span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                  <BayarAwalForm
                    noKamar={data.noKamar ?? ""}
                    hargaSewa={data.hargaSewa}
                    periodeLabel={periodeLabel}
                    cakupanLabel={cakupanLabel}
                  />
                </>
              )}
            </div>
          ) : (
            <BayarAwalForm
              noKamar={data.noKamar ?? ""}
              hargaSewa={data.hargaSewa}
              periodeLabel={periodeLabel}
              cakupanLabel={cakupanLabel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
