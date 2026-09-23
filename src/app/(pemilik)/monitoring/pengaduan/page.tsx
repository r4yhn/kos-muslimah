import type { Metadata } from "next";
import { MessageSquareWarning } from "lucide-react";
import Link from "next/link";

import { PengaduanBadge } from "@/components/badges";
import { formatTanggal } from "@/lib/format";
import {
  LABEL_STATUS_PENGADUAN,
  STATUS_PENGADUAN,
  daftarPengaduan,
  isStatusPengaduan,
  ringkasanPengaduan,
  type StatusPengaduan,
} from "@/lib/pengaduan";
import {
  cardClass,
  cellClass,
  eyebrowClass,
  headingClass,
  tableHeadClass,
} from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pemantauan Pengaduan",
};

const formatWaktu = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Pemantauan pengaduan penghuni (read-only) untuk Pemilik Kos.
 *
 * Menampilkan **tabel pengaduan** lengkap dengan status penanganan
 * (`pending` / `diproses` / `selesai`), catatan verifikasi lapangan admin, dan
 * waktu penanganannya — sehingga Pemilik Kos dapat mengontrol kinerja pengelola
 * secara transparan dari luar kota tanpa bisa mengubah data.
 */
export default async function MonitoringPengaduanPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const sp = await searchParams;
  const statusParam = typeof sp.status === "string" ? sp.status : "";
  const filter: StatusPengaduan | undefined = isStatusPengaduan(statusParam)
    ? statusParam
    : undefined;

  const [daftar, rekap] = await Promise.all([
    daftarPengaduan({ status: filter }),
    ringkasanPengaduan(),
  ]);

  const pills = [
    { label: "Semua", href: "/monitoring/pengaduan", jumlah: rekap.total, aktif: !filter },
    ...STATUS_PENGADUAN.map((s) => ({
      label: LABEL_STATUS_PENGADUAN[s],
      href: `/monitoring/pengaduan?status=${s}`,
      jumlah: rekap[s],
      aktif: filter === s,
    })),
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      <section>
        <p className={eyebrowClass}>Pemantauan · Pengaduan</p>
        <h1 className={headingClass}>Pengaduan Penghuni</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
          Daftar kendala kamar yang dilaporkan penghuni beserta status
          penanganan dan catatan verifikasi lapangan pengelola. Pantau jumlah
          laporan yang masih <em>Pending</em> untuk menilai kecepatan tindak
          lanjut. Data hanya dapat dilihat (read-only).
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Total Laporan", nilai: rekap.total, kelas: "text-white" },
          { label: "Pending", nilai: rekap.pending, kelas: "text-amber-300" },
          { label: "Diproses", nilai: rekap.diproses, kelas: "text-sky-300" },
          { label: "Selesai", nilai: rekap.selesai, kelas: "text-emerald-300" },
        ].map((k) => (
          <article key={k.label} className={`${cardClass} p-4`}>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary/60">
              {k.label}
            </p>
            <p className={`mt-2 text-3xl font-bold leading-none tabular-nums ${k.kelas}`}>
              {k.nilai}
            </p>
          </article>
        ))}
      </section>

      <section className="flex flex-wrap items-center gap-2">
        {pills.map((p) => (
          <Link
            key={p.label}
            href={p.href}
            aria-current={p.aktif ? "page" : undefined}
            className={`inline-flex min-h-[40px] items-center gap-2 rounded-full border px-4 font-mono text-[11px] font-medium transition-all duration-[100ms] ease-brand ${
              p.aktif
                ? "border-primary bg-primary/15 text-primary"
                : "border-white/12 text-white/60 hover:border-primary/40 hover:text-white"
            }`}
          >
            {p.label}
            <span className="tabular-nums text-white/50">{p.jumlah}</span>
          </Link>
        ))}
      </section>

      <section className={`${cardClass} overflow-hidden`}>
        {daftar.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <MessageSquareWarning
              aria-hidden
              className="mx-auto size-8 text-white/30"
            />
            <p className="mt-4 font-display text-2xl font-bold tracking-tight text-white">
              Tidak ada pengaduan
              {filter ? ` berstatus ${LABEL_STATUS_PENGADUAN[filter]}` : ""}.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              Laporan kendala dari penghuni akan tampil di sini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.02]">
                <tr>
                  <th className={tableHeadClass}>Tgl Lapor</th>
                  <th className={tableHeadClass}>Penghuni</th>
                  <th className={tableHeadClass}>Deskripsi Kendala</th>
                  <th className={tableHeadClass}>Status</th>
                  <th className={tableHeadClass}>Catatan &amp; Waktu Penanganan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {daftar.map((p) => (
                  <tr key={p.idPengaduan} className="align-top">
                    <td
                      className={`${cellClass} whitespace-nowrap font-mono text-xs tabular-nums text-white/60`}
                    >
                      {formatTanggal(p.tanggalLapor)}
                    </td>
                    <td className={`${cellClass} leading-relaxed text-white/80`}>
                      <span className="font-bold text-white">{p.namaPenghuni}</span>
                      <span className="mt-0.5 block font-mono text-[10px] leading-tight text-white/45">
                        Kamar {p.noKamar ?? "—"}
                      </span>
                    </td>
                    <td className={`${cellClass} max-w-md leading-relaxed text-white/75`}>
                      {p.deskripsiKendala}
                    </td>
                    <td className={cellClass}>
                      <PengaduanBadge
                        status={p.statusPenyelesaian}
                        label={LABEL_STATUS_PENGADUAN[p.statusPenyelesaian]}
                      />
                    </td>
                    <td className={`${cellClass} max-w-sm leading-relaxed text-white/60`}>
                      {p.catatanAdmin ?? (
                        <span className="font-mono text-[11px] text-white/30">
                          belum ada catatan penanganan
                        </span>
                      )}
                      {p.ditanganiPada ? (
                        <span className="mt-1 block font-mono text-[10px] leading-tight text-primary/70">
                          diperbarui {formatWaktu.format(p.ditanganiPada)}
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
