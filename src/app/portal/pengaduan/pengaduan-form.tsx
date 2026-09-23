"use client";

import { Send, ShieldCheck } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import {
  btnPrimaryClass,
  errorBoxClass,
  fieldClass,
  helpClass,
  labelClass,
  textareaClass,
} from "@/lib/ui";
import { DESKRIPSI_MAX, DESKRIPSI_MIN } from "@/lib/pengaduan-status";
import { kirimPengaduan, type PengaduanState } from "./actions";

/**
 * Form laporan kendala kamar untuk penghuni. Setelah berhasil terkirim, isi
 * form direset agar siap dipakai melaporkan kendala berikutnya.
 */
export function PengaduanForm() {
  const [state, formAction, isPending] = useActionState<
    PengaduanState,
    FormData
  >(kirimPengaduan, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.sukses) formRef.current?.reset();
  }, [state?.sukses]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <label className={fieldClass}>
        <span className={labelClass}>Deskripsi Kendala Kamar</span>
        <textarea
          name="deskripsiKendala"
          required
          minLength={DESKRIPSI_MIN}
          maxLength={DESKRIPSI_MAX}
          rows={5}
          placeholder="cth: Keran kamar mandi bocor sejak 2 hari lalu sehingga lantai menggenang dan licin."
          className={textareaClass}
        />
        <span className={helpClass}>
          Jelaskan sedetail mungkin: jenis kendala, bagian kamar yang bermasalah,
          dan sejak kapan terjadi. Status awal laporan adalah{" "}
          <strong className="font-mono text-amber-300">Pending</strong> hingga
          pengelola memverifikasi di lapangan.
        </span>
      </label>

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
          <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-300" />
          <span>{state.sukses}</span>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className={`${btnPrimaryClass} self-start`}
      >
        <Send aria-hidden className="size-4" />
        {isPending ? "Mengirim…" : "Kirim Pengaduan"}
      </button>
    </form>
  );
}
