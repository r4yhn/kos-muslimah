"use client";

import { UserPlus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import { NAMA_MAX, NAMA_MIN, PASSWORD_MIN } from "@/lib/profil-aturan";
import { LABEL_ROLE } from "@/lib/role";
import {
  btnPrimaryClass,
  errorBoxClass,
  fieldClass,
  helpClass,
  inputClass,
  labelClass,
  selectClass,
} from "@/lib/ui";
import { tambahAkunStaf, type AkunState } from "./actions";

/**
 * Form tambah akun staf (admin/pemilik). Email & password yang diisi langsung
 * bisa dipakai login — inilah cara menambah akun Pemilik Kos dari dalam
 * aplikasi tanpa perlu mengubah `.env`.
 */
export function TambahAkunForm() {
  const [state, formAction, isPending] = useActionState<AkunState, FormData>(
    tambahAkunStaf,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.sukses) formRef.current?.reset();
  }, [state?.sukses]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className={fieldClass}>
          <span className={labelClass}>Nama</span>
          <input
            type="text"
            name="nama"
            required
            minLength={NAMA_MIN}
            maxLength={NAMA_MAX}
            placeholder="cth: Pemilik Kos Pondok Muslimah"
            className={inputClass}
          />
        </label>

        <label className={fieldClass}>
          <span className={labelClass}>Email (Username Login)</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="off"
            placeholder="cth: pemilik@kosmuslimah.com"
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <label className={fieldClass}>
          <span className={labelClass}>Peran</span>
          <select name="peran" defaultValue="pemilik" className={selectClass}>
            <option value="pemilik">
              {LABEL_ROLE.pemilik} — pemantauan read-only
            </option>
            <option value="admin">
              {LABEL_ROLE.admin} — akses penuh panel
            </option>
          </select>
        </label>

        <label className={fieldClass}>
          <span className={labelClass}>Password</span>
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
          <span className={labelClass}>Ulangi Password</span>
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

      <span className={helpClass}>
        Email dipakai sebagai username saat login (tidak case-sensitive). Akun{" "}
        {LABEL_ROLE.pemilik} otomatis diarahkan ke halaman pemantauan{" "}
        <span className="font-mono text-primary">/monitoring</span> setelah masuk.
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
        <UserPlus aria-hidden className="size-4" />
        {isPending ? "Menyimpan…" : "Tambah Akun"}
      </button>
    </form>
  );
}
