import { eq } from "drizzle-orm";
import { FileDown, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ConfirmForm } from "@/components/confirm-form";
import { KamarBadge } from "@/components/badges";
import { db } from "@/db";
import { kamar, penghuni } from "@/db/schema";
import { formatIDR } from "@/lib/format";
import { KAPASITAS_KAMAR, labelPenghuniKamar } from "@/lib/kapasitas-kamar";
import {
  btnDangerIconGhostClass,
  btnIconGhostClass,
  btnPrimaryClass,
  btnSecondaryClass,
  cellClass,
  eyebrowClass,
  headingClass,
  tableHeadClass,
} from "@/lib/ui";
import { hapusKamar } from "./actions";

export const dynamic = "force-dynamic";

export default async function KamarPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [daftarKamar, daftarPenghuniAktif] = await Promise.all([
    db.select().from(kamar).orderBy(kamar.noKamar),
    db
      .select({
        id: penghuni.id,
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

  const ringkasan = [
    { label: "Total Kamar", nilai: daftarKamar.length },
    { label: "Tersedia", nilai: jumlahStatus("Tersedia") },
    { label: "Terisi", nilai: jumlahStatus("Terisi") },
    { label: "Perbaikan", nilai: jumlahStatus("Perbaikan") },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Judul & aksi */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={eyebrowClass}>Kelola · Kamar</p>
          <h1 className={headingClass}>Data Kamar</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
            Kelola daftar kamar kos. Status kamar terisi/tersedia diperbarui
            otomatis saat penghuni mendaftar atau keluar. Setiap kamar dapat
            dihuni maksimal {KAPASITAS_KAMAR} penghuni (masing-masing berakun
            portal sendiri) — kolom penghuni menampilkan jumlah slot terpakai.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href="/api/laporan/status-kamar" className={btnSecondaryClass}>
            <FileDown className="size-4" aria-hidden />
            Export PDF Status Kamar
          </a>
          <Link href="/kamar/tambah" className={btnPrimaryClass}>
            <Plus className="size-4" aria-hidden />
            Tambah Kamar
          </Link>
        </div>
      </section>

      {/* Ringkasan */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {ringkasan.map((r) => (
          <article
            key={r.label}
            className="animate-rise rounded-xl border border-primary/20 bg-surface p-4 shadow-card"
          >
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary/70">
              {r.label}
            </p>
            <p className="mt-2 text-3xl font-bold leading-none tabular-nums text-white">
              {r.nilai}
            </p>
          </article>
        ))}
      </section>

      {/* Tabel kamar */}
      <section className="animate-rise overflow-hidden rounded-xl border border-primary/20 bg-surface shadow-card">
        {daftarKamar.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-display text-2xl font-bold tracking-tight text-white">
              Belum ada kamar terdaftar.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              Mulai dengan menambahkan kamar pertama kos Anda.
            </p>
            <Link href="/kamar/tambah" className={`${btnPrimaryClass} mt-6`}>
              <Plus className="size-4" aria-hidden />
              Tambah Kamar
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className={tableHeadClass}>No. Kamar</th>
                  <th className={tableHeadClass}>Tipe</th>
                  <th className={`${tableHeadClass} hidden md:table-cell`}>
                    Harga Sewa
                  </th>
                  <th className={tableHeadClass}>Status</th>
                  <th className={`${tableHeadClass} hidden sm:table-cell`}>
                    Penghuni
                  </th>
                  <th className={`${tableHeadClass} text-right`}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {daftarKamar.map((k) => {
                  const daftarNama = penghuniPerKamar.get(k.id) ?? [];
                  return (
                    <tr
                      key={k.id}
                      className="transition-colors duration-[100ms] ease-brand hover:bg-white/[0.03]"
                    >
                      <td className={`${cellClass} font-mono text-xs font-bold text-white`}>
                        {k.noKamar}
                      </td>
                      <td className={`${cellClass} text-white/70`}>
                        {k.tipeKamar}
                      </td>
                      <td className={`${cellClass} hidden font-mono text-xs tabular-nums text-white/60 md:table-cell`}>
                        {formatIDR.format(k.hargaSewa)}
                      </td>
                      <td className={cellClass}>
                        <KamarBadge status={k.statusKamar} />
                      </td>
                      <td className={`${cellClass} hidden text-white/60 sm:table-cell`}>
                        {daftarNama.length > 0 ? (
                          <div className="flex flex-col gap-1.5">
                            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-white/40">
                              {labelPenghuniKamar(daftarNama.length)} penghuni
                              {daftarNama.length >= KAPASITAS_KAMAR
                                ? " · penuh"
                                : ""}
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
                        ) : (
                          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/30">
                            {labelPenghuniKamar(0)} — kosong
                          </span>
                        )}
                      </td>
                      <td className={`${cellClass} text-right`}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/kamar/${k.id}/edit`}
                            aria-label={`Edit kamar ${k.noKamar}`}
                            title="Edit kamar"
                            className={btnIconGhostClass}
                          >
                            <Pencil className="size-4" aria-hidden />
                          </Link>
                          {daftarNama.length === 0 ? (
                            <ConfirmForm
                              action={hapusKamar}
                              confirmMessage={`Hapus kamar "${k.noKamar}"? Tindakan ini tidak dapat dibatalkan.`}
                            >
                              <input type="hidden" name="id" value={k.id} />
                              <button
                                type="submit"
                                aria-label={`Hapus kamar ${k.noKamar}`}
                                title="Hapus kamar"
                                className={btnDangerIconGhostClass}
                              >
                                <Trash2 className="size-4" aria-hidden />
                              </button>
                            </ConfirmForm>
                          ) : (
                            <span title="Kamar terisi penghuni — tidak dapat dihapus">
                              <button
                                type="button"
                                disabled
                                aria-disabled="true"
                                aria-label={`Hapus kamar ${k.noKamar}`}
                                className={btnDangerIconGhostClass}
                              >
                                <Trash2 className="size-4" aria-hidden />
                              </button>
                            </span>
                          )}
                        </div>
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
