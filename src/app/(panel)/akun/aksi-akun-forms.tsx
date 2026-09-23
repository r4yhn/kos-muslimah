"use client";

import { KeyRound, Save } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import { NAMA_MAX, NAMA_MIN, PASSWORD_MIN } from "@/lib/profil-aturan";
import {
  btnSecondaryClass,
  errorBoxClass,
  fieldClass,
  inputClass,
  labelClass,
} from "@/lib/ui";
import { resetPasswordStaf, ubahAkunStaf, type AkunState } from "./actions";

/** Form ubah nama & email satu akun staf (per baris daftar akun). */
export function UbahAkunForm({
  idAkun,
  nama,
  email,
}: {
  idAkun: string;
  nama: string;
  email: string;
}) {
  const [state, formAction, isPending] = useActionState<AkunState, FormData>(
    ubahAkunStaf,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="idAkun" value={idAkun} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={fieldClass}>
          <span className={labelClass}>Nama</span>
          <input
            type="text"
            name="nama"
            required
            minLength={NAMA_MIN}
            maxLength={NAMA_MAX}
            defaultValue={nama}
            className={inputClass}
          />
        </label>
        <label className={fieldClass}>
          <span className={labelClass}>Email (Username)</span>
          <input
            type="email"
            name="email"
            required
            defaultValue={email}
            className={inputClass}
          />
        </label>
      </div>

      {state?.error ? (
        <div role="alert" className={errorBoxClass}>
          <span>{state.error}</span>
        </div>
      ) : null}

      {state?.sukses ? (
        <p role="status" className="text-xs font-bold text-emerald-300">
          ✓ {state.sukses}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className={`${btnSecondaryClass} self-start`}
      >
        <Save aria-hidden className="size-4" />
        {isPending ? "Menyimpan…" : "Simpan Perubahan"}
      </button>
    </form>
  );
}

/**
 * Form reset password satu akun staf — tanpa perlu password lama (khusus
 * pengelola). Untuk akun sendiri, gunakan halaman Profil.
 */
export function ResetPasswordForm({ idAkun }: { idAkun: string }) {
  const [state, formAction, isPending] = useActionState<AkunState, FormData>(
    resetPasswordStaf,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.sukses) formRef.current?.reset();
  }, [state?.sukses]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="idAkun" value={idAkun} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={fieldClass}>
          <span className={labelClass}>Password Baru</span>
          <input
            type="password"
            name="password"
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
            placeholder="ulangi password"
            className={inputClass}
          />
        </label>
      </div>

      {state?.error ? (
        <div role="alert" className={errorBoxClass}>
          <span>{state.error}</span>
        </div>
      ) : null}

      {state?.sukses ? (
        <p role="status" className="text-xs font-bold text-emerald-300">
          ✓ {state.sukses}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className={`${btnSecondaryClass} self-start`}
      >
        <KeyRound aria-hidden className="size-4" />
        {isPending ? "Menyimpan…" : "Reset Password"}
      </button>
    </form>
  );
}
