import type { Metadata } from "next";
import { ArrowLeft, DoorOpen, LockKeyhole, ReceiptText, UserPlus } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { cardClass } from "@/lib/ui";
import { kamarBisaDitempati } from "@/lib/kamar-options";
import { DaftarForm } from "./daftar-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pendaftaran Penghuni Baru",
};

/** Halaman publik: pendaftaran mandiri penghuni baru (email & password sendiri). */
export default async function DaftarPage() {
  const kamarTersedia = await kamarBisaDitempati();

  const langkah = [
    {
      ikon: UserPlus,
      judul: "1 · Daftar & pilih kamar",
      teks: "Isi data diri, pilih kamar yang tersedia, dan buat email + password akun portal Anda.",
    },
    {
      ikon: ReceiptText,
      judul: "2 · Bayar awal online",
      teks: "Setelah masuk, Anda diarahkan ke halaman pembayaran. Pilih paket 1, 2, atau 6 bulan lalu bayar lewat web.",
    },
    {
      ikon: LockKeyhole,
      judul: "3 · Menu terbuka otomatis",
      teks: "Pembayaran diterima → kamar resmi Terisi, notifikasi terkirim, dan seluruh menu portal langsung terbuka.",
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
                Pendaftaran Penghuni Baru
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
              Registrasi Penghuni
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl">
              Daftar &amp; Bayar di Awal
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
              Buat akun portal Anda sendiri dengan email &amp; password.
              Setelah mendaftar, Anda langsung diarahkan ke pembayaran awal
              untuk mengaktifkan kamar dan membuka menu portal.
            </p>

            <div className="mt-7">
              <DaftarForm kamarOptions={kamarTersedia} />
            </div>
          </div>

          {/* Sidebar alur */}
          <aside className="flex flex-col gap-4">
            <div className={`${cardClass} p-5`}>
              <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
                <LockKeyhole className="size-4" aria-hidden />
                Sudah terdata pengelola?
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                Jika data diri &amp; kamar Anda sudah dicatat pengelola kos, jangan
                daftar ulang di sini. Gunakan halaman{" "}
                <Link
                  href="/daftar-penghuni"
                  className="inline-flex items-center gap-1 font-bold text-primary underline-offset-4 hover:underline"
                >
                  <UserPlus className="size-3.5" aria-hidden />
                  Aktifkan Akun Portal
                </Link>{" "}
                — cukup isi Nomor HP, email, &amp; password.
              </p>
            </div>
            <div className={`${cardClass} p-5`}>
              <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
                <DoorOpen className="size-4" aria-hidden />
                Kamar tersedia: {kamarTersedia.length}
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
