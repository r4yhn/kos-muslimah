import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { DoorOpen } from "lucide-react";

import { KamarBadge } from "@/components/badges";
import { db } from "@/db";
import { kamar, penghuni } from "@/db/schema";
import { formatIDR } from "@/lib/format";
import { KAPASITAS_KAMAR, labelPenghuniKamar } from "@/lib/kapasitas-kamar";
import {
  cardClass,
  cellClass,
  eyebrowClass,
  headingClass,
  tableHeadClass,
} from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pemantauan Kamar",
};

/**
 * Pemantauan data kamar (read-only) untuk Pemilik Kos: status tiap kamar,
 * harga sewa, dan siapa saja penghuni yang menempatinya.
 */
export default async function MonitoringKamarPage() {
  const [daftarKamar, daftarPenghuniAktif] = await Promise.all([
    db.select().from(kamar).orderBy(kamar.noKamar),
    db
      .select({
        idKamar: penghuni.idKamar,
        nama: penghuni.nama,
        perluBayarAwal: penghuni.perluBayarAwal,
      })
      .from(penghuni)
      .where(eq(penghuni.status, "Aktif")),
  ]);

  const penghuniPerKamar = new Map<
    string,
    { nama: string; menungguBayarAwal: boolean }[]
  >();
  for (const p of daftarPenghuniAktif) {
    if (!p.idKamar) continue;
    const list = penghuniPerKamar.get(p.idKamar) ?? [];
    list.push({ nama: p.nama, menungguBayarAwal: p.perluBayarAwal });
    penghuniPerKamar.set(p.idKamar, list);
  }

  const jumlahStatus = (status: string) =>
    daftarKamar.filter((k) => k.statusKamar === status).length;

  const total = daftarKamar.length;
  const terisi = jumlahStatus("Terisi");

  const ringkasan = [
    { label: "Total Kamar", nilai: total, kelas: "text-white" },
    {
      label: "Tersedia",
      nilai: jumlahStatus("Tersedia"),
      kelas: "text-emerald-300",
    },
    { label: "Terisi", nilai: terisi, kelas: "text-sky-300" },
    {
      label: "Perbaikan",
      nilai: jumlahStatus("Perbaikan"),
      kelas: "text-amber-300",
    },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      <section>
        <p className={eyebrowClass}>Pemantauan · Kamar</p>
        <h1 className={headingClass}>Kondisi Kamar</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
          Ringkasan status seluruh kamar kos beserta penghuni yang menempatinya.
          Tingkat hunian saat ini{" "}
          <span className="font-mono text-primary">
            {total > 0 ? Math.round((terisi / total) * 100) : 0}%
          </span>{" "}
          ({terisi} dari {total} kamar). Data hanya dapat dilihat (read-only).
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {ringkasan.map((r) => (
          <article key={r.label} className={`${cardClass} p-4`}>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary/60">
              {r.label}
            </p>
            <p
              className={`mt-2 text-3xl font-bold leading-none tabular-nums ${r.kelas}`}
            >
              {r.nilai}
            </p>
          </article>
        ))}
      </section>

      <section className="animate-rise overflow-hidden rounded-xl border border-primary/20 bg-surface shadow-card">
        {daftarKamar.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <DoorOpen aria-hidden className="mx-auto size-8 text-white/30" />
            <p className="mt-4 font-display text-2xl font-bold tracking-tight text-white">
              Belum ada data kamar.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.02]">
                <tr>
                  <th className={tableHeadClass}>No. Kamar</th>
                  <th className={tableHeadClass}>Tipe</th>
                  <th className={tableHeadClass}>Harga Sewa</th>
                  <th className={tableHeadClass}>Status</th>
                  <th className={tableHeadClass}>Penghuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {daftarKamar.map((k) => {
                  const daftarNama = penghuniPerKamar.get(k.id) ?? [];
                  return (
                    <tr key={k.id} className="align-top">
                      <td className={`${cellClass} font-mono font-bold text-white`}>
                        {k.noKamar}
                      </td>
                      <td className={`${cellClass} leading-relaxed text-white/70`}>
                        {k.tipeKamar}
                      </td>
                      <td
                        className={`${cellClass} whitespace-nowrap font-mono text-xs tabular-nums text-white/70`}
                      >
                        {formatIDR.format(k.hargaSewa)}
                      </td>
                      <td className={cellClass}>
                        <KamarBadge status={k.statusKamar} />
                      </td>
                      <td className={`${cellClass} leading-relaxed text-white/70`}>
                        {daftarNama.length === 0 ? (
                          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/30">
                            {labelPenghuniKamar(0)} — kosong
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">
                              {daftarNama.length}/{KAPASITAS_KAMAR} slot
                            </span>
                            <ul className="flex flex-col gap-1.5">
                              {daftarNama.map((o) => (
                                <li
                                  key={o.nama}
                                  className="flex flex-wrap items-center gap-1.5"
                                >
                                  <span>{o.nama}</span>
                                  {o.menungguBayarAwal ? (
                                    <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] font-medium leading-none text-amber-300">
                                      menunggu bayar awal
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
