import type { Metadata } from "next";
import { and, eq, type SQL } from "drizzle-orm";
import { FileDown, ReceiptText } from "lucide-react";

import { BayarBadge, StatusDot } from "@/components/badges";
import { FilterForm } from "@/components/filter-form";
import { db } from "@/db";
import { kamar, pembayaran, penghuni } from "@/db/schema";
import {
  NAMA_BULAN,
  daftarTahun,
  formatIDR,
  formatTanggal,
} from "@/lib/format";
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
  title: "Pemantauan Pembayaran",
};

const STATUS_FILTER_VALID = ["Lunas", "Menunggu Konfirmasi", "Belum Lunas"];

/**
 * Pemantauan pembayaran & pendapatan (read-only) untuk Pemilik Kos.
 *
 * Menampilkan daftar transaksi sewa sesuai filter periode/status beserta rekap
 * pendapatan lunas dan piutangnya. Halaman ini **tidak** menerbitkan tagihan
 * otomatis (itu tugas panel pengelola saat halaman dibuka atau lewat cron),
 * sehingga membuka pemantauan tidak mengubah data apa pun.
 */
export default async function MonitoringPembayaranPage({
  searchParams,
}: {
  searchParams: Promise<{
    bulan?: string | string[];
    tahun?: string | string[];
    status?: string | string[];
  }>;
}) {
  const sp = await searchParams;
  const sekarang = new Date();

  const bulanParam = typeof sp.bulan === "string" ? sp.bulan.trim() : "";
  const tahunParam = typeof sp.tahun === "string" ? sp.tahun.trim() : "";
  const statusParam =
    typeof sp.status === "string" && STATUS_FILTER_VALID.includes(sp.status)
      ? sp.status
      : "";

  // Default tampilan: periode berjalan.
  const bulan =
    bulanParam || (!("bulan" in sp) ? String(sekarang.getMonth() + 1) : "");
  const tahun =
    tahunParam || (!("tahun" in sp) ? String(sekarang.getFullYear()) : "");

  const kondisi: SQL[] = [];
  if (bulan) kondisi.push(eq(pembayaran.bulan, Number(bulan)));
  if (tahun) kondisi.push(eq(pembayaran.tahun, Number(tahun)));
  if (statusParam) {
    kondisi.push(
      eq(
        pembayaran.statusBayar,
        statusParam as "Lunas" | "Menunggu Konfirmasi" | "Belum Lunas"
      )
    );
  }

  const daftar = await db
    .select({
      id: pembayaran.id,
      tanggalBayar: pembayaran.tanggalBayar,
      jatuhTempo: pembayaran.jatuhTempo,
      bulan: pembayaran.bulan,
      tahun: pembayaran.tahun,
      jumlahBayar: pembayaran.jumlahBayar,
      metodeBayar: pembayaran.metodeBayar,
      statusBayar: pembayaran.statusBayar,
      keterangan: pembayaran.keterangan,
      namaPenghuni: penghuni.nama,
      kamarNo: kamar.noKamar,
    })
    .from(pembayaran)
    .innerJoin(penghuni, eq(penghuni.id, pembayaran.idPenghuni))
    .leftJoin(kamar, eq(kamar.id, penghuni.idKamar))
    .where(kondisi.length > 0 ? and(...kondisi) : undefined)
    .orderBy(pembayaran.tahun, pembayaran.bulan, pembayaran.tanggalBayar);

  const totalLunas = daftar
    .filter((r) => r.statusBayar === "Lunas")
    .reduce((acc, r) => acc + r.jumlahBayar, 0);
  const totalPiutang = daftar
    .filter((r) => r.statusBayar === "Belum Lunas")
    .reduce((acc, r) => acc + r.jumlahBayar, 0);
  const totalMenunggu = daftar
    .filter((r) => r.statusBayar === "Menunggu Konfirmasi")
    .reduce((acc, r) => acc + r.jumlahBayar, 0);

  const periodeLabel = bulan
    ? `${NAMA_BULAN[Number(bulan) - 1]} ${tahun}`.trim()
    : tahun
      ? `Tahun ${tahun}`
      : "Semua Periode";

  const exportParams = new URLSearchParams();
  if (bulan) exportParams.set("bulan", bulan);
  if (tahun) exportParams.set("tahun", tahun);
  if (statusParam) exportParams.set("status", statusParam);
  const exportQuery = exportParams.toString();

  return (
    <div className="flex w-full flex-col gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={eyebrowClass}>Pemantauan · Pembayaran</p>
          <h1 className={headingClass}>Pembayaran &amp; Pendapatan</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
            Riwayat pembayaran sewa periode{" "}
            <span className="font-mono text-primary">{periodeLabel}</span>{" "}
            beserta statusnya (Lunas / Menunggu Konfirmasi / Belum Lunas). Data
            hanya dapat dilihat (read-only).
          </p>
        </div>
        <a
          href={`/api/laporan/pembayaran${exportQuery ? `?${exportQuery}` : ""}`}
          className={btnSecondaryClass}
        >
          <FileDown className="size-4" aria-hidden />
          Export PDF
        </a>
      </section>

      <section className={`${cardClass} p-4`}>
        <FilterForm
          action="/monitoring/pembayaran"
          className="flex flex-wrap items-end gap-3"
        >
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Bulan</span>
            <select
              key={`bulan-${bulan}`}
              name="bulan"
              defaultValue={bulan}
              className={selectClass}
            >
              <option value="">Semua</option>
              {NAMA_BULAN.map((nama, index) => (
                <option key={nama} value={index + 1}>
                  {nama}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Tahun</span>
            <select
              key={`tahun-${tahun}`}
              name="tahun"
              defaultValue={tahun}
              className={selectClass}
            >
              <option value="">Semua</option>
              {daftarTahun(sekarang.getFullYear() - 3).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Status</span>
            <select
              key={`status-${statusParam}`}
              name="status"
              defaultValue={statusParam}
              className={selectClass}
            >
              <option value="">Semua</option>
              {STATUS_FILTER_VALID.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </FilterForm>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Lunas",
            nilai: totalLunas,
            kelas:
              "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
          },
          {
            label: "Menunggu Konfirmasi",
            nilai: totalMenunggu,
            kelas: "border-amber-400/30 bg-amber-400/10 text-amber-300",
          },
          {
            label: "Belum Lunas",
            nilai: totalPiutang,
            kelas: "border-red-400/40 bg-red-400/10 text-red-300",
          },
        ].map((k) => (
          <article
            key={k.label}
            className="rounded-xl border border-primary/20 bg-surface p-4 shadow-card"
          >
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium leading-none ${k.kelas}`}
            >
              <StatusDot />
              {k.label}
            </span>
            <p className="mt-3 text-2xl font-bold leading-none tabular-nums text-white">
              {formatIDR.format(k.nilai)}
            </p>
          </article>
        ))}
      </section>

      <section className={`${cardClass} overflow-hidden`}>
        {daftar.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ReceiptText aria-hidden className="mx-auto size-8 text-white/30" />
            <p className="mt-4 font-display text-2xl font-bold tracking-tight text-white">
              Tidak ada pembayaran pada periode ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.02]">
                <tr>
                  <th className={tableHeadClass}>Tanggal</th>
                  <th className={tableHeadClass}>Penghuni</th>
                  <th className={tableHeadClass}>Kamar</th>
                  <th className={tableHeadClass}>Periode</th>
                  <th className={tableHeadClass}>Jumlah</th>
                  <th className={tableHeadClass}>Metode</th>
                  <th className={tableHeadClass}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {daftar.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td
                      className={`${cellClass} whitespace-nowrap font-mono text-xs tabular-nums text-white/60`}
                    >
                      {formatTanggal(r.tanggalBayar)}
                    </td>
                    <td className={`${cellClass} font-bold leading-relaxed text-white`}>
                      {r.namaPenghuni}
                    </td>
                    <td className={`${cellClass} font-mono text-xs text-white/60`}>
                      {r.kamarNo ?? "—"}
                    </td>
                    <td
                      className={`${cellClass} whitespace-nowrap font-mono text-xs text-white/60`}
                    >
                      {NAMA_BULAN[r.bulan - 1]} {r.tahun}
                    </td>
                    <td
                      className={`${cellClass} whitespace-nowrap font-mono text-xs tabular-nums text-white/80`}
                    >
                      {formatIDR.format(r.jumlahBayar)}
                    </td>
                    <td className={`${cellClass} leading-relaxed text-white/60`}>
                      {r.metodeBayar?.trim() ? r.metodeBayar : "—"}
                    </td>
                    <td className={cellClass}>
                      <BayarBadge status={r.statusBayar} />
                      {r.statusBayar === "Belum Lunas" && r.jatuhTempo ? (
                        <span className="mt-1.5 block font-mono text-[10px] leading-tight text-red-300">
                          jatuh tempo {formatTanggal(r.jatuhTempo)}
                        </span>
                      ) : null}
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
