import type { Metadata } from "next";
import { and, desc, eq, or } from "drizzle-orm";
import { CalendarCheck2, Hourglass } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  btnPrimaryClass,
  btnSecondaryClass,
  cardClass,
  eyebrowClass,
  headingClass,
  labelClass,
} from "@/lib/ui";
import { db } from "@/db";
import { pembayaran, transaksiOnline } from "@/db/schema";
import { formatIDR, formatTanggal, namaBulan } from "@/lib/format";
import {
  getMidtransClientKey,
  getMidtransSnapJsUrl,
  isMidtransConfigured,
} from "@/lib/midtrans";
import { getPortalData } from "@/lib/portal";
import {
  bandingkanPeriode,
  daftarPeriodeBayarOnline,
  daftarTagihanBulanan,
  kunciPeriode,
  periodeSekarang,
} from "@/lib/bayar-bulanan";
import { BayarBulananForm } from "./bayar-form";
import { MidtransBulananCheckout } from "./midtrans-bulanan-checkout";
import { batalkanPengajuanBulanan } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bayar Sewa Bulanan",
};

type KelompokMenunggu = {
  kelompok: string;
  periode: string;
  jumlahBulan: number;
  total: number;
  metode: string;
  tanggalBayar: Date | null;
};

/**
 * Halaman "Bayar Sewa Bulanan" — penghuni aktif dapat mengajukan pembayaran
 * tagihan yang belum Lunas dengan melampirkan bukti. Pengajuan ber-status
 * "Menunggu Konfirmasi" ditampilkan terpisah dan bisa dibatalkan.
 */
export default async function PortalBayarPage({
  searchParams,
}: {
  searchParams: Promise<{ menunggu?: string | string[] }>;
}) {
  const data = await getPortalData();
  if (!data) redirect("/dashboard");
  if (data.terkunci) redirect("/portal/bayar-awal");

  const sp = await searchParams;
  const baruDikirim = typeof sp.menunggu === "string" && sp.menunggu === "1";

  const hargaSewa = data.hargaSewa ?? 0;
  const tagihan = await daftarTagihanBulanan(data.penghuniId, data.tglMasuk);
  const bulanIni = periodeSekarang();
  const labelBulanIni = `${namaBulan(bulanIni.bulan)} ${bulanIni.tahun}`;

  // Data untuk form (client): { key, label } tanpa membawa dependency DB.
  const tagihanForm = tagihan.map((p) => ({
    key: kunciPeriode(p),
    label: `${namaBulan(p.bulan)} ${p.tahun}`,
  }));

  // Kelompok pengajuan "Menunggu Konfirmasi" milik penghuni ini.
  const menungguRows = await db
    .select({
      bulan: pembayaran.bulan,
      tahun: pembayaran.tahun,
      jumlahBayar: pembayaran.jumlahBayar,
      metodeBayar: pembayaran.metodeBayar,
      tanggalBayar: pembayaran.tanggalBayar,
      kelompokKonfirmasi: pembayaran.kelompokKonfirmasi,
    })
    .from(pembayaran)
    .where(
      and(
        eq(pembayaran.idPenghuni, data.penghuniId),
        eq(pembayaran.statusBayar, "Menunggu Konfirmasi")
      )
    )
    .orderBy(pembayaran.tahun, pembayaran.bulan);

  const petaKelompok = new Map<string, KelompokMenunggu>();
  for (const r of menungguRows) {
    if (!r.kelompokKonfirmasi) continue;
    const kunci = r.kelompokKonfirmasi;
    const entry = petaKelompok.get(kunci) ?? {
      kelompok: kunci,
      periode: "",
      jumlahBulan: 0,
      total: 0,
      metode: r.metodeBayar,
      tanggalBayar: r.tanggalBayar,
    };
    entry.jumlahBulan += 1;
    entry.total += r.jumlahBayar;
    entry.periode = entry.periode
      ? `${entry.periode}, ${namaBulan(r.bulan).slice(0, 3)} ${r.tahun}`
      : `${namaBulan(r.bulan)} ${r.tahun}`;
    petaKelompok.set(kunci, entry);
  }
  const kelompokList = [...petaKelompok.values()];

  // Pembayaran online otomatis (Midtrans) — tersedia juga untuk penghuni aktif
  // yang sudah lolos Pembayaran Awal, agar bulan berikutnya bisa dibayar online.
  const midtransTersedia = isMidtransConfigured();
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
            eq(transaksiOnline.tipe, "bayar_bulanan"),
            or(
              eq(transaksiOnline.statusMidtrans, "pending"),
              eq(transaksiOnline.statusMidtrans, "challenge")
            )
          )
        )
        .orderBy(desc(transaksiOnline.createdAt))
        .limit(1)
    : [];

  // Periode yang bisa dibayar online: berurutan dari tagihan terawal hingga
  // maksimum 6 bulan ke depan (paket 1/2/6 bulan, termasuk bayar di muka).
  const periodeOnline = midtransTersedia
    ? await daftarPeriodeBayarOnline(data.penghuniId, data.tglMasuk)
    : [];
  const tagihanOnline = periodeOnline.map((p) => ({
    key: kunciPeriode(p),
    label: `${namaBulan(p.bulan)} ${p.tahun}`,
    masaDepan: bandingkanPeriode(p, bulanIni) > 0,
  }));

  // Bagian pembayaran online ditampilkan bila masih ada periode yang bisa
  // dibayar, atau bila ada transaksi Midtrans yang perlu diselesaikan.
  const tampilkanMidtrans =
    midtransTersedia && (tagihanOnline.length > 0 || Boolean(transaksiGateway));

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <p className={eyebrowClass}>Portal Penghuni · Bayar Sewa</p>
        <h1 className={headingClass}>Bayar Sewa Bulanan</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
          Bayar tagihan sewa secara <em>online</em>. Pilih <strong>paket</strong>{" "}
          1, 2, atau 6 bulan (boleh bayar di muka) atau centang bulan tertentu,
          lalu bayar <strong>otomatis</strong> lewat Midtrans (Virtual
          Account/QRIS/E-Wallet/Transfer Bank) —{" "}
          <strong className="text-white/80">atau</strong> lampirkan{" "}
          <strong>bukti bayar</strong> agar diverifikasi pengelola.
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
            Pengajuan Anda sedang menunggu verifikasi pengelola. Bulan yang
            diajukan tidak dapat diubah sampai pengajuan dikonfirmasi/dibatalkan.
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

        <div className="mt-6 flex flex-col gap-6 border-t border-white/10 pt-6">
          {!data.idKamar || !data.hargaSewa ? (
            <p className="rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2.5 text-sm text-red-200">
              Kamar Anda belum ditetapkan oleh pengelola. Hubungi pengelola kos
              untuk melanjutkan.
            </p>
          ) : (
            <>
              {kelompokList.length > 0 ? (
                <section className="flex flex-col gap-3">
                  <h2 className="font-display text-lg font-bold tracking-tight text-white">
                    Pengajuan sedang diverifikasi pengelola
                  </h2>
                  {kelompokList.map((g) => (
                    <div
                      key={g.kelompok}
                      className="rounded-md border border-amber-400/30 bg-amber-400/10 px-4 py-3.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold leading-snug text-white">
                            {g.periode}
                          </p>
                          <p className="mt-1 font-mono text-[11px] leading-relaxed text-amber-200/80">
                            {g.jumlahBulan} bulan ·{" "}
                            {formatIDR.format(g.total)} · {g.metode} ·{" "}
                            {g.tanggalBayar
                              ? formatTanggal(g.tanggalBayar)
                              : "—"}
                          </p>
                        </div>
                        <form action={batalkanPengajuanBulanan}>
                          <input
                            type="hidden"
                            name="kelompok"
                            value={g.kelompok}
                          />
                          <button
                            type="submit"
                            className={btnSecondaryClass}
                          >
                            Batalkan Pengajuan
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </section>
              ) : null}

              {tagihanForm.length > 0 || tampilkanMidtrans ? (
                <div className="flex flex-col gap-6">
                  {tampilkanMidtrans ? (
                    <div className="flex flex-col gap-6">
                      <div className="flex flex-col gap-3">
                        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
                          Pembayaran Online Otomatis — Midtrans
                        </p>
                        <MidtransBulananCheckout
                          noKamar={data.noKamar ?? ""}
                          hargaSewa={data.hargaSewa}
                          tagihan={tagihanOnline}
                          snapClientKey={getMidtransClientKey()}
                          snapJsUrl={getMidtransSnapJsUrl()}
                          transaksiAktif={transaksiGateway ?? null}
                        />
                      </div>

                      {transaksiGateway || tagihanForm.length === 0 ? null : (
                        <div className="flex items-center gap-3" aria-hidden>
                          <span className="h-px flex-1 bg-white/10" />
                          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-white/35">
                            atau kirim bukti manual (diverifikasi pengelola)
                          </span>
                          <span className="h-px flex-1 bg-white/10" />
                        </div>
                      )}
                    </div>
                  ) : null}

                  {transaksiGateway || tagihanForm.length === 0 ? null : (
                    <BayarBulananForm
                      noKamar={data.noKamar ?? ""}
                      hargaSewa={data.hargaSewa}
                      tagihan={tagihanForm}
                    />
                  )}
                </div>
              ) : kelompokList.length === 0 ? (
                <div className="flex flex-col items-start gap-4 rounded-md border border-emerald-400/20 bg-emerald-400/5 px-4 py-5">
                  <div className="flex items-start gap-2.5">
                    <CalendarCheck2
                      aria-hidden
                      className="mt-0.5 size-5 shrink-0 text-emerald-300"
                    />
                    <div>
                      <p className="font-display text-lg font-bold tracking-tight text-white">
                        Tidak ada tagihan yang perlu dibayar
                      </p>
                      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-white/60">
                        Seluruh tagihan dari periode masuk Anda sampai bulan{" "}
                        <strong className="text-white/80">{labelBulanIni}</strong>{" "}
                        sudah Lunas. Tagihan baru otomatis muncul setiap awal
                        bulan berikutnya.
                      </p>
                    </div>
                  </div>
                  <Link href="/portal/riwayat" className={btnPrimaryClass}>
                    Lihat Riwayat Pembayaran
                  </Link>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
