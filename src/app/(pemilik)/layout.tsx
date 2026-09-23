import { Eye, LogOut } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BrandMark } from "@/components/brand-mark";
import { MonitoringNav } from "@/components/monitoring-nav";
import { LABEL_ROLE, berandaPeran } from "@/lib/role";
import { logoutMonitoring } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Layout bersama seluruh halaman pemantauan Pemilik Kos
 * (`/monitoring`, `/monitoring/kamar`, `/monitoring/penghuni`,
 * `/monitoring/pembayaran`, `/monitoring/laporan`, `/monitoring/pengaduan`).
 *
 * Area ini khusus role `pemilik` dan bersifat **read-only**: hanya menampilkan
 * data (kamar, penghuni, pembayaran, laporan keuangan, pengaduan) tanpa tombol
 * tambah/ubah/hapus. Server action yang mengubah data tetap menolak role ini
 * sebagai pengaman tambahan (defense in depth).
 */
export default async function MonitoringLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Hanya Pemilik Kos (role "pemilik") yang boleh membuka area pemantauan.
  if (session.user.role !== "pemilik") {
    redirect(berandaPeran(session.user.role));
  }

  const name = session.user.name ?? LABEL_ROLE.pemilik;
  const email = session.user.email ?? "";

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
                  Pemantauan Pemilik Kos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <Link
                href="/monitoring/profil"
                title="Ubah profil & password"
                className="hidden rounded-md px-2.5 py-1 text-right transition-colors duration-[100ms] ease-brand hover:bg-primary/10 lg:block"
              >
                <p className="text-sm font-bold leading-tight text-white">
                  {name}
                </p>
                <p className="font-mono text-[11px] leading-tight text-white/50">
                  {email}
                </p>
              </Link>
              <form action={logoutMonitoring}>
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-primary/30 px-4 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-white/80 transition-all duration-[100ms] ease-brand hover:border-primary hover:bg-primary/10 hover:text-primary active:translate-y-px"
                >
                  <LogOut aria-hidden className="size-4" />
                  Keluar
                </button>
              </form>
            </div>
          </div>

          <MonitoringNav />
        </div>
      </header>

      {/* Pemberitahuan mode hanya-baca */}
      <div role="status" className="border-b border-sky-400/20 bg-sky-400/10">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-4 py-2.5 text-xs leading-relaxed text-sky-100 sm:px-6">
          <Eye aria-hidden className="size-4 shrink-0 text-sky-300" />
          <span>
            <strong className="font-bold">Mode pemantauan (read-only).</strong>{" "}
            Data di area ini hanya dapat dilihat. Penambahan, perubahan, dan
            penghapusan data dilakukan oleh pengelola kos.
          </span>
        </div>
      </div>

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
