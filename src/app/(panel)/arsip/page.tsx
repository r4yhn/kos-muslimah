import type { Metadata } from "next";
import { Archive, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AlasanArsipBadge, BayarBadge } from "@/components/badges";
import {
  ALASAN_ARSIP,
  LABEL_ALASAN_ARSIP,
  daftarArsipPenghuni,
  isAlasanArsip,
  ringkasanArsip,
  type AlasanArsip,
  type BarisArsip,
} from "@/lib/arsip";
import { formatIDR, formatTanggal, namaBulan } from "@/lib/format";
import { berandaPeran } from "@/lib/role";
import {
  btnPrimaryClass,
  btnSecondaryClass,
  cardClass,
  cellClass,
  eyebrowClass,
  headingClass,
  inputClass,
  labelClass,
  tableHeadClass,
} from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Arsip Penghuni",
};

/**
 * Menu **Arsip** panel pengelola — pusat informasi seluruh mantan penghuni
 * (fitur "Arsip Otomatis & Pengosongan Kamar").
 *
 * Setiap kali penghuni **benar-benar keluar** (proses keluar oleh pengelola,
 * checkout *Selesai Sewa / Pindah Kos* dari portal, atau pemindaian otomatis
 * data lama), data dirinya dipindahkan ke tabel `arsip_penghuni`
 * bersama salinan riwayat pembayaran & keterangan kamar yang ditinggalkan —
 * sehingga bila pihak berwenang (Kepolisian / Satpol PP) memerlukan riwayat
 * penghuni, datanya tersedia lengkap tanpa mengganggu data operasional.
 *
 * Catatan: tombol *Keluar* (*logout*) pada portal penghuni hanya menghapus sesi
 * login dan **tidak** menambah data di sini.
 */
export default async function ArsipPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; alasan?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect(berandaPeran(session.user.role));

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const alasanParam = typeof sp.alasan === "string" ? sp.alasan : "";
  const alasan: AlasanArsip | undefined = isAlasanArsip(alasanParam)
    ? alasanParam
    : undefined;

  const [daftar, rekap] = await Promise.all([
    daftarArsipPenghuni({ q, alasan }),
    ringkasanArsip(),
  ]);

  const kataKunci = q ? `q=${encodeURIComponent(q)}` : "";
  const pills = [
    {
      label: "Semua",
      href: `/arsip${kataKunci ? `?${kataKunci}` : ""}`,
      jumlah: rekap.total,
      aktif: !alasan,
    },
    ...ALASAN_ARSIP.map((a) => ({
      label: LABEL_ALASAN_ARSIP[a],
      href: `/arsip?alasan=${encodeURIComponent(a)}${
        kataKunci ? `&${kataKunci}` : ""
      }`,
      jumlah: a === "Proses Keluar" ? rekap.prosesKeluar : rekap.habisMasaSewa,
      aktif: alasan === a,
    })),
  ];

  const kartu = [
    { label: "Total Arsip", nilai: String(rekap.total), kelas: "text-white" },
    {
      label: "Keluar Tahun Ini",
      nilai: String(rekap.tahunIni),
      kelas: "text-primary",
    },
    {
      label: "Proses Keluar",
      nilai: String(rekap.prosesKeluar),
      kelas: "text-sky-300",
    },
    {
      label: "Habis Masa Sewa",
      nilai: String(rekap.habisMasaSewa),
      kelas: "text-amber-300",
    },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Judul */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={eyebrowClass}>Kelola · Arsip</p>
          <h1 className={headingClass}>Arsip Mantan Penghuni</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
            Riwayat penghuni yang telah keluar — dipindahkan otomatis ke arsip
            (tidak dihapus permanen) beserta kamar yang ditinggalkan dan salinan
            riwayat pembayarannya. Gunakan halaman ini sebagai sumber data bila
            pihak berwenang memerlukan keterangan penghuni.
            {q ? ` Hasil pencarian untuk “${q}”.` : ""}
          </p>
        </div>
        <form method="get" action="/arsip" className="flex items-center gap-2">
          {alasan ? <input type="hidden" name="alasan" value={alasan} /> : null}
          <label className="sr-only" htmlFor="q">
            Cari arsip penghuni
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Cari nama / kamar / no. HP…"
            className={`${inputClass} max-w-[240px]`}
          />
          <button type="submit" aria-label="Cari" className={btnSecondaryClass}>
            <Search className="size-4" aria-hidden />
            <span className="hidden sm:inline">Cari</span>
          </button>
        </form>
      </section>

      {/* Ringkasan */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kartu.map((k) => (
          <article key={k.label} className={`${cardClass} p-4`}>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary/60">
              {k.label}
            </p>
            <p className={`mt-2 font-display text-2xl font-bold ${k.kelas}`}>
              {k.nilai}
            </p>
          </article>
        ))}
      </section>

      {rekap.totalTunggakan > 0 ? (
        <p className="rounded-md border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm leading-relaxed text-amber-100">
          Tercatat tunggakan{" "}
          <strong>{formatIDR.format(rekap.totalTunggakan)}</strong> pada data
          arsip. Tunggakan tersebut tetap dapat ditelusuri lewat menu Pembayaran
          (data penghuni asal tidak dihapus).
        </p>
      ) : null}

      {/* Filter alasan */}
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

      {daftar.length === 0 ? (
        <section className={`${cardClass} px-6 py-16 text-center`}>
          <Archive aria-hidden className="mx-auto size-8 text-white/30" />
          <p className="mt-4 font-display text-2xl font-bold tracking-tight text-white">
            {q || alasan ? "Tidak ada arsip yang cocok." : "Arsip masih kosong."}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            Data penghuni masuk ke sini saat diproses keluar dari menu Penghuni
            atau saat penghuni menekan <strong className="text-white/70">Selesai
            Sewa / Pindah Kos</strong> di portal — tanpa menghapus data aslinya.
            Keluar (<em>logout</em>) biasa tidak menambah arsip.
          </p>
          {q || alasan ? (
            <Link href="/arsip" className={`${btnPrimaryClass} mt-6`}>
              Reset Filter
            </Link>
          ) : null}
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          {daftar.map((baris) => (
            <KartuArsip key={baris.id} baris={baris} />
          ))}
        </section>
      )}
    </div>
  );
}

/** Kartu identitas satu mantan penghuni + riwayat pembayarannya. */
function KartuArsip({ baris }: { baris: BarisArsip }) {
  const identitas = [
    { label: "No. HP / WA", nilai: baris.noHp },
    { label: "Jenis Kelamin", nilai: baris.jenisKelamin },
    {
      label: "Kamar yang Ditinggalkan",
      nilai: baris.noKamar
        ? `${baris.noKamar}${baris.tipeKamar ? ` · ${baris.tipeKamar}` : ""}`
        : "—",
    },
    { label: "Masuk Sejak", nilai: formatTanggal(baris.tglMasuk) },
    { label: "Tanggal Keluar", nilai: formatTanggal(baris.tglKeluar) },
    {
      label: "Periode Terakhir Dibayar",
      nilai: baris.periodeTerakhir ?? "belum ada pembayaran",
    },
  ];

  return (
    <article className={`${cardClass} p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl font-bold leading-tight tracking-tight text-white">
            {baris.nama}
          </p>
          <p className="mt-1.5 font-mono text-[11px] leading-tight text-white/40">
            Diarsipkan {formatTanggal(baris.tglKeluar)}
            {baris.noKamar ? ` · eks-Kamar ${baris.noKamar}` : ""}
            {baris.alasan === "Habis Masa Sewa"
              ? " · otomatis (tagihan lewat jatuh tempo)"
              : ""}
          </p>
        </div>
        <AlasanArsipBadge alasan={baris.alasan} />
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {identitas.map((item) => (
          <div key={item.label}>
            <dt className={labelClass}>{item.label}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-white/80">
              {item.nilai}
            </dd>
          </div>
        ))}
        <div className="sm:col-span-2 lg:col-span-3">
          <dt className={labelClass}>Alamat</dt>
          <dd className="mt-1 text-sm leading-relaxed text-white/80">
            {baris.alamat}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
        <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 font-mono text-[11px] text-emerald-300">
          Dibayar {formatIDR.format(baris.totalPembayaran)}
        </span>
        {baris.totalTunggakan > 0 ? (
          <span className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 font-mono text-[11px] text-red-300">
            Tunggakan {formatIDR.format(baris.totalTunggakan)}
          </span>
        ) : null}
        {baris.hargaSewa ? (
          <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1 font-mono text-[11px] text-white/60">
            Sewa {formatIDR.format(baris.hargaSewa)}/bulan
          </span>
        ) : null}
        <span className="rounded-full border border-white/12 bg-white/5 px-3 py-1 font-mono text-[11px] text-white/60">
          {baris.jumlahPembayaran} catatan pembayaran
        </span>
      </div>

      {baris.catatan ? (
        <p className="mt-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-white/60">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary/70">
            Catatan arsip:{" "}
          </span>
          {baris.catatan}
        </p>
      ) : null}

      <details className="mt-4 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2.5">
        <summary className="cursor-pointer font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-primary/80">
          Riwayat pembayaran ({baris.jumlahPembayaran})
        </summary>
        {baris.riwayatPembayaran.length === 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-white/45">
            Tidak ada catatan pembayaran untuk penghuni ini.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="border-b border-white/10">
                  <th className={tableHeadClass}>Periode</th>
                  <th className={tableHeadClass}>Tanggal Bayar</th>
                  <th className={tableHeadClass}>Nominal</th>
                  <th className={tableHeadClass}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {baris.riwayatPembayaran.map((r) => (
                  <tr key={`${r.tahun}-${r.bulan}`}>
                    <td className={`${cellClass} font-bold text-white/85`}>
                      {namaBulan(r.bulan)} {r.tahun}
                      {r.keterangan ? (
                        <span className="block text-[11px] font-normal text-white/40">
                          {r.keterangan}
                        </span>
                      ) : null}
                    </td>
                    <td className={`${cellClass} text-white/60`}>
                      {formatTanggal(r.tanggalBayar)}
                    </td>
                    <td
                      className={`${cellClass} font-mono tabular-nums text-white/80`}
                    >
                      {formatIDR.format(r.jumlahBayar)}
                    </td>
                    <td className={cellClass}>
                      <BayarBadge status={r.statusBayar} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </article>
  );
}

