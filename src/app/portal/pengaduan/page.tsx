import type { Metadata } from "next";
import { MessageSquareWarning } from "lucide-react";
import { redirect } from "next/navigation";

import { PengaduanBadge } from "@/components/badges";
import { formatTanggal } from "@/lib/format";
import {
  LABEL_STATUS_PENGADUAN,
  daftarPengaduanPenghuni,
  type StatusPengaduan,
} from "@/lib/pengaduan";
import { getPortalData } from "@/lib/portal";
import {
  cardClass,
  cellClass,
  eyebrowClass,
  headingClass,
  tableHeadClass,
} from "@/lib/ui";
import { PengaduanForm } from "./pengaduan-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pengaduan",
};

/**
 * Modul "Pengaduan & Laporan Kendala" dari sisi penghuni: kirim kendala kamar
 * (status awal `pending`) dan pantau status penanganannya oleh pengelola
 * (`pending` → `diproses` → `selesai`).
 */
export default async function PortalPengaduanPage() {
  const data = await getPortalData();
  if (!data) redirect("/dashboard");
  if (data.terkunci) redirect("/portal/bayar-awal");

  const daftar = await daftarPengaduanPenghuni(data.penghuniId);

  const jumlah = (status: StatusPengaduan) =>
    daftar.filter((p) => p.statusPenyelesaian === status).length;

  const ringkasan = [
    {
      status: "pending" as StatusPengaduan,
      kelas: "border-amber-400/25 bg-amber-400/10 text-amber-300",
    },
    {
      status: "diproses" as StatusPengaduan,
      kelas: "border-sky-400/25 bg-sky-400/10 text-sky-300",
    },
    {
      status: "selesai" as StatusPengaduan,
      kelas: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
    },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <p className={eyebrowClass}>Portal Penghuni</p>
        <h1 className={headingClass}>Pengaduan &amp; Laporan Kendala</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
          Laporkan kendala kamar{" "}
          {data.noKamar ? (
            <span className="font-mono text-primary">{data.noKamar}</span>
          ) : null}{" "}
          kepada pengelola kos. Setiap laporan diverifikasi langsung di lapangan
          dan status penanganannya dapat Anda pantau di halaman ini.
        </p>
      </div>

      {/* Ringkasan status laporan penghuni */}
      <section className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 font-mono text-[11px] font-medium text-primary">
          {daftar.length} laporan
        </span>
        {ringkasan.map((r) => (
          <span
            key={r.status}
            className={`rounded-full border px-3 py-1 font-mono text-[11px] font-medium ${r.kelas}`}
          >
            {jumlah(r.status)} {LABEL_STATUS_PENGADUAN[r.status]}
          </span>
        ))}
      </section>

      {/* Form kirim kendala */}
      <section className={`${cardClass} p-5 sm:p-6`}>
        <h2 className="font-display text-xl font-bold tracking-tight text-white">
          Laporkan Kendala Baru
        </h2>
        <p className="mt-2 mb-5 max-w-2xl text-sm leading-relaxed text-white/60">
          Laporan Anda akan diterima pengelola beserta notifikasi otomatis untuk
          ditindaklanjuti.
        </p>
        <PengaduanForm />
      </section>

      {/* Daftar laporan milik penghuni */}
      <section className="animate-rise overflow-hidden rounded-xl border border-primary/20 bg-surface shadow-card">
        {daftar.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <MessageSquareWarning
              aria-hidden
              className="mx-auto size-8 text-white/30"
            />
            <p className="mt-4 font-display text-2xl font-bold tracking-tight text-white">
              Belum ada pengaduan.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              Gunakan form di atas bila ada kendala pada kamar Anda — mis. air,
              listrik, kunci, atau fasilitas kamar lainnya.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.02]">
                <tr>
                  <th className={tableHeadClass}>Tanggal Lapor</th>
                  <th className={tableHeadClass}>Deskripsi Kendala</th>
                  <th className={tableHeadClass}>Status</th>
                  <th className={tableHeadClass}>Catatan Pengelola</th>
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
                    <td className={`${cellClass} max-w-md leading-relaxed text-white/80`}>
                      {p.deskripsiKendala}
                    </td>
                    <td className={cellClass}>
                      <PengaduanBadge
                        status={p.statusPenyelesaian}
                        label={LABEL_STATUS_PENGADUAN[p.statusPenyelesaian]}
                      />
                    </td>
                    <td className={`${cellClass} max-w-xs leading-relaxed text-white/55`}>
                      {p.catatanAdmin ?? (
                        <span className="font-mono text-[11px] text-white/30">
                          belum ada catatan
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
