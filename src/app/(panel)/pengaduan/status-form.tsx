"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";

import {
  LABEL_STATUS_PENGADUAN,
  STATUS_PENGADUAN,
  type StatusPengaduan,
} from "@/lib/pengaduan-status";
import {
  btnPrimaryClass,
  errorBoxClass,
  fieldClass,
  helpClass,
  labelClass,
  selectClass,
  textareaClass,
} from "@/lib/ui";
import { simpanStatusPengaduan, type StatusPengaduanState } from "./actions";

type Props = {
  idPengaduan: string;
  statusSaatIni: StatusPengaduan;
  catatanSaatIni: string | null;
};

/**
 * Form pembaruan status pengaduan per baris (khusus pengelola). Catatan hasil
 * verifikasi lapangan wajib diisi untuk status Diproses/Selesai.
 */
export function StatusPengaduanForm({
  idPengaduan,
  statusSaatIni,
  catatanSaatIni,
}: Props) {
  const [state, formAction, isPending] = useActionState<
    StatusPengaduanState,
    FormData
  >(simpanStatusPengaduan, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="idPengaduan" value={idPengaduan} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(180px,220px)_1fr]">
        <label className={fieldClass}>
          <span className={labelClass}>Status Penanganan</span>
          <select
            name="status"
            defaultValue={statusSaatIni}
            className={selectClass}
          >
            {STATUS_PENGADUAN.map((s) => (
              <option key={s} value={s}>
                {LABEL_STATUS_PENGADUAN[s]}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldClass}>
          <span className={labelClass}>Catatan Verifikasi Lapangan</span>
          <textarea
            name="catatanAdmin"
            rows={2}
            defaultValue={catatanSaatIni ?? ""}
            placeholder="cth: Dicek ke kamar — selang diganti, air lancar kembali."
            className={textareaClass}
          />
        </label>
      </div>

      <span className={helpClass}>
        Wajib diisi bila status diubah ke <em>Diproses</em> atau <em>Selesai</em>{" "}
        — catatan ini dibaca penghuni &amp; Pemilik Kos sebagai bukti penanganan.
      </span>

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
        className={`${btnPrimaryClass} self-start`}
      >
        <Save aria-hidden className="size-4" />
        {isPending ? "Menyimpan…" : "Perbarui Status"}
      </button>
    </form>
  );
}
