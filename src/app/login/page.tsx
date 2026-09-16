"use client";

import { useActionState } from "react";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { authenticate } from "./actions";

const inputClass =
  "min-h-[44px] w-full rounded-md border border-primary/30 bg-background/70 px-3.5 text-sm text-white outline-none transition-[border-color,background-color] duration-[100ms] ease-brand placeholder:text-primary/40 hover:border-primary/60 focus:border-primary focus:bg-background";

const submitButtonClass =
  "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-bold text-on-primary transition-[box-shadow,filter,transform] duration-[100ms] ease-brand hover:shadow-card hover:brightness-105 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60";

export default function LoginPage() {
  const [errorMessage, formAction, isPending] = useActionState(
    authenticate,
    undefined
  );

  return (
    <main className="relative flex min-h-full flex-1 items-center justify-center overflow-hidden px-4 py-12">
      {/* Glow dekoratif terracotta di belakang panel login */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[44rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative w-full max-w-md animate-rise">
        <div className="rounded-xl border border-primary/20 bg-surface p-8 shadow-elevated sm:p-10">
          {/* Brand */}
          <div className="flex flex-col items-center text-center">
            <BrandMark size="md" />
            <p className="mt-3 font-mono text-[10px] font-medium uppercase tracking-[0.3em] text-primary/80">
              Kos Pondok Muslimah
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold leading-[1.1] tracking-tight text-white">
              Masuk ke Sistem
            </h1>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">
              Masuk sebagai pengelola untuk mengelola kamar, penghuni, dan
              pembayaran — atau sebagai penghuni untuk mengakses portal Anda.
            </p>
          </div>

          <form action={formAction} className="mt-8 flex flex-col gap-5">
            <label className="flex flex-col gap-2">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
                Email
              </span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="admin@kosmuslimah.com"
                className={inputClass}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
                Password
              </span>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className={inputClass}
              />
            </label>

            {errorMessage ? (
              <div
                role="alert"
                aria-live="polite"
                className="flex items-start gap-2.5 rounded-md border border-red-400/30 bg-red-400/10 px-3 py-2.5 text-sm text-red-200"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-red-300"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{errorMessage}</span>
              </div>
            ) : null}

            <button type="submit" disabled={isPending} className={submitButtonClass}>
              {isPending ? "Memproses…" : "Masuk"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center font-mono text-[11px] leading-relaxed text-white/40">
          Akun penghuni dibuat mandiri lewat salah satu jalur pendaftaran di
          bawah, atau dibuatkan oleh pengelola kos.
        </p>

        <div className="mt-4 flex flex-col gap-2.5 rounded-lg border border-primary/15 bg-surface/40 p-3.5 text-center">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary/70">
            Registrasi Khusus Penghuni
          </p>
          <Link
            href="/daftar-penghuni"
            className="text-sm font-bold text-primary underline-offset-4 transition-colors duration-[100ms] ease-brand hover:text-primary/80 hover:underline"
          >
            Sudah terdata pengelola? Aktifkan akun portal (email &amp; password)
          </Link>
          <p className="text-xs leading-relaxed text-white/45">
            Belum pernah terdata?{" "}
            <Link
              href="/daftar"
              className="font-bold text-white/80 underline-offset-4 transition-colors duration-[100ms] ease-brand hover:text-primary hover:underline"
            >
              Daftar penghuni baru
            </Link>{" "}
            — pilih kamar &amp; bayar awal.
          </p>
        </div>
      </div>
    </main>
  );
}

