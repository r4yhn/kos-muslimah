import type { Metadata } from "next";
import {
  ArrowLeft,
  IdCard,
  KeyRound,
  LockKeyhole,
  LogIn,
  UserPlus,
} from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { cardClass } from "@/lib/ui";
import { AktifkanAkunForm } from "./aktifkan-akun-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aktifkan Akun Portal Penghuni",
};

/** Halaman publik: penghuni yang sudah terdata pengelola membuat akun sendiri. */
export default function DaftarPenghuniPage() {
  const langkah = [
    {
      ikon: IdCard,
      judul: "1 · Cek data Anda",
      teks: "Isi Nomor HP/WA yang dicatat pengelola saat Anda mendaftar sebagai penghuni kos.",
    },
    {
      ikon: KeyRound,
      judul: "2 · Buat email & password",
      teks: "Email dipakai sebagai username login. Buat password minimal 6 karakter.",
    },
    {
      ikon: LogIn,
      judul: "3 · Langsung masuk",
      teks: "Akun tertaut ke data Anda. Setelah masuk, seluruh menu portal penghuni terbuka (atau diarahkan ke Pembayaran Awal bila kamar belum aktif).",
    },
  ];

  return (
    <main className="relative flex min-h-full flex-1 flex-col overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[46rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-5xl flex-1">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandMark size="sm" />
            <div className="min-w-0">
              <p className="truncate font-display text-lg leading-none tracking-tight text-white">
                Kos Pondok Muslimah
              </p>
              <p className="mt-1 hidden font-mono text-[10px] font-medium uppercase tracking-[0.25em] text-primary/80 sm:block">
                Portal Penghuni · Aktivasi Akun
              </p>
            </div>
          </div>
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-primary/30 px-4 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-white/80 transition-all duration-[100ms] ease-brand hover:border-primary hover:bg-primary/10 hover:text-primary active:translate-y-px"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Sudah punya akun? Masuk
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Form */}
          <div className={`${cardClass} p-6 sm:p-8`}>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.25em] text-primary/80">
              Registrasi Khusus Penghuni
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl">
              Aktifkan Akun Portal
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
              Khusus penghuni yang <strong className="text-white/80">sudah terdata oleh
              pengelola kos</strong> (data diri &amp; kamar sudah dicatat) tetapi belum
              memiliki akun login. Buat email &amp; password Anda sendiri di sini —
              tanpa perlu memilih kamar lagi.
            </p>

            <div className="mt-7">
              <AktifkanAkunForm />
            </div>
          </div>

          {/* Sidebar alur */}
          <aside className="flex flex-col gap-4">
            <div className={`${cardClass} p-5`}>
              <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
                <LockKeyhole className="size-4" aria-hidden />
                Penghuni baru?
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                Belum tercatat sebagai penghuni? Gunakan halaman{" "}
                <Link
                  href="/daftar"
                  className="inline-flex items-center gap-1 font-bold text-primary underline-offset-4 hover:underline"
                >
                  <UserPlus className="size-3.5" aria-hidden />
                  Pendaftaran Penghuni Baru
                </Link>{" "}
                untuk memilih kamar tersedia &amp; menyelesaikan Pembayaran Awal.
              </p>
            </div>
            {langkah.map(({ ikon: Ikon, judul, teks }) => (
              <div key={judul} className={`${cardClass} p-5`}>
                <Ikon aria-hidden className="size-4 text-primary/70" />
                <p className="mt-3 font-display text-base font-bold tracking-tight text-white">
                  {judul}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                  {teks}
                </p>
              </div>
            ))}
          </aside>
        </div>
      </div>
    </main>
  );
}
