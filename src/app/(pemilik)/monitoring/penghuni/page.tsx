import type { Metadata } from "next";
import { count, eq, ilike, or } from "drizzle-orm";
import { Search, Users } from "lucide-react";

import { PenghuniBadge } from "@/components/badges";
import { db } from "@/db";
import { kamar, pembayaran, penghuni } from "@/db/schema";
import { formatTanggal } from "@/lib/format";
import {
  btnSecondaryClass,
  cardClass,
  cellClass,
  eyebrowClass,
  headingClass,
  inputClass,
  tableHeadClass,
} from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pemantauan Penghuni",
};

/**
 * Pemantauan data penghuni (read-only) untuk Pemilik Kos: identitas, kamar yang
 * ditempati, tanggal masuk, status keanggotaan, dan jumlah riwayat pembayaran.
 */
export default async function MonitoringPenghuniPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const where = q
    ? or(ilike(penghuni.nama, `%${q}%`), ilike(kamar.noKamar, `%${q}%`))
    : undefined;

  const [daftar, kelompokRiwayat] = await Promise.all([
    db
      .select({
        id: penghuni.id,
        nama: penghuni.nama,
        jenisKelamin: penghuni.jenisKelamin,
        noHp: penghuni.noHp,
        tglMasuk: penghuni.tglMasuk,
        status: penghuni.status,
        perluBayarAwal: penghuni.perluBayarAwal,
        kamarNo: kamar.noKamar,
      })
      .from(penghuni)
      .leftJoin(kamar, eq(kamar.id, penghuni.idKamar))
      .where(where)
      .orderBy(penghuni.nama),
    db
      .select({ idPenghuni: pembayaran.idPenghuni, total: count() })
      .from(pembayaran)
      .groupBy(pembayaran.idPenghuni),
  ]);

  const riwayatPerPenghuni = new Map(
    kelompokRiwayat.map((r) => [r.idPenghuni, r.total])
  );

  const jumlahAktif = daftar.filter((p) => p.status === "Aktif").length;
  const jumlahMenungguAwal = daftar.filter((p) => p.perluBayarAwal).length;

  return (
    <div className="flex w-full flex-col gap-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={eyebrowClass}>Pemantauan · Penghuni</p>
          <h1 className={headingClass}>Data Penghuni</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
            Daftar seluruh penghuni kos beserta kamar dan status keanggotaannya.
            {q ? ` Hasil pencarian untuk “${q}”.` : ""} Data hanya dapat dilihat
            (read-only).
          </p>
        </div>
        <form method="get" action="/monitoring/penghuni" className="flex items-center gap-2">
          <label className="sr-only" htmlFor="q">
            Cari penghuni
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Cari nama / no. kamar…"
            className={`${inputClass} max-w-[220px]`}
          />
          <button type="submit" aria-label="Cari" className={btnSecondaryClass}>
            <Search className="size-4" aria-hidden />
            <span className="hidden sm:inline">Cari</span>
          </button>
        </form>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 font-mono text-[11px] font-medium text-primary">
          {daftar.length} penghuni
        </span>
        <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 font-mono text-[11px] font-medium text-emerald-300">
          {jumlahAktif} aktif
        </span>
        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[11px] font-medium text-white/60">
          {daftar.length - jumlahAktif} keluar
        </span>
        {jumlahMenungguAwal > 0 ? (
          <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 font-mono text-[11px] font-medium text-amber-300">
            {jumlahMenungguAwal} menunggu pembayaran awal
          </span>
        ) : null}
      </section>

      <section className={`${cardClass} overflow-hidden`}>
        {daftar.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Users aria-hidden className="mx-auto size-8 text-white/30" />
            <p className="mt-4 font-display text-2xl font-bold tracking-tight text-white">
              {q ? "Penghuni tidak ditemukan." : "Belum ada data penghuni."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.02]">
                <tr>
                  <th className={tableHeadClass}>Nama</th>
                  <th className={tableHeadClass}>Jenis Kelamin</th>
                  <th className={tableHeadClass}>No. HP</th>
                  <th className={tableHeadClass}>Kamar</th>
                  <th className={tableHeadClass}>Masuk Sejak</th>
                  <th className={tableHeadClass}>Pembayaran</th>
                  <th className={tableHeadClass}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {daftar.map((p) => (
                  <tr key={p.id} className="align-top">
                    <td className={`${cellClass} font-bold leading-relaxed text-white`}>
                      {p.nama}
                      {p.perluBayarAwal ? (
                        <span className="mt-1 block font-mono text-[10px] font-medium leading-tight text-amber-300">
                          menunggu pembayaran awal
                        </span>
                      ) : null}
                    </td>
                    <td className={`${cellClass} leading-relaxed text-white/60`}>
                      {p.jenisKelamin}
                    </td>
                    <td
                      className={`${cellClass} whitespace-nowrap font-mono text-xs text-white/60`}
                    >
                      {p.noHp}
                    </td>
                    <td className={`${cellClass} font-mono text-xs text-white/70`}>
                      {p.kamarNo ?? "—"}
                    </td>
                    <td
                      className={`${cellClass} whitespace-nowrap font-mono text-xs tabular-nums text-white/60`}
                    >
                      {formatTanggal(p.tglMasuk, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td
                      className={`${cellClass} font-mono text-xs tabular-nums text-white/60`}
                    >
                      {riwayatPerPenghuni.get(p.id) ?? 0} catatan
                    </td>
                    <td className={cellClass}>
                      <PenghuniBadge status={p.status} />
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
