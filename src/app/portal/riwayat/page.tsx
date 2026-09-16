import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { ReceiptText } from "lucide-react";
import { redirect } from "next/navigation";

import { BayarBadge } from "@/components/badges";
import { db } from "@/db";
import { pembayaran } from "@/db/schema";
import { formatIDR, formatTanggal, namaBulan } from "@/lib/format";
import { cardClass, cellClass, eyebrowClass, headingClass, tableHeadClass } from "@/lib/ui";
import { getPortalData } from "@/lib/portal";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Riwayat Pembayaran",
};

/** Riwayat pembayaran sewa milik penghuni yang sedang login. */
export default async function PortalRiwayatPage() {
  const data = await getPortalData();
  if (!data) redirect("/dashboard");
  if (data.terkunci) redirect("/portal/bayar-awal");

  const daftar = await db
    .select({
      id: pembayaran.id,
      tanggalBayar: pembayaran.tanggalBayar,
      bulan: pembayaran.bulan,
      tahun: pembayaran.tahun,
      jumlahBayar: pembayaran.jumlahBayar,
      metodeBayar: pembayaran.metodeBayar,
      statusBayar: pembayaran.statusBayar,
      keterangan: pembayaran.keterangan,
    })
    .from(pembayaran)
    .where(eq(pembayaran.idPenghuni, data.penghuniId))
    .orderBy(desc(pembayaran.tahun), desc(pembayaran.bulan));

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <p className={eyebrowClass}>Portal Penghuni</p>
        <h1 className={headingClass}>Riwayat Pembayaran</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
          Seluruh catatan pembayaran sewa bulanan atas nama {data.nama}.
        </p>
      </div>

      <section className="animate-rise overflow-hidden rounded-xl border border-primary/20 bg-surface shadow-card">
        {daftar.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ReceiptText aria-hidden className="mx-auto size-8 text-white/30" />
            <p className="mt-4 font-display text-2xl font-bold tracking-tight text-white">
              Belum ada riwayat pembayaran.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              Riwayat akan muncul setelah Anda atau pengelola mencatat
              pembayaran sewa. Tagihan bulanan dapat dibayar lewat menu{" "}
              <em>Bayar Sewa</em> di portal ini.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className={tableHeadClass}>Periode</th>
                  <th className={`${tableHeadClass} hidden sm:table-cell`}>
                    Tanggal Bayar
                  </th>
                  <th className={tableHeadClass}>Nominal</th>
                  <th className={`${tableHeadClass} hidden md:table-cell`}>
                    Metode
                  </th>
                  <th className={tableHeadClass}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {daftar.map((row) => (
                  <tr
                    key={row.id}
                    className="transition-colors duration-[100ms] ease-brand hover:bg-white/[0.03]"
                  >
                    <td className={`${cellClass} font-bold text-white`}>
                      {namaBulan(row.bulan)} {row.tahun}
                      {row.keterangan ? (
                        <span className="block text-xs font-normal text-white/40">
                          {row.keterangan}
                        </span>
                      ) : null}
                    </td>
                    <td className={`${cellClass} hidden text-white/60 sm:table-cell`}>
                      {formatTanggal(row.tanggalBayar)}
                    </td>
                    <td className={`${cellClass} font-mono text-xs tabular-nums text-white/80`}>
                      {formatIDR.format(row.jumlahBayar)}
                    </td>
                    <td className={`${cellClass} hidden text-white/60 md:table-cell`}>
                      {row.statusBayar === "Belum Lunas" ? "—" : row.metodeBayar}
                    </td>
                    <td className={cellClass}>
                      <BayarBadge status={row.statusBayar} />
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
