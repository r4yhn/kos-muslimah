import { Bell } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { AppNav } from "@/components/app-nav";
import { BrandMark } from "@/components/brand-mark";
import { hitungNotifikasiBelumDibaca } from "@/lib/notifikasi";
import { berandaPeran } from "@/lib/role";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Layout bersama seluruh halaman panel (/dashboard, /kamar, /penghuni,
 * /pembayaran, /laporan, /pengaduan, /notifikasi). Melindungi route (wajib
 * login) dan menyediakan navigasi konsisten + tombol keluar.
 */
export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // Panel pengelola khusus role "admin" (pemilik -> /monitoring, penghuni ->
  // /portal).
  if (session.user.role !== "admin") {
    redirect(berandaPeran(session.user.role));
  }

  const name = session.user.name ?? "Pengelola";
  const email = session.user.email ?? "";
  const belumDibaca = await hitungNotifikasiBelumDibaca(session.user.id);

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
                  Sistem Manajemen Pengelola
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              <Link
                href="/profil"
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
              <Link
                href="/notifikasi"
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
              <form action={logout}>
                <button
                  type="submit"
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border border-primary/30 px-4 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-white/80 transition-all duration-[100ms] ease-brand hover:border-primary hover:bg-primary/10 hover:text-primary active:translate-y-px"
                >
                  Keluar
                </button>
              </form>
            </div>
          </div>

          <AppNav />
        </div>
      </header>

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
