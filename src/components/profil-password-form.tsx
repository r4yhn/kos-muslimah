"use client";

import { KeyRound } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import { PASSWORD_MIN } from "@/lib/profil-aturan";
import { gantiPassword, type ProfilState } from "@/lib/profil-actions";
import {
  btnPrimaryClass,
  errorBoxClass,
  fieldClass,
  helpClass,
  inputClass,
  labelClass,
} from "@/lib/ui";

/**
 * Form ganti password akun sendiri (dipakai di `/profil` dan
 * `/monitoring/profil`). Password lama diverifikasi di server; bila berhasil,
 * isi form direset dan password baru berlaku pada login berikutnya.
 */
export function ProfilPasswordForm() {
  const [state, formAction, isPending] = useActionState<ProfilState, FormData>(
    gantiPassword,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.sukses) formRef.current?.reset();
  }, [state?.sukses]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5">
      <label className={fieldClass}>
        <span className={labelClass}>Password Saat Ini</span>
        <input
          type="password"
          name="passwordLama"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className={inputClass}
        />
      </label>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className={fieldClass}>
          <span className={labelClass}>Password Baru</span>
          <input
            type="password"
            name="passwordBaru"
            required
            minLength={PASSWORD_MIN}
            autoComplete="new-password"
            placeholder={`minimal ${PASSWORD_MIN} karakter`}
            className={inputClass}
          />
        </label>

        <label className={fieldClass}>
          <span className={labelClass}>Ulangi Password Baru</span>
          <input
            type="password"
            name="konfirmasi"
            required
            minLength={PASSWORD_MIN}
            autoComplete="new-password"
            placeholder="ulangi password baru"
            className={inputClass}
          />
        </label>
      </div>

      <span className={helpClass}>
        Password baru minimal {PASSWORD_MIN} karakter dan harus berbeda dari
        password saat ini. Setelah diganti, sesi yang sedang aktif tetap berjalan
        — password baru dipakai saat login berikutnya.
      </span>

      {state?.error ? (
        <div role="alert" className={errorBoxClass}>
          <span>{state.error}</span>
        </div>
      ) : null}

      {state?.sukses ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2.5 text-sm text-emerald-100"
        >
          <span>{state.sukses}</span>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className={`${btnPrimaryClass} self-start`}
      >
        <KeyRound aria-hidden className="size-4" />
        {isPending ? "Menyimpan…" : "Ganti Password"}
      </button>
    </form>
  );
}
