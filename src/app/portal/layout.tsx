import { LockKeyhole } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { ConfirmForm } from "@/components/confirm-form";
import { PortalNav } from "@/components/portal-nav";
import { btnSecondaryClass, eyebrowClass } from "@/lib/ui";
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
 * - Mantan penghuni (status "Keluar" — datanya sudah dipindahkan ke arsip kos
 *   oleh fitur "Arsip Otomatis & Pengosongan Kamar") tidak lagi memakai portal:
 *   yang tampil hanya keterangan bahwa akunnya sudah tidak aktif beserta tombol
 *   keluar. Pengarsipan **tidak diberitahukan** ke penghuni dan tidak ada
 *   informasi arsip/jatuh tempo apa pun pada navbar portal.
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

  // ====== Mantan penghuni: akun portalnya sudah tidak aktif ======
  // Tidak ada informasi apa pun soal pengarsipan (penghuni tidak perlu tahu).
  if (data.status === "Keluar") {
    return (
      <main className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-xl border border-primary/20 bg-surface p-8 text-center shadow-elevated">
          <BrandMark size="md" className="mx-auto" />
          <p className={`${eyebrowClass} mt-6`}>Portal Penghuni</p>
          <h1 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
            Akun Portal Sudah Tidak Aktif
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/60">
            Akun ini tidak lagi terhubung dengan kamar kos mana pun. Silakan
            hubungi pengelola kos bila Anda ingin kembali menghuni atau
            membutuhkan bantuan atas akun Anda.
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

  const { nama, email, terkunci } = data;

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
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
              <ConfirmForm
                action={logoutPortal}
                confirmMessage="Keluar dari portal penghuni?"
              >
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-primary/30 px-4 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-white/80 transition-all duration-[100ms] ease-brand hover:border-primary hover:bg-primary/10 hover:text-primary active:translate-y-px"
                >
                  Keluar
                </button>
              </ConfirmForm>
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
