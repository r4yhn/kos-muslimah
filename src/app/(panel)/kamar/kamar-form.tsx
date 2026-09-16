"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  btnPrimaryClass,
  btnSecondaryClass,
  errorBoxClass,
  fieldClass,
  helpClass,
  inputClass,
  labelClass,
  selectClass,
} from "@/lib/ui";
import { simpanKamar, type KamarState } from "./actions";

export type KamarFormValue = {
  id?: string;
  noKamar?: string;
  tipeKamar?: string;
  hargaSewa?: number;
  statusKamar?: "Tersedia" | "Terisi" | "Perbaikan";
  /** Kamar terisi penghuni aktif — status dikunci otomatis. */
  terkunci?: boolean;
};

/** Form tambah & edit kamar (client) — memakai server action simpanKamar. */
export function KamarForm({ defaultValue }: { defaultValue?: KamarFormValue }) {
  const [state, formAction, isPending] = useActionState<KamarState, FormData>(
    simpanKamar,
    undefined
  );
  const isEdit = Boolean(defaultValue?.id);
  const terkunci = defaultValue?.terkunci === true;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {defaultValue?.id ? (
        <input type="hidden" name="id" value={defaultValue.id} />
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className={fieldClass}>
          <span className={labelClass}>Nomor Kamar</span>
          <input
            type="text"
            name="noKamar"
            required
            placeholder="cth: A-01"
            defaultValue={defaultValue?.noKamar ?? ""}
            className={inputClass}
          />
        </label>

        <label className={fieldClass}>
          <span className={labelClass}>Tipe Kamar</span>
          <input
            type="text"
            name="tipeKamar"
            required
            placeholder="cth: Standard"
            defaultValue={defaultValue?.tipeKamar ?? ""}
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className={fieldClass}>
          <span className={labelClass}>Harga Sewa / Bulan (Rp)</span>
          <input
            type="number"
            name="hargaSewa"
            required
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="cth: 500000"
            defaultValue={defaultValue?.hargaSewa ?? ""}
            className={inputClass}
          />
        </label>

        {terkunci ? (
          <div className={fieldClass}>
            <span className={labelClass}>Status</span>
            <input type="hidden" name="statusKamar" value="Terisi" />
            <div
              className={`${inputClass} flex cursor-not-allowed items-center justify-between opacity-80`}
            >
              <span>Terisi</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/40">
                otomatis
              </span>
            </div>
            <span className={helpClass}>
              Kamar sedang terisi penghuni aktif — status dikelola otomatis.
            </span>
          </div>
        ) : (
          <label className={fieldClass}>
            <span className={labelClass}>Status</span>
            <select
              name="statusKamar"
              defaultValue={defaultValue?.statusKamar ?? "Tersedia"}
              className={selectClass}
            >
              <option value="Tersedia">Tersedia</option>
              {isEdit ? <option value="Terisi">Terisi</option> : null}
              <option value="Perbaikan">Perbaikan</option>
            </select>
            {isEdit ? (
              <span className={helpClass}>
                Status &quot;Terisi&quot; biasanya dikelola otomatis saat
                penghuni terdaftar.
              </span>
            ) : null}
          </label>
        )}
      </div>

      {state?.error ? (
        <div role="alert" className={errorBoxClass}>
          {state.error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={isPending} className={btnPrimaryClass}>
          {isPending
            ? "Menyimpan…"
            : isEdit
              ? "Simpan Perubahan"
              : "Tambah Kamar"}
        </button>
        <Link href="/kamar" className={btnSecondaryClass}>
          Batal
        </Link>
      </div>
    </form>
  );
}
