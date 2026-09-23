"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";

import { NAMA_MAX, NAMA_MIN } from "@/lib/profil-aturan";
import {
  btnPrimaryClass,
  errorBoxClass,
  fieldClass,
  helpClass,
  inputClass,
  labelClass,
} from "@/lib/ui";
import { simpanProfil, type ProfilState } from "@/lib/profil-actions";

/**
 * Form ubah nama & email akun (dipakai di `/profil` dan `/monitoring/profil`).
 * Setelah tersimpan, sesi JWT disegarkan oleh server action sehingga header
 * langsung menampilkan identitas terbaru.
 */
export function ProfilIdentitasForm({
  nama,
  email,
}: {
  nama: string;
  email: string;
}) {
  const [state, formAction, isPending] = useActionState<ProfilState, FormData>(
    simpanProfil,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className={fieldClass}>
          <span className={labelClass}>Nama Lengkap</span>
          <input
            type="text"
            name="nama"
            required
            minLength={NAMA_MIN}
            maxLength={NAMA_MAX}
            defaultValue={nama}
            placeholder="cth: Admin Kos Pondok Muslimah"
            className={inputClass}
          />
        </label>

        <label className={fieldClass}>
          <span className={labelClass}>Email (username login)</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            defaultValue={email}
            placeholder="cth: admin@kosmuslimah.com"
            className={inputClass}
          />
        </label>
      </div>

      <span className={helpClass}>
        Email dipakai sebagai username saat masuk dan disimpan dalam huruf kecil.
        Pastikan emailnya aktif — email ini juga menjadi tujuan pemulihan akun.
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
        <Save aria-hidden className="size-4" />
        {isPending ? "Menyimpan…" : "Simpan Perubahan"}
      </button>
    </form>
  );
}
