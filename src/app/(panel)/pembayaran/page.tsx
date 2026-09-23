import { and, desc, eq, isNotNull, type SQL } from "drizzle-orm";
import {
  ChartColumn,
  FileDown,
  Hourglass,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BayarBadge } from "@/components/badges";
import { ConfirmForm } from "@/components/confirm-form";
import { FilterForm } from "@/components/filter-form";
import { db } from "@/db";
import { kamar, pembayaran, penghuni } from "@/db/schema";
import { sinkronTagihanSemuaPenghuni, sudahTerlambat } from "@/lib/tagihan";
import {
  NAMA_BULAN,
  daftarTahun,
  formatIDR,
  formatTanggal,
  namaBulan,
} from "@/lib/format";
import {
  btnDangerClass,
  btnDangerIconGhostClass,
  btnIconGhostClass,
  btnPrimaryClass,
  btnSecondaryClass,
  cardClass,
  cellClass,
  eyebrowClass,
  headingClass,
  labelClass,
  selectClass,
  tableHeadClass,
} from "@/lib/ui";
import { hapusPembayaran, verifikasiPembayaran } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_FILTER_VALID = ["Lunas", "Menunggu Konfirmasi", "Belum Lunas"];

export default async function PembayaranPage({
  searchParams,
}: {
  searchParams: Promise<{
    bulan?: string | string[];
    tahun?: string | string[];
    status?: string | string[];
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Terbitkan tagihan bulan berjalan yang belum ada (idempotent).
  await sinkronTagihanSemuaPenghuni();

  const sp = await searchParams;
  const sekarang = new Date();

  const bulanParam = typeof sp.bulan === "string" ? sp.bulan.trim() : "";
  const tahunParam = typeof sp.tahun === "string" ? sp.tahun.trim() : "";
  const statusParam =
    typeof sp.status === "string" &&
    STATUS_FILTER_VALID.includes(sp.status)
      ? sp.status
      : "";

  // Default tampilan: periode berjalan.
  const bulan =
    bulanParam || (!("bulan" in sp) ? String(sekarang.getMonth() + 1) : "");
  const tahun =
    tahunParam || (!("tahun" in sp) ? String(sekarang.getFullYear()) : "");
  const filterStatus = statusParam;

  const kondisi: SQL[] = [];
  if (bulan) kondisi.push(eq(pembayaran.bulan, Number(bulan)));
  if (tahun) kondisi.push(eq(pembayaran.tahun, Number(tahun)));
  if (filterStatus) {
    kondisi.push(
      eq(
        pembayaran.statusBayar,
        filterStatus as "Lunas" | "Menunggu Konfirmasi" | "Belum Lunas"
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
      buktiPembayaran: pembayaran.buktiPembayaran,
      namaPenghuni: penghuni.nama,
      statusPenghuni: penghuni.status,
      kamarNo: kamar.noKamar,
    })
    .from(pembayaran)
    .innerJoin(penghuni, eq(penghuni.id, pembayaran.idPenghuni))
    .leftJoin(kamar, eq(kamar.id, penghuni.idKamar))
    .where(kondisi.length > 0 ? and(...kondisi) : undefined)
    .orderBy(pembayaran.tanggalBayar, penghuni.nama);

  const totalBayar = daftar.reduce((acc, r) => acc + r.jumlahBayar, 0);
  const daftarLunas = daftar.filter((r) => r.statusBayar === "Lunas");
  const totalLunas = daftarLunas.reduce((acc, r) => acc + r.jumlahBayar, 0);

  // Parameter export PDF mengikuti filter aktif.
  const exportParams = new URLSearchParams();
  if (bulan) exportParams.set("bulan", bulan);
  if (tahun) exportParams.set("tahun", tahun);
  if (filterStatus) exportParams.set("status", filterStatus);
  const exportQuery = exportParams.toString();
  const exportHref = `/api/laporan/pembayaran${exportQuery ? `?${exportQuery}` : ""}`;

  // Tautan ke Laporan Keuangan dengan tahun filter yang sedang aktif
  // (halaman /laporan default ke tahun berjalan bila kosong).
  const laporanHref = tahun ? `/laporan?tahun=${tahun}` : "/laporan";

  // Pengajuan pembayaran online yang menunggu verifikasi admin (fitur 1B),
  // ditampilkan lintas periode, dikelompokkan per `kelompok_konfirmasi`.
  const rowsMenunggu = await db
    .select({
      id: pembayaran.id,
      idPenghuni: pembayaran.idPenghuni,
      bulan: pembayaran.bulan,
      tahun: pembayaran.tahun,
      jumlahBayar: pembayaran.jumlahBayar,
      metodeBayar: pembayaran.metodeBayar,
      tanggalBayar: pembayaran.tanggalBayar,
      buktiPembayaran: pembayaran.buktiPembayaran,
      kelompokKonfirmasi: pembayaran.kelompokKonfirmasi,
      namaPenghuni: penghuni.nama,
      statusPenghuni: penghuni.status,
      kamarNo: kamar.noKamar,
    })
    .from(pembayaran)
    .innerJoin(penghuni, eq(penghuni.id, pembayaran.idPenghuni))
    .leftJoin(kamar, eq(kamar.id, penghuni.idKamar))
    .where(
      and(
        eq(pembayaran.statusBayar, "Menunggu Konfirmasi"),
        isNotNull(pembayaran.kelompokKonfirmasi)
      )
    )
    .orderBy(desc(pembayaran.createdAt));

  type KelompokVerifikasi = {
    kelompok: string;
    namaPenghuni: string;
    kamarNo: string | null;
    metodeBayar: string;
    tanggalBayar: Date | null;
    buktiPembayaran: string | null;
    total: number;
    periode: string[];
  };
  const urutanKelompok = new Map<string, KelompokVerifikasi>();
  for (const r of rowsMenunggu) {
    const kunci = r.kelompokKonfirmasi!;
    const entry =
      urutanKelompok.get(kunci) ??
      {
        kelompok: kunci,
        namaPenghuni: r.namaPenghuni,
        kamarNo: r.kamarNo,
        metodeBayar: r.metodeBayar,
        tanggalBayar: r.tanggalBayar,
        buktiPembayaran: r.buktiPembayaran,
        total: 0,
        periode: [],
      };
    entry.total += r.jumlahBayar;
    entry.periode.push(`${namaBulan(r.bulan)} ${r.tahun}`);
    urutanKelompok.set(kunci, entry);
  }
  const verifikasiList = [...urutanKelompok.values()];

  const labelPeriode = bulan && tahun ? `${namaBulan(Number(bulan))} ${tahun}` : "Semua periode";

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Judul & aksi */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={eyebrowClass}>Monitoring · Pembayaran</p>
          <h1 className={headingClass}>Pembayaran Sewa</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
            Catat dan pantau pembayaran sewa bulanan penghuni. Filter
            menyesuaikan laporan yang ditampilkan maupun diexport.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href={exportHref} className={btnSecondaryClass}>
            <FileDown className="size-4" aria-hidden />
            Export PDF Laporan
          </a>
          <Link href={laporanHref} className={btnSecondaryClass}>
            <ChartColumn className="size-4" aria-hidden />
            Laporan Keuangan
          </Link>
          <Link href="/pembayaran/tambah" className={btnPrimaryClass}>
            <Plus className="size-4" aria-hidden />
            Catat Pembayaran
          </Link>
        </div>
      </section>

      {/* Filter */}
      <section className={`${cardClass} p-4`}>
        <FilterForm
          action="/pembayaran"
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
              <option value="">Semua bulan</option>
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
              <option value="">Semua tahun</option>
              {daftarTahun().map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={labelClass}>Status</span>
            <select
              key={`status-${filterStatus}`}
              name="status"
              defaultValue={filterStatus}
              className={selectClass}
            >
              <option value="">Semua status</option>
              <option value="Lunas">Lunas</option>
              <option value="Menunggu Konfirmasi">Menunggu Konfirmasi</option>
              <option value="Belum Lunas">Belum Lunas</option>
            </select>
          </label>
          <button type="submit" className={btnSecondaryClass}>
            Terapkan Filter
          </button>
          <Link href="/pembayaran" className={btnSecondaryClass}>
            Reset
          </Link>
        </FilterForm>
      </section>

      {/* ===== Verifikasi pengajuan lama (status "Menunggu Konfirmasi") ===== */}
      {verifikasiList.length > 0 ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-start gap-2.5">
            <Hourglass aria-hidden className="mt-1 size-4 shrink-0 text-amber-300" />
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-white">
                Verifikasi Pembayaran ({verifikasiList.length} pengajuan)
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/60">
                Periksa bukti yang dikirim penghuni. Menyetujui mencatat periode
                tersebut sebagai Lunas; menolak mengembalikannya menjadi tagihan.
                <br />
                <span className="text-white/45">
                  Pembayaran baru (Midtrans maupun bukti manual) kini otomatis
                  tercatat Lunas — kartu ini hanya muncul untuk pengajuan lama
                  yang belum diverifikasi.
                </span>
              </p>
            </div>
          </div>

          {verifikasiList.map((g) => (
            <article key={g.kelompok} className={`${cardClass} p-4`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-tight text-white">
                    {g.namaPenghuni} — Kamar {g.kamarNo ?? "—"}
                  </p>
                  <p className="mt-1 font-mono text-[11px] leading-relaxed text-white/50">
                    {g.periode.join(" · ")}
                  </p>
                  <p className="mt-1 font-mono text-[11px] leading-relaxed text-amber-200/80">
                    Total {formatIDR.format(g.total)} · {g.metodeBayar} ·{" "}
                    {g.tanggalBayar ? formatTanggal(g.tanggalBayar) : "—"}
                  </p>
                </div>

                {g.buktiPembayaran ? (
                  <a
                    href={g.buktiPembayaran}
                    target="_blank"
                    rel="noreferrer"
                    title="Buka bukti pembayaran"
                    className="block shrink-0 overflow-hidden rounded-md border border-amber-400/30 bg-background/50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.buktiPembayaran}
                      alt={`Bukti pembayaran ${g.namaPenghuni}`}
                      className="h-20 w-32 object-cover"
                    />
                  </a>
                ) : null}

                <form action={verifikasiPembayaran} className="flex gap-2">
                  <input type="hidden" name="kelompok" value={g.kelompok} />
                  <button type="submit" name="aksi" value="terima" className={btnPrimaryClass}>
                    Terima · Lunas
                  </button>
                  <button type="submit" name="aksi" value="tolak" className={btnDangerClass}>
                    Tolak
                  </button>
                </form>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {/* Ringkasan */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <article className={`${cardClass} p-4`}>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary/70">
            Total Tercatat · {labelPeriode}
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-white">
            {daftar.length} transaksi
          </p>
          <p className="mt-1 font-mono text-sm tabular-nums text-white/60">
            {formatIDR.format(totalBayar)}
          </p>
        </article>
        <article className={`${cardClass} p-4`}>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-300/80">
            Lunas
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-white">
            {daftarLunas.length} transaksi
          </p>
          <p className="mt-1 font-mono text-sm tabular-nums text-emerald-200/80">
            {formatIDR.format(totalLunas)}
          </p>
        </article>
        <article className={`${cardClass} p-4`}>
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-red-300/80">
            Belum Lunas
          </p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-white">
            {daftar.length - daftarLunas.length} transaksi
          </p>
          <p className="mt-1 font-mono text-sm tabular-nums text-red-200/80">
            {formatIDR.format(totalBayar - totalLunas)}
          </p>
        </article>
      </section>

      {/* Tabel transaksi */}
      <section className="animate-rise overflow-hidden rounded-xl border border-primary/20 bg-surface shadow-card">
        {daftar.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-display text-2xl font-bold tracking-tight text-white">
              Belum ada catatan.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/50">
              Tidak ada pembayaran untuk {labelPeriode} dengan filter yang
              dipilih.
            </p>
            <Link href="/pembayaran/tambah" className={`${btnPrimaryClass} mt-6`}>
              <Plus className="size-4" aria-hidden />
              Catat Pembayaran
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className={tableHeadClass}>Penghuni</th>
                  <th className={tableHeadClass}>Periode</th>
                  <th className={`${tableHeadClass} hidden md:table-cell`}>
                    Tanggal
                  </th>
                  <th className={tableHeadClass}>Jumlah</th>
                  <th className={`${tableHeadClass} hidden sm:table-cell`}>
                    Metode
                  </th>
                  <th className={tableHeadClass}>Status</th>
                  <th className={`${tableHeadClass} text-right`}>Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {daftar.map((r) => (
                  <tr
                    key={r.id}
                    className="transition-colors duration-[100ms] ease-brand hover:bg-white/[0.03]"
                  >
                    <td className={cellClass}>
                      <p className="font-bold leading-tight text-white">
                        {r.namaPenghuni}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] leading-tight text-white/40">
                        Kamar {r.kamarNo ?? "—"}
                      </p>
                    </td>
                    <td className={`${cellClass} font-mono text-xs text-white/70`}>
                      {namaBulan(r.bulan)} {r.tahun}
                    </td>
                    <td className={`${cellClass} hidden md:table-cell`}>
                      {r.statusBayar === "Belum Lunas" ? (
                        <span className="flex flex-col items-start gap-1">
                          <span className="text-white/25">—</span>
                          {r.jatuhTempo ? (
                            <span
                              className={`font-mono text-[11px] leading-tight ${
                                sudahTerlambat(r.jatuhTempo)
                                  ? "text-red-300"
                                  : "text-amber-200/80"
                              }`}
                            >
                              {sudahTerlambat(r.jatuhTempo)
                                ? "Lewat tempo"
                                : "Jatuh tempo"}{" "}
                              {formatTanggal(r.jatuhTempo)}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span
                          className={
                            r.statusBayar === "Menunggu Konfirmasi"
                              ? "text-amber-200/90"
                              : "text-white/60"
                          }
                        >
                          {formatTanggal(r.tanggalBayar)}
                        </span>
                      )}
                    </td>
                    <td className={`${cellClass} font-mono text-xs tabular-nums text-white`}>
                      {formatIDR.format(r.jumlahBayar)}
                    </td>
                    <td className={`${cellClass} hidden text-white/60 sm:table-cell`}>
                      {r.statusBayar === "Belum Lunas" ? "—" : r.metodeBayar}
                    </td>
                    <td className={cellClass}>
                      <div className="flex flex-wrap items-center gap-2">
                        <BayarBadge status={r.statusBayar} />
                        {r.buktiPembayaran ? (
                          <a
                            href={r.buktiPembayaran}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Lihat bukti pembayaran yang dikirim penghuni"
                            aria-label={`Lihat bukti pembayaran ${r.namaPenghuni} ${namaBulan(r.bulan)} ${r.tahun}`}
                            className="inline-flex min-h-[28px] items-center gap-1 rounded-full border border-primary/30 px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em] text-primary/80 transition-colors duration-[100ms] ease-brand hover:border-primary hover:bg-primary/10 hover:text-primary"
                          >
                            <Paperclip className="size-3" aria-hidden />
                            Bukti
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td className={`${cellClass} text-right`}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/pembayaran/${r.id}/edit`}
                          title="Edit catatan"
                          aria-label={`Edit pembayaran ${r.namaPenghuni}`}
                          className={btnIconGhostClass}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Link>
                        <ConfirmForm
                          action={hapusPembayaran}
                          confirmMessage={`Hapus catatan pembayaran ${r.namaPenghuni} (${namaBulan(r.bulan)} ${r.tahun})?`}
                        >
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            title="Hapus catatan"
                            aria-label={`Hapus pembayaran ${r.namaPenghuni}`}
                            className={btnDangerIconGhostClass}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </ConfirmForm>
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

