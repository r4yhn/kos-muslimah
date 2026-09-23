import type { Metadata } from "next";
import { MessageSquareWarning } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
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
import { berandaPeran } from "@/lib/role";
import { cardClass, eyebrowClass, headingClass } from "@/lib/ui";
import { StatusPengaduanForm } from "./status-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pengaduan",
};

const formatWaktu = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Modul "Pengaduan & Laporan Kendala" (sisi pengelola).
 *
 * Admin memverifikasi laporan penghuni di lapangan, mencatat hasilnya, lalu
 * memperbarui status menjadi `diproses` / `selesai`. Perubahan langsung
 * terlihat oleh Pemilik Kos di `/monitoring/pengaduan` (transparansi kinerja)
 * dan oleh penghuni pelapor di `/portal/pengaduan`.
 */
export default async function PengaduanPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect(berandaPeran(session.user.role));

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
    { label: "Semua", href: "/pengaduan", jumlah: rekap.total, aktif: !filter },
    ...STATUS_PENGADUAN.map((s) => ({
      label: LABEL_STATUS_PENGADUAN[s],
      href: `/pengaduan?status=${s}`,
      jumlah: rekap[s],
      aktif: filter === s,
    })),
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Judul */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={eyebrowClass}>Kelola · Pengaduan</p>
          <h1 className={headingClass}>Pengaduan &amp; Laporan Kendala</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
            Verifikasi laporan kendala penghuni di lapangan, lalu perbarui
            statusnya. Catatan penanganan wajib diisi agar Pemilik Kos dapat
            memantau kinerja pengelola secara transparan.
          </p>
        </div>
      </section>

      {/* Ringkasan status */}
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

      {/* Filter status */}
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

      {/* Daftar pengaduan */}
      {daftar.length === 0 ? (
        <section className={`${cardClass} px-6 py-16 text-center`}>
          <MessageSquareWarning
            aria-hidden
            className="mx-auto size-8 text-white/30"
          />
          <p className="mt-4 font-display text-2xl font-bold tracking-tight text-white">
            Tidak ada pengaduan
            {filter ? ` berstatus ${LABEL_STATUS_PENGADUAN[filter]}` : ""}.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/50">
            Laporan kendala kamar yang dikirim penghuni akan muncul di sini untuk
            diverifikasi.
          </p>
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          {daftar.map((p) => (
            <article key={p.idPengaduan} className={`${cardClass} p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold leading-tight text-white">
                    {p.namaPenghuni}{" "}
                    <span className="font-mono text-xs font-medium text-white/45">
                      · Kamar {p.noKamar ?? "—"}
                    </span>
                  </p>
                  <p className="mt-1.5 font-mono text-[11px] leading-tight text-white/40">
                    Dilaporkan {formatTanggal(p.tanggalLapor)}
                    {p.ditanganiPada
                      ? ` · diperbarui ${formatWaktu.format(p.ditanganiPada)}`
                      : ""}
                  </p>
                </div>
                <PengaduanBadge
                  status={p.statusPenyelesaian}
                  label={LABEL_STATUS_PENGADUAN[p.statusPenyelesaian]}
                />
              </div>

              <p className="mt-3 whitespace-pre-line leading-relaxed text-white/80">
                {p.deskripsiKendala}
              </p>

              {p.catatanAdmin ? (
                <p className="mt-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs leading-relaxed text-white/60">
                  <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary/70">
                    Catatan penanganan:{" "}
                  </span>
                  {p.catatanAdmin}
                </p>
              ) : null}

              <div className="mt-4 border-t border-white/10 pt-4">
                <StatusPengaduanForm
                  idPengaduan={p.idPengaduan}
                  statusSaatIni={p.statusPenyelesaian}
                  catatanSaatIni={p.catatanAdmin}
                />
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
