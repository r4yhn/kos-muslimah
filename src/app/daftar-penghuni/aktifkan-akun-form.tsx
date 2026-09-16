"use client";

import { LockKeyhole, Mail, Phone } from "lucide-react";
import { useActionState } from "react";

import {
  btnPrimaryClass,
  errorBoxClass,
  fieldClass,
  helpClass,
  inputClass,
  labelClass,
} from "@/lib/ui";
import { aktifkanAkunPortal, type AktifkanState } from "./actions";

/**
 * Form aktivasi akun portal penghuni (halaman publik /daftar-penghuni).
 * Penghuni yang sudah terdata oleh pengelola mencocokkan Nomor HP/WA-nya,
 * lalu membuat email (username) & password sendiri untuk login ke portal.
 */
export function AktifkanAkunForm() {
  const [state, formAction, isPending] = useActionState<AktifkanState, FormData>(
    aktifkanAkunPortal,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <label className={fieldClass}>
        <span className={labelClass}>Nomor HP / WA (verifikasi data)</span>
        <div className="relative">
          <Phone
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-primary/60"
          />
          <input
            type="tel"
            name="noHp"
            required
            autoComplete="tel"
            placeholder="cth: 0812-3456-7890"
            className={`${inputClass} pl-10`}
          />
        </div>
        <span className={helpClass}>
          Nomor ini harus sama dengan yang dicatat pengelola kos saat Anda
          mendaftar sebagai penghuni.
        </span>
      </label>

      <label className={fieldClass}>
        <span className={labelClass}>
          Nama Lengkap <span className="text-white/35">(opsional)</span>
        </span>
        <input
          type="text"
          name="nama"
          autoComplete="name"
          placeholder="cth: Siti Aminah"
          className={inputClass}
        />
        <span className={helpClass}>
          Diperlukan hanya bila ada lebih dari satu data dengan nomor HP yang
          sama.
        </span>
      </label>

      <fieldset className="rounded-md border border-primary/20 p-4">
        <legend className="px-1 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
          Akun Login Anda
        </legend>
        <p className="mb-4 text-xs leading-relaxed text-white/50">
          Email bertindak sebagai username untuk masuk ke portal penghuni.
          Simpan baik-baik — jangan bagikan kepada siapa pun.
        </p>
        <div className="flex flex-col gap-5">
          <label className={fieldClass}>
            <span className={labelClass}>Email (username login)</span>
            <div className="relative">
              <Mail
                aria-hidden
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-primary/60"
              />
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="cth: siti@email.com"
                className={`${inputClass} pl-10`}
              />
            </div>
          </label>

          <label className={fieldClass}>
            <span className={labelClass}>Password</span>
            <div className="relative">
              <LockKeyhole
                aria-hidden
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-primary/60"
              />
              <input
                type="password"
                name="password"
                required
                autoComplete="new-password"
                minLength={6}
                placeholder="Minimal 6 karakter"
                className={`${inputClass} pl-10`}
              />
            </div>
          </label>
        </div>
      </fieldset>

      {state?.error ? (
        <div role="alert" className={errorBoxClass}>
          {state.error}
        </div>
      ) : null}

      <div className="flex flex-col gap-2.5">
        <button type="submit" disabled={isPending} className={btnPrimaryClass}>
          {isPending ? "Mengaktifkan…" : "Aktifkan Akun & Masuk"}
        </button>
        <p className="text-xs leading-relaxed text-white/45">
          Akun Anda akan langsung tertaut ke data penghuni yang dicatat
          pengelola. Jika kamar Anda sedang menunggu Pembayaran Awal, Anda akan
          diarahkan ke halaman pembayaran setelah masuk.
        </p>
      </div>
    </form>
  );
}
