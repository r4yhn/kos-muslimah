import { AlertTriangle, ChartColumn, FileDown, Wallet } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { FilterForm } from "@/components/filter-form";
import { NAMA_BULAN, daftarTahun, formatIDR, formatTanggal } from "@/lib/format";
import {
  bulanLaporan,
  rekapKeuangan,
  tahunLaporan,
  type RekapBulanKeuangan,
} from "@/lib/keuangan";
import { sinkronTagihanSemuaPenghuni } from "@/lib/tagihan";
import {
  btnSecondaryClass,
  cardClass,
  cellClass,
  eyebrowClass,
  headingClass,
  labelClass,
  selectClass,
  tableHeadClass,
} from "@/lib/ui";

export const dynamic = "force-dynamic";

/**
 * Laporan Keuangan (panel admin) — rekap pendapatan sewa, piutang, dan
 * tunggakan per penghuni untuk satu tahun dengan rentang bulan yang bisa
 * dipilih (bulanan, kuartalan, atau setahun penuh).
 *
 * Sumber angka: `lib/keuangan.ts` (tabel `pembayaran`); export PDF memakai
 * data & filter yang sama lewat `/api/laporan/keuangan`.
 */
export default async function LaporanKeuanganPage({
  searchParams,
}: {
  searchParams: Promise<{
    tahun?: string | string[];
    dari?: string | string[];
    sampai?: string | string[];
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Terbitkan tagihan bulan berjalan yang belum ada (idempotent) supaya angka
  // piutang/tunggakan pada laporan selalu akurat.
  await sinkronTagihanSemuaPenghuni();

  const sp = await searchParams;
  const tahun = tahunLaporan(sp.tahun, new Date().getFullYear());
  const dari = bulanLaporan(sp.dari, 1);
  const sampai = Math.max(dari, bulanLaporan(sp.sampai, 12));

  const rekap = await rekapKeuangan({ tahun, dari, sampai });
  const { ringkasan } = rekap;

  const exportHref = `/api/laporan/keuangan?tahun=${tahun}&dari=${dari}&sampai=${sampai}`;
  const bulanCount = rekap.perBulan.length;
  const rataPerBulan =
    bulanCount > 0 ? Math.round(ringkasan.lunasNominal / bulanCount) : 0;
  const maxLunas = rekap.perBulan.reduce(
    (acc, b) => Math.max(acc, b.lunasNominal),
    0
  );
  // Rasio piutang terhadap pendapatan periode (null bila belum ada pendapatan).
  const rasioPiutang =
    ringkasan.lunasNominal > 0
      ? Math.round((ringkasan.tunggakanNominal / ringkasan.lunasNominal) * 100)
      : null;
  const bulanTerbaik = rekap.perBulan.reduce<RekapBulanKeuangan | null>(
    (acc, b) => (b.lunasNominal > (acc?.lunasNominal ?? 0) ? b : acc),
    null
  );

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Judul & aksi */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={eyebrowClass}>Pelaporan · Keuangan</p>
          <h1 className={headingClass}>Laporan Keuangan</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
            Rekapitulasi pendapatan sewa yang sudah diterima (Lunas), piutang
            tagihan, pengajuan yang menunggu konfirmasi, dan tunggakan per
            penghuni pada periode{" "}
            <span className="font-mono text-primary">{rekap.labelPeriode}</span>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href={exportHref} className={btnSecondaryClass}>
            <FileDown className="size-4" aria-hidden />
            Export PDF Laporan
          </a>
          <Link href="/pembayaran" className={btnSecondaryClass}>
            <Wallet className="size-4" aria-hidden />
            Buka Pembayaran
          </Link>
        </div>
      </section>

      {/* Filter periode */}
      <section className={`${cardClass} p-4`}>
        <FilterForm action="/laporan" className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Tahun</span>
            <select
              key={`tahun-${tahun}`}
              name="tahun"
              defaultValue={tahun}
              className={selectClass}
            >
              {daftarTahun(tahun - 2).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Dari Bulan</span>
            <select
              key={`dari-${dari}`}
              name="dari"
              defaultValue={dari}
              className={selectClass}
            >
              {NAMA_BULAN.map((nama, index) => (
                <option key={nama} value={index + 1}>
                  {nama}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Sampai Bulan</span>
            <select
              key={`sampai-${sampai}`}
              name="sampai"
              defaultValue={sampai}
              className={selectClass}
            >
              {NAMA_BULAN.map((nama, index) => (
                <option key={nama} value={index + 1}>
                  {nama}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={btnSecondaryClass}>
            Terapkan Filter
          </button>
          <Link href="/laporan" className={btnSecondaryClass}>
            Reset
          </Link>
        </FilterForm>
        <p className="mt-3 text-xs leading-relaxed text-white/45">
          Filter berlaku otomatis begitu pilihan diubah — tombol{" "}
          <span className="text-white/70">Terapkan Filter</span> hanya untuk
          mengirim ulang nilai yang sedang aktif, dan{" "}
          <span className="text-white/70">Reset</span> mengembalikan ke periode
          default (tahun berjalan, Januari – Desember). Pilih bulan yang sama
          (mis. September – September) untuk laporan bulanan.
        </p>
      </section>

      {/* Ringkasan keuangan */}
      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <article className={`${cardClass} p-4`}>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-300/80">
            Pendapatan · Lunas
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-white">
            {formatIDR.format(ringkasan.lunasNominal)}
          </p>
          <p className="mt-1 font-mono text-[11px] tabular-nums text-white/50">
            {ringkasan.lunasJumlah} transaksi diterima
          </p>
        </article>

        <article className={`${cardClass} p-4`}>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-red-300/80">
            Piutang · Belum Lunas
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-white">
            {formatIDR.format(ringkasan.belumNominal)}
          </p>
          <p className="mt-1 font-mono text-[11px] tabular-nums text-white/50">
            {ringkasan.belumJumlah} tagihan
            {ringkasan.terlambatJumlah > 0
              ? ` · ${formatIDR.format(ringkasan.terlambatNominal)} lewat tempo`
              : ""}
          </p>
        </article>

        <article className={`${cardClass} p-4`}>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-amber-300/80">
            Menunggu Konfirmasi
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-white">
            {formatIDR.format(ringkasan.menungguNominal)}
          </p>
          <p className="mt-1 font-mono text-[11px] tabular-nums text-white/50">
            {ringkasan.menungguJumlah} pengajuan bukti bayar
          </p>
        </article>

        <article className={`${cardClass} p-4`}>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary/70">
            Rata-rata per Bulan
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-white">
            {formatIDR.format(rataPerBulan)}
          </p>
          <p className="mt-1 font-mono text-[11px] tabular-nums text-white/50">
            {bulanCount} bulan · {rekap.penghuniAktif} penghuni aktif
          </p>
        </article>
      </section>

      {/* Rekap pendapatan per bulan */}
      <section className={`${cardClass} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-white">
              Rekap Pendapatan per Bulan
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-white/60">
              Hanya transaksi <span className="text-emerald-300">Lunas</span>{" "}
              yang dihitung sebagai pendapatan; tagihan Belum Lunas & pengajuan
              Menunggu Konfirmasi ditampilkan terpisah.
            </p>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary/70">
            {rekap.labelPeriode}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-white/[0.03]">
              <tr className="border-b border-white/10">
                <th className={tableHeadClass}>Bulan</th>
                <th className={tableHeadClass}>Transaksi</th>
                <th className={tableHeadClass}>Pendapatan (Lunas)</th>
                <th className={tableHeadClass}>Belum Lunas</th>
                <th className={tableHeadClass}>Menunggu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rekap.perBulan.map((b) => {
                const porsi =
                  maxLunas > 0
                    ? Math.round((b.lunasNominal / maxLunas) * 100)
                    : 0;
                return (
                  <tr
                    key={b.bulan}
                    className="transition-colors duration-[100ms] ease-brand hover:bg-white/[0.03]"
                  >
                    <td className={`${cellClass} font-bold text-white`}>
                      {b.label}
                    </td>
                    <td
                      className={`${cellClass} font-mono text-xs tabular-nums text-white/60`}
                    >
                      {b.transaksi}
                    </td>
                    <td className={cellClass}>
                      <span className="block font-mono text-xs tabular-nums text-emerald-200">
                        {formatIDR.format(b.lunasNominal)}
                      </span>
                      {b.lunasJumlah > 0 ? (
                        <>
                          <span className="mt-1.5 block h-1.5 w-full max-w-[180px] overflow-hidden rounded-full bg-white/10">
                            <span
                              className="block h-full rounded-full bg-primary"
                              style={{ width: `${porsi}%` }}
                            />
                          </span>
                          <span className="mt-1 block font-mono text-[10px] text-white/40">
                            {b.lunasJumlah} transaksi · {porsi}% dari bulan
                            tertinggi
                          </span>
                        </>
                      ) : (
                        <span className="mt-1 block font-mono text-[10px] text-white/30">
                          Belum ada pembayaran lunas
                        </span>
                      )}
                    </td>
                    <td
                      className={`${cellClass} font-mono text-xs tabular-nums ${
                        b.belumNominal > 0 ? "text-red-300" : "text-white/25"
                      }`}
                    >
                      {b.belumNominal > 0
                        ? formatIDR.format(b.belumNominal)
                        : "—"}
                      {b.belumJumlah > 0 ? (
                        <span className="mt-1 block font-mono text-[10px] text-white/40">
                          {b.belumJumlah} tagihan
                        </span>
                      ) : null}
                    </td>
                    <td
                      className={`${cellClass} font-mono text-xs tabular-nums ${
                        b.menungguNominal > 0
                          ? "text-amber-200/90"
                          : "text-white/25"
                      }`}
                    >
                      {b.menungguNominal > 0
                        ? formatIDR.format(b.menungguNominal)
                        : "—"}
                      {b.menungguJumlah > 0 ? (
                        <span className="mt-1 block font-mono text-[10px] text-white/40">
                          {b.menungguJumlah} pengajuan
                        </span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/15 bg-white/[0.03]">
                <td className={`${cellClass} font-bold text-white`}>Total</td>
                <td
                  className={`${cellClass} font-mono text-xs tabular-nums text-white/60`}
                >
                  {ringkasan.transaksi}
                </td>
                <td
                  className={`${cellClass} font-mono text-xs font-bold tabular-nums text-emerald-200`}
                >
                  {formatIDR.format(ringkasan.lunasNominal)}
                </td>
                <td
                  className={`${cellClass} font-mono text-xs font-bold tabular-nums text-red-300`}
                >
                  {formatIDR.format(ringkasan.belumNominal)}
                </td>
                <td
                  className={`${cellClass} font-mono text-xs font-bold tabular-nums text-amber-200/90`}
                >
                  {formatIDR.format(ringkasan.menungguNominal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="border-t border-white/10 px-5 py-3 text-xs leading-relaxed text-white/45">
          Nilai tercatat seluruh status (Lunas + Belum Lunas + Menunggu):{" "}
          <span className="font-mono text-white/70">
            {formatIDR.format(ringkasan.totalNominal)}
          </span>
        </p>
      </section>

      {/* Pendapatan per metode + highlight piutang */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className={`${cardClass} overflow-hidden`}>
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="font-display text-xl font-bold tracking-tight text-white">
              Pendapatan per Metode Bayar
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-white/60">
              Rekap pembayaran ber-status Lunas pada periode ini.
            </p>
          </div>
          {rekap.perMetode.length === 0 ? (
            <p className="px-5 py-6 text-sm leading-relaxed text-white/50">
              Belum ada pembayaran Lunas pada periode ini.
            </p>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-white/[0.03]">
                <tr className="border-b border-white/10">
                  <th className={tableHeadClass}>Metode</th>
                  <th className={tableHeadClass}>Transaksi</th>
                  <th className={`${tableHeadClass} text-right`}>Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rekap.perMetode.map((m) => {
                  const porsi =
                    ringkasan.lunasNominal > 0
                      ? Math.round((m.nominal / ringkasan.lunasNominal) * 100)
                      : 0;
                  return (
                    <tr key={m.metode}>
                      <td className={`${cellClass} font-bold text-white`}>
                        {m.metode}
                      </td>
                      <td
                        className={`${cellClass} font-mono text-xs tabular-nums text-white/60`}
                      >
                        {m.transaksi}
                      </td>
                      <td
                        className={`${cellClass} text-right font-mono text-xs tabular-nums text-emerald-200`}
                      >
                        {formatIDR.format(m.nominal)}
                        <span className="mt-1 block font-mono text-[10px] text-white/40">
                          {porsi}% dari pendapatan
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className={`${cardClass} flex flex-col gap-4 p-5`}>
          <div className="flex items-start gap-2.5">
            <ChartColumn aria-hidden className="mt-1 size-4 shrink-0 text-primary" />
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-white">
                Sorotan Keuangan
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-white/60">
                Indikator cepat atas pendapatan dan piutang periode{" "}
                {rekap.labelPeriode}.
              </p>
            </div>
          </div>

          <dl className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-3">
              <dt className="text-sm text-white/60">Bulan pendapatan tertinggi</dt>
              <dd className="text-right font-mono text-xs tabular-nums text-white">
                {bulanTerbaik && bulanTerbaik.lunasNominal > 0
                  ? `${bulanTerbaik.label} · ${formatIDR.format(
                      bulanTerbaik.lunasNominal
                    )}`
                  : "—"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-3">
              <dt className="text-sm text-white/60">
                Rasio piutang terhadap pendapatan
              </dt>
              <dd className="text-right font-mono text-xs tabular-nums text-white">
                {rasioPiutang === null ? "—" : `${rasioPiutang}%`}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-3">
              <dt className="text-sm text-white/60">Tagihan lewat jatuh tempo</dt>
              <dd className="text-right font-mono text-xs tabular-nums text-red-300">
                {ringkasan.terlambatJumlah} tagihan ·{" "}
                {formatIDR.format(ringkasan.terlambatNominal)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-white/60">
                Penghuni dengan tunggakan
              </dt>
              <dd className="text-right font-mono text-xs tabular-nums text-white">
                {rekap.tunggakan.length} orang
              </dd>
            </div>
          </dl>

          <p className="mt-auto text-xs leading-relaxed text-white/45">
            Pendapatan dihitung dari catatan ber-status Lunas (termasuk
            pembayaran online Midtrans yang sudah settlement). Pengajuan
            Menunggu Konfirmasi belum masuk pendapatan sampai diverifikasi di
            halaman Pembayaran.
          </p>
        </div>
      </section>

      {/* Tunggakan per penghuni */}
      <section className={`${cardClass} overflow-hidden`}>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              aria-hidden
              className="mt-1 size-4 shrink-0 text-red-300"
            />
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-white">
                Tunggakan per Penghuni ({rekap.tunggakan.length})
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-white/60">
                Daftar tagihan ber-status Belum Lunas pada periode ini, diurutkan
                dari nominal terbesar. Tagihan bulan berjalan ikut terhitung
                meski belum jatuh tempo.
              </p>
            </div>
          </div>
          <Link
            href="/pembayaran?bulan=&tahun=&status=Belum%20Lunas"
            className={btnSecondaryClass}
          >
            Tindak Lanjut di Pembayaran
          </Link>
        </div>

        {rekap.tunggakan.length === 0 ? (
          <p className="px-5 py-6 text-sm leading-relaxed text-white/50">
            Tidak ada tunggakan pada periode ini. 🎉
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="bg-white/[0.03]">
                <tr className="border-b border-white/10">
                  <th className={tableHeadClass}>#</th>
                  <th className={tableHeadClass}>Penghuni</th>
                  <th className={tableHeadClass}>Kamar</th>
                  <th className={tableHeadClass}>Tagihan</th>
                  <th className={tableHeadClass}>Nominal</th>
                  <th className={tableHeadClass}>Jatuh Tempo</th>
                  <th className={tableHeadClass}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rekap.tunggakan.map((t, i) => (
                  <tr
                    key={t.idPenghuni}
                    className="transition-colors duration-[100ms] ease-brand hover:bg-white/[0.03]"
                  >
                    <td
                      className={`${cellClass} font-mono text-xs tabular-nums text-white/40`}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td className={`${cellClass} font-bold text-white`}>
                      {t.nama}
                    </td>
                    <td
                      className={`${cellClass} font-mono text-xs text-white/60`}
                    >
                      {t.kamarNo ?? "—"}
                    </td>
                    <td
                      className={`${cellClass} font-mono text-xs tabular-nums text-white/60`}
                    >
                      {t.jumlahTagihan} bulan
                    </td>
                    <td
                      className={`${cellClass} font-mono text-xs tabular-nums text-red-300`}
                    >
                      {formatIDR.format(t.nominal)}
                    </td>
                    <td className={`${cellClass} text-white/60`}>
                      {t.jatuhTempoTerawal
                        ? formatTanggal(t.jatuhTempoTerawal)
                        : "—"}
                    </td>
                    <td className={cellClass}>
                      {t.terlambat ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-400/10 px-2.5 py-1 font-mono text-[11px] font-medium leading-none text-red-300">
                          <span
                            aria-hidden
                            className="size-1.5 shrink-0 rounded-full bg-current"
                          />
                          Lewat jatuh tempo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 font-mono text-[11px] font-medium leading-none text-amber-300">
                          <span
                            aria-hidden
                            className="size-1.5 shrink-0 rounded-full bg-current"
                          />
                          Belum jatuh tempo
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
