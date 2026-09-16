import { Bell, LockKeyhole } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { PortalNav } from "@/components/portal-nav";
import { PortalNotifPoll } from "@/components/portal-notif-poll";
import { btnSecondaryClass } from "@/lib/ui";
import { hitungNotifikasiBelumDibaca } from "@/lib/notifikasi";
import { getPortalData } from "@/lib/portal";
import { logoutPortal } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Layout bersama seluruh halaman portal penghuni (/portal, /portal/riwayat,
 * /portal/bayar-awal).
 *
 * - Hanya akun role "penghuni" yang boleh masuk (admin dialihkan ke panel).
 * - Saat penghuni baru masih wajib "Pembayaran Awal", menu lain dikunci:
 *   hanya link Pembayaran Awal yang tampil + banner peringatan.
 *   (Pengalihan halaman tetap diperkuat di masing-masing halaman.)
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await getPortalData();

  if (!data) {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-xl border border-primary/20 bg-surface p-8 text-center shadow-elevated">
          <BrandMark size="md" className="mx-auto" />
          <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-white">
            Akun Tidak Terhubung
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            Akun ini tidak tertaut ke data penghuni mana pun. Silakan hubungi
            pengelola kos atau keluar lalu masuk kembali.
          </p>
          <form action={logoutPortal} className="mt-6">
            <button type="submit" className={btnSecondaryClass}>
              Keluar
            </button>
          </form>
        </div>
      </main>
    );
  }

  const { nama, email, userId, terkunci } = data;

  const belumDibaca = await hitungNotifikasiBelumDibaca(userId);

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      {/* Penyegar notifikasi "real-time" (badge lonceng & daftar notifikasi). */}
      <PortalNotifPoll belumDibaca={belumDibaca} />

      {/* ====== Header / Navigasi ====== */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2.5 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <BrandMark size="sm" />
              <div className="min-w-0">
                <p className="truncate font-display text-lg leading-none tracking-tight text-white">
                  Kos Pondok Muslimah
                </p>
                <p className="mt-1 hidden font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-primary/80 sm:block">
                  Portal Penghuni
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <div className="hidden text-right lg:block">
                <p className="text-sm font-bold leading-tight text-white">
                  {nama}
                </p>
                <p className="font-mono text-[11px] leading-tight text-white/50">
                  {email}
                </p>
              </div>
              <Link
                href="/portal/notifikasi"
                aria-label={`Notifikasi${belumDibaca > 0 ? ` — ${belumDibaca} belum dibaca` : ""}`}
                className="relative inline-flex min-h-[44px] w-[44px] items-center justify-center rounded-md border border-primary/30 text-white/80 transition-all duration-[100ms] ease-brand hover:border-primary hover:bg-primary/10 hover:text-primary active:translate-y-px"
              >
                <Bell className="size-4" aria-hidden />
                {belumDibaca > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 font-mono text-[10px] font-bold leading-tight text-white shadow-card">
                    {belumDibaca}
                  </span>
                ) : null}
              </Link>
              <form action={logoutPortal}>
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-primary/30 px-4 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-white/80 transition-all duration-[100ms] ease-brand hover:border-primary hover:bg-primary/10 hover:text-primary active:translate-y-px"
                >
                  Keluar
                </button>
              </form>
            </div>
          </div>

          <PortalNav terkunci={terkunci} />
        </div>
      </header>

      {terkunci ? (
        <div
          role="status"
          className="border-b border-amber-400/20 bg-amber-400/10"
        >
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-4 py-3 text-sm leading-relaxed text-amber-100 sm:px-6">
            <LockKeyhole aria-hidden className="size-4 shrink-0 text-amber-300" />
            <span>
              <strong className="font-bold">Akses terkunci.</strong> Selesaikan{" "}
              <em>Pembayaran Awal</em> di bawah untuk membuka menu lain dan
              mengaktifkan status kamar Anda secara resmi.
            </span>
          </div>
        </div>
      ) : null}

      {/* ====== Konten ====== */}
      <main className="relative flex w-full flex-1 flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 right-0 h-72 w-[34rem] rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-6">
          {children}
        </div>
      </main>
    </div>
  );
}
