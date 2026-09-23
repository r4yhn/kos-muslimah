import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { ArrowRight, DoorOpen, MessageSquareWarning, Users, Wallet } from "lucide-react";
import Link from "next/link";

import { PengaduanBadge } from "@/components/badges";
import { db } from "@/db";
import { kamar, pembayaran, penghuni } from "@/db/schema";
import { NAMA_BULAN, formatIDR, formatTanggal } from "@/lib/format";
import { ringkasanMonitoring } from "@/lib/monitoring";
import {
  LABEL_STATUS_PENGADUAN,
  daftarPengaduan,
} from "@/lib/pengaduan";
import {
  btnSecondaryClass,
  cardClass,
  cellClass,
  eyebrowClass,
  headingClass,
  tableHeadClass,
} from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ringkasan Monitoring",
};

/** Pembayaran terbaru (5 baris) untuk pemantauan cepat pemilik kos. */
async function pembayaranTerbaru() {
  return db
    .select({
      id: pembayaran.id,
      tanggalBayar: pembayaran.tanggalBayar,
      bulan: pembayaran.bulan,
      tahun: pembayaran.tahun,
      jumlahBayar: pembayaran.jumlahBayar,
      metodeBayar: pembayaran.metodeBayar,
      statusBayar: pembayaran.statusBayar,
      namaPenghuni: penghuni.nama,
      kamarNo: kamar.noKamar,
    })
    .from(pembayaran)
    .innerJoin(penghuni, eq(penghuni.id, pembayaran.idPenghuni))
    .leftJoin(kamar, eq(kamar.id, penghuni.idKamar))
    .orderBy(desc(pembayaran.createdAt))
    .limit(5);
}

/**
 * Dashboard pemantauan Pemilik Kos (read-only).
 *
 * Menampilkan ringkasan total kamar & kamar terisi, jumlah penghuni,
 * pendapatan/pembayaran bulan berjalan + akumulasi tahun, serta status
 * pengaduan penghuni — tanpa aksi ubah data dan tanpa menerbitkan tagihan
 * (lihat catatan di `lib/monitoring.ts`).
 */
export default async function MonitoringRingkasanPage() {
  const [d, pengaduanTerbaru, bayarTerbaru] = await Promise.all([
    ringkasanMonitoring(),
    daftarPengaduan({ limit: 5 }),
    pembayaranTerbaru(),
  ]);

  const bulanLabel = `${NAMA_BULAN[d.bulan - 1]} ${d.tahun}`;
  const rasioPenghuni =
    d.penghuniTotal > 0
      ? Math.round((d.penghuniAktif / d.penghuniTotal) * 100)
      : 0;

  const kartu = [
    {
      kunci: "kamar",
      judul: "Total Kamar",
      ikon: DoorOpen,
      nilai: d.totalKamar,
      keterangan: `${d.okupansi}% terisi · ${d.kamarTersedia} tersedia`,
    },
    {
      kunci: "penghuni",
      judul: "Penghuni Aktif",
      ikon: Users,
      nilai: d.penghuniAktif,
      keterangan: `${rasioPenghuni}% dari ${d.penghuniTotal} terdaftar`,
    },
    {
      kunci: "pendapatan",
      judul: "Pendapatan Bulan Ini",
      ikon: Wallet,
      nilai: formatIDR.format(d.pendapatanBulan),
      keterangan: `${d.pendapatanBulanJumlah} pembayaran lunas · ${bulanLabel}`,
      kecil: true,
    },
    {
      kunci: "pengaduan",
      judul: "Pengaduan Aktif",
      ikon: MessageSquareWarning,
      nilai: d.pengaduan.pending + d.pengaduan.diproses,
      keterangan: `${d.pengaduan.pending} pending · ${d.pengaduan.diproses} diproses`,
    },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={eyebrowClass}>Pemantauan · Pemilik Kos</p>
          <h1 className={headingClass}>Ringkasan Kos</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
            Pantau kondisi kos dari mana saja: hunian kamar, jumlah penghuni,
            arus pendapatan sewa, laporan keuangan, dan penanganan pengaduan
            penghuni — semuanya hanya-baca tanpa risiko mengubah data.
          </p>
        </div>
        <Link href="/monitoring/laporan" className={btnSecondaryClass}>
          Buka Laporan Keuangan
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kartu.map((k) => (
          <article key={k.kunci} className={`${cardClass} animate-rise p-5`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary/80">
                {k.judul}
              </h2>
              <k.ikon aria-hidden className="size-4 text-primary/60" />
            </div>
            <p
              className={`mt-3 font-bold leading-none tabular-nums text-white ${
                k.kecil ? "text-2xl" : "text-4xl"
              }`}
            >
              {k.nilai}
            </p>
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-white/50">
              {k.keterangan}
            </p>
          </article>
        ))}
      </section>

      {/* Keuangan ringkas periode berjalan */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-red-300/80">
            Piutang Tagihan · {bulanLabel}
          </p>
          <p className="mt-2 text-2xl font-bold leading-none tabular-nums text-red-200">
            {formatIDR.format(d.piutangBulan)}
          </p>
          <p className="mt-2 font-mono text-[11px] text-white/45">
            {d.piutangBulanJumlah} tagihan belum lunas
          </p>
        </article>
        <article className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-4">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-amber-300/80">
            Menunggu Konfirmasi
          </p>
          <p className="mt-2 text-2xl font-bold leading-none tabular-nums text-amber-200">
            {formatIDR.format(d.menungguBulan)}
          </p>
          <p className="mt-2 font-mono text-[11px] text-white/45">
            {d.menungguBulanJumlah} pengajuan perlu dicek pengelola
          </p>
        </article>
        <article className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-300/80">
            Pendapatan Tahun {d.tahun}
          </p>
          <p className="mt-2 text-2xl font-bold leading-none tabular-nums text-emerald-200">
            {formatIDR.format(d.pendapatanTahun)}
          </p>
          <p className="mt-2 font-mono text-[11px] text-white/45">
            Akumulasi pembayaran lunas
          </p>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Pengaduan terbaru */}
        <article className={`${cardClass} overflow-hidden`}>
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <h2 className="font-display text-lg font-bold tracking-tight text-white">
              Pengaduan Terbaru
            </h2>
            <Link
              href="/monitoring/pengaduan"
              className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-primary transition-colors duration-[100ms] ease-brand hover:text-primary/80"
            >
              Lihat semua
            </Link>
          </header>
          {pengaduanTerbaru.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm leading-relaxed text-white/45">
              Belum ada pengaduan dari penghuni.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {pengaduanTerbaru.map((p) => (
                <li key={p.idPengaduan} className="flex flex-col gap-2 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-bold leading-tight text-white">
                      {p.namaPenghuni}{" "}
                      <span className="font-mono text-xs font-medium text-white/45">
                        · Kamar {p.noKamar ?? "—"}
                      </span>
                    </p>
                    <PengaduanBadge
                      status={p.statusPenyelesaian}
                      label={LABEL_STATUS_PENGADUAN[p.statusPenyelesaian]}
                    />
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-white/60">
                    {p.deskripsiKendala}
                  </p>
                  <p className="font-mono text-[10px] leading-tight text-white/35">
                    Dilaporkan {formatTanggal(p.tanggalLapor)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>

        {/* Pembayaran terbaru */}
        <article className={`${cardClass} overflow-hidden`}>
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <h2 className="font-display text-lg font-bold tracking-tight text-white">
              Pembayaran Terbaru
            </h2>
            <Link
              href="/monitoring/pembayaran"
              className="font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-primary transition-colors duration-[100ms] ease-brand hover:text-primary/80"
            >
              Lihat semua
            </Link>
          </header>
          {bayarTerbaru.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm leading-relaxed text-white/45">
              Belum ada catatan pembayaran.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.02]">
                  <tr>
                    <th className={tableHeadClass}>Penghuni</th>
                    <th className={tableHeadClass}>Periode</th>
                    <th className={tableHeadClass}>Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {bayarTerbaru.map((b) => (
                    <tr key={b.id}>
                      <td className={`${cellClass} leading-relaxed text-white/80`}>
                        {b.namaPenghuni}
                        <span className="mt-0.5 block font-mono text-[10px] leading-tight text-white/40">
                          Kamar {b.kamarNo ?? "—"} ·{" "}
                          {formatTanggal(b.tanggalBayar)}
                        </span>
                      </td>
                      <td
                        className={`${cellClass} whitespace-nowrap font-mono text-xs text-white/60`}
                      >
                        {NAMA_BULAN[b.bulan - 1]} {b.tahun}
                      </td>
                      <td
                        className={`${cellClass} whitespace-nowrap font-mono text-xs tabular-nums text-white/80`}
                      >
                        {formatIDR.format(b.jumlahBayar)}
                        <span
                          className={`mt-0.5 block text-[10px] leading-tight ${
                            b.statusBayar === "Lunas"
                              ? "text-emerald-300"
                              : b.statusBayar === "Menunggu Konfirmasi"
                                ? "text-amber-300"
                                : "text-red-300"
                          }`}
                        >
                          {b.statusBayar}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
