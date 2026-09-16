import { count, eq, ilike, or } from "drizzle-orm";
import { LogOut, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ConfirmForm } from "@/components/confirm-form";
import { PenghuniBadge } from "@/components/badges";
import { db } from "@/db";
import { kamar, pembayaran, penghuni } from "@/db/schema";
import { formatTanggal } from "@/lib/format";
import {
  btnDangerIconGhostClass,
  btnIconGhostClass,
  btnPrimaryClass,
  btnSecondaryClass,
  cellClass,
  eyebrowClass,
  headingClass,
  inputClass,
  tableHeadClass,
} from "@/lib/ui";
import { hapusPenghuni, keluarkanPenghuni } from "./actions";

export const dynamic = "force-dynamic";

export default async function PenghuniPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const where = q
    ? or(
        ilike(penghuni.nama, `%${q}%`),
        ilike(kamar.noKamar, `%${q}%`)
      )
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
        idKamar: penghuni.idKamar,
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
  const jumlahMenungguBayarAwal = daftar.filter((p) => p.perluBayarAwal).length;
  const jumlahKeluar = daftar.length - jumlahAktif;

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Judul & aksi */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={eyebrowClass}>Kelola · Penghuni</p>
          <h1 className={headingClass}>Data Penghuni</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
            Daftarkan penghuni baru, alihkan kamar, atau tandai penghuni yang
            telah keluar.{" "}
            {q ? `Hasil pencarian untuk “${q}”.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <form method="get" action="/penghuni" className="flex items-center gap-2">
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
          <Link href="/penghuni/tambah" className={btnPrimaryClass}>
            <Plus className="size-4" aria-hidden />
            Daftarkan Penghuni
          </Link>
        </div>
      </section>

      {/* Ringkasan hasil */}
      <section className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 font-mono text-[11px] font-medium text-primary">
          {daftar.length} penghuni
        </span>
        <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 font-mono text-[11px] font-medium text-emerald-300">
          {jumlahAktif} aktif
        </span>
        {jumlahMenungguBayarAwal > 0 ? (
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 font-mono text-[11px] font-medium text-amber-300">
            {jumlahMenungguBayarAwal} menunggu bayar awal
          </span>
        ) : null}
        <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[11px] font-medium text-white/50">
          {jumlahKeluar} keluar
        </span>
      </section>

      {/* Tabel penghuni */}
      <section className="animate-rise overflow-hidden rounded-xl border border-primary/20 bg-surface shadow-card">
        {daftar.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-display text-2xl font-bold tracking-tight text-white">
              {q ? "Tidak ada hasil pencarian." : "Belum ada penghuni."}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              {q
                ? `Tidak ditemukan penghuni dengan kata kunci “${q}”.`
                : "Mulai dengan mendaftarkan penghuni baru."}
            </p>
            <Link
              href={q ? "/penghuni" : "/penghuni/tambah"}
              className={`${q ? btnSecondaryClass : btnPrimaryClass} mt-6`}
            >
              {q ? "Reset Pencarian" : "Daftarkan Penghuni"}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className={tableHeadClass}>Penghuni</th>
                  <th className={`${tableHeadClass} hidden md:table-cell`}>
                    No. HP
                  </th>
                  <th className={tableHeadClass}>Kamar</th>
                  <th className={`${tableHeadClass} hidden sm:table-cell`}>
                    Masuk Sejak
                  </th>
                  <th className={tableHeadClass}>Status</th>
                  <th className={`${tableHeadClass} text-right`}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {daftar.map((p) => (
                  <tr
                    key={p.id}
                    className="transition-colors duration-[100ms] ease-brand hover:bg-white/[0.03]"
                  >
                    <td className={cellClass}>
                      <p className="font-bold leading-tight text-white">
                        {p.nama}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] leading-tight text-white/40">
                        {p.jenisKelamin}
                      </p>
                    </td>
                    <td className={`${cellClass} hidden font-mono text-xs text-white/60 md:table-cell`}>
                      {p.noHp}
                    </td>
                    <td className={`${cellClass} font-mono text-xs text-white/70`}>
                      {p.kamarNo ?? "—"}
                    </td>
                    <td className={`${cellClass} hidden text-white/60 sm:table-cell`}>
                      {formatTanggal(p.tglMasuk)}
                    </td>
                    <td className={cellClass}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PenghuniBadge status={p.status} />
                        {p.perluBayarAwal ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 font-mono text-[11px] font-medium leading-none text-amber-300">
                            <span
                              aria-hidden
                              className="size-1.5 shrink-0 rounded-full bg-current"
                            />
                            Menunggu Bayar Awal
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className={`${cellClass} text-right`}>
                      <div className="flex items-center justify-end gap-1.5">
                        {p.status === "Aktif" ? (
                          <ConfirmForm
                            action={keluarkanPenghuni}
                            confirmMessage={`Tandai "${p.nama}" telah keluar? Kamar ${p.kamarNo ?? ""} akan otomatis tersedia kembali.`}
                          >
                            <input type="hidden" name="id" value={p.id} />
                            <button
                              type="submit"
                              title="Tandai keluar"
                              aria-label={`Tandai ${p.nama} keluar`}
                              className={btnIconGhostClass}
                            >
                              <LogOut className="size-4" aria-hidden />
                            </button>
                          </ConfirmForm>
                        ) : null}
                        <Link
                          href={`/penghuni/${p.id}/edit`}
                          title="Edit penghuni"
                          aria-label={`Edit penghuni ${p.nama}`}
                          className={btnIconGhostClass}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Link>
                        {riwayatPerPenghuni.has(p.id) ? (
                          <span title="Memiliki riwayat pembayaran — tidak dapat dihapus">
                            <button
                              type="button"
                              disabled
                              aria-disabled="true"
                              aria-label={`Hapus penghuni ${p.nama}`}
                              className={btnDangerIconGhostClass}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          </span>
                        ) : (
                          <ConfirmForm
                            action={hapusPenghuni}
                            confirmMessage={`Hapus data "${p.nama}"? Tindakan ini tidak dapat dibatalkan.`}
                          >
                            <input type="hidden" name="id" value={p.id} />
                            <button
                              type="submit"
                              title="Hapus penghuni"
                              aria-label={`Hapus penghuni ${p.nama}`}
                              className={btnDangerIconGhostClass}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </button>
                          </ConfirmForm>
                        )}
                      </div>
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

