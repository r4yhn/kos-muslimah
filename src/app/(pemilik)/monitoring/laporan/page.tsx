import type { Metadata } from "next";
import { FileDown } from "lucide-react";

import { FilterForm } from "@/components/filter-form";
import { NAMA_BULAN, daftarTahun, formatIDR, formatTanggal } from "@/lib/format";
import {
  bulanLaporan,
  rekapKeuangan,
  tahunLaporan,
} from "@/lib/keuangan";
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

export const metadata: Metadata = {
  title: "Pemantauan Laporan Keuangan",
};

/**
 * Laporan keuangan (read-only) untuk Pemilik Kos.
 *
 * Sumber angka sama dengan panel pengelola: helper `rekapKeuangan`
 * (`lib/keuangan.ts`, tabel `pembayaran`). Pemilik dapat memfilter tahun dan
 * rentang bulan, lalu mengunduh PDF dengan filter yang sama.
 */
export default async function MonitoringLaporanPage({
  searchParams,
}: {
  searchParams: Promise<{
    tahun?: string | string[];
    dari?: string | string[];
    sampai?: string | string[];
  }>;
}) {
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

  const kartu = [
    {
      label: "Pendapatan Lunas",
      nilai: formatIDR.format(ringkasan.lunasNominal),
      keterangan: `${ringkasan.lunasJumlah} pembayaran diterima`,
      kelas: "text-emerald-200",
    },
    {
      label: "Piutang Tagihan",
      nilai: formatIDR.format(ringkasan.tunggakanNominal),
      keterangan: `${ringkasan.tunggakanJumlah} tagihan belum lunas`,
      kelas: "text-red-200",
    },
    {
      label: "Lewat Jatuh Tempo",
      nilai: formatIDR.format(ringkasan.terlambatNominal),
      keterangan: `${ringkasan.terlambatJumlah} tagihan menunggak`,
      kelas: "text-amber-200",
    },
    {
      label: "Rata-rata / Bulan",
      nilai: formatIDR.format(rataPerBulan),
      keterangan: `${rekap.penghuniAktif} penghuni aktif`,
      kelas: "text-white",
    },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={eyebrowClass}>Pemantauan · Keuangan</p>
          <h1 className={headingClass}>Laporan Keuangan</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
            Rekapitulasi pendapatan sewa yang sudah diterima, piutang tagihan,
            dan tunggakan per penghuni pada periode{" "}
            <span className="font-mono text-primary">{rekap.labelPeriode}</span>.
            Data hanya dapat dilihat (read-only).
          </p>
        </div>
        <a href={exportHref} className={btnSecondaryClass}>
          <FileDown className="size-4" aria-hidden />
          Export PDF Laporan
        </a>
      </section>

      <section className={`${cardClass} p-4`}>
        <FilterForm
          action="/monitoring/laporan"
          className="flex flex-wrap items-end gap-3"
        >
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
        </FilterForm>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kartu.map((k) => (
          <article key={k.label} className={`${cardClass} p-4`}>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary/60">
              {k.label}
            </p>
            <p
              className={`mt-2 text-2xl font-bold leading-none tabular-nums ${k.kelas}`}
            >
              {k.nilai}
            </p>
            <p className="mt-2 font-mono text-[11px] leading-relaxed text-white/45">
              {k.keterangan}
            </p>
          </article>
        ))}
      </section>

      {/* Rekap per bulan */}
      <section className={`${cardClass} overflow-hidden`}>
        <header className="border-b border-white/10 px-5 py-4">
          <h2 className="font-display text-lg font-bold tracking-tight text-white">
            Rekap per Bulan — {rekap.labelPeriode}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-white/45">
            Batang menunjukkan proporsi pendapatan lunas tiap bulan terhadap
            bulan terbaik pada periode ini.
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <th className={tableHeadClass}>Bulan</th>
                <th className={tableHeadClass}>Transaksi</th>
                <th className={tableHeadClass}>Lunas</th>
                <th className={tableHeadClass}>Belum Lunas</th>
                <th className={tableHeadClass}>Total Tercatat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rekap.perBulan.map((b) => (
                <tr key={b.bulan}>
                  <td className={`${cellClass} font-bold text-white`}>{b.label}</td>
                  <td className={`${cellClass} font-mono text-xs tabular-nums text-white/60`}>
                    {b.transaksi}
                  </td>
                  <td className={`${cellClass} align-top`}>
                    <span className="font-mono text-xs font-bold tabular-nums text-emerald-300">
                      {formatIDR.format(b.lunasNominal)}
                    </span>
                    <span className="mt-1 block h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
                      <span
                        className="block h-full rounded-full bg-primary"
                        style={{
                          width: `${
                            maxLunas > 0
                              ? Math.round((b.lunasNominal / maxLunas) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </span>
                    <span className="mt-1 block font-mono text-[10px] text-white/40">
                      {b.lunasJumlah}×
                    </span>
                  </td>
                  <td className={`${cellClass} align-top`}>
                    <span className="font-mono text-xs tabular-nums text-red-200/80">
                      {formatIDR.format(b.belumNominal)}
                    </span>
                    <span className="mt-1 block font-mono text-[10px] text-white/40">
                      {b.belumJumlah}×
                    </span>
                  </td>
                  <td
                    className={`${cellClass} font-mono text-xs tabular-nums text-white/70`}
                  >
                    {formatIDR.format(b.totalNominal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Pendapatan per metode bayar */}
        <article className={`${cardClass} overflow-hidden`}>
          <header className="border-b border-white/10 px-5 py-4">
            <h2 className="font-display text-lg font-bold tracking-tight text-white">
              Pendapatan per Metode Bayar
            </h2>
          </header>
          {rekap.perMetode.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm leading-relaxed text-white/45">
              Belum ada pendapatan lunas pada periode ini.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {rekap.perMetode.map((m) => (
                <li
                  key={m.metode}
                  className="flex items-center justify-between gap-3 px-5 py-3.5"
                >
                  <span className="leading-relaxed text-white/75">{m.metode}</span>
                  <span className="font-mono text-xs tabular-nums text-white/60">
                    {m.transaksi}× ·{" "}
                    <span className="font-bold text-white">
                      {formatIDR.format(m.nominal)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        {/* Tunggakan per penghuni */}
        <article className={`${cardClass} overflow-hidden`}>
          <header className="border-b border-white/10 px-5 py-4">
            <h2 className="font-display text-lg font-bold tracking-tight text-white">
              Tunggakan per Penghuni
            </h2>
          </header>
          {rekap.tunggakan.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm leading-relaxed text-white/45">
              Tidak ada tunggakan pada periode ini. 🎉
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {rekap.tunggakan.slice(0, 10).map((t) => (
                <li key={t.idPenghuni} className="flex flex-col gap-1 px-5 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold leading-tight text-white">
                      {t.nama}{" "}
                      <span className="font-mono text-xs font-medium text-white/45">
                        · Kamar {t.kamarNo ?? "—"}
                      </span>
                    </span>
                    <span className="font-mono text-xs font-bold tabular-nums text-red-200">
                      {formatIDR.format(t.nominal)}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] leading-tight text-white/40">
                    {t.jumlahTagihan} tagihan
                    {t.jatuhTempoTerawal
                      ? ` · jatuh tempo terawal ${formatTanggal(t.jatuhTempoTerawal)}`
                      : ""}
                    {t.terlambat ? " · lewat jatuh tempo" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}
