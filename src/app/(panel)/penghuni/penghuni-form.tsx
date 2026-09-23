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
  textareaClass,
} from "@/lib/ui";
import { toTanggalInput, tanggalInputHariIni } from "@/lib/format";
import { KAPASITAS_KAMAR, labelPenghuniKamar } from "@/lib/kapasitas-kamar";
import { simpanPenghuni, type PenghuniState } from "./actions";

export type PenghuniFormValue = {
  id?: string;
  nama?: string;
  jenisKelamin?: "Perempuan" | "Laki-laki";
  alamat?: string;
  noHp?: string;
  tglMasuk?: Date | string;
  idKamar?: string | null;
  status?: "Aktif" | "Keluar";
};

export type KamarOption = {
  id: string;
  noKamar: string;
  statusKamar: string;
  /** Jumlah penghuni aktif saat ini (termasuk yang menunggu bayar awal). */
  terisi: number;
  /** Sisa slot kamar (maksimal KAPASITAS_KAMAR penghuni per kamar). */
  sisaSlot: number;
};

type PenghuniFormProps = {
  defaultValue?: PenghuniFormValue;
  /** Daftar kamar pilihan (biasanya hanya berstatus Tersedia). */
  kamarOptions: KamarOption[];
  /** Email akun portal penghuni (tampil read-only saat edit, bila ada). */
  akunEmail?: string | null;
};

/** Form tambah & edit penghuni (client) — server action simpanPenghuni. */
export function PenghuniForm({
  defaultValue,
  kamarOptions,
  akunEmail = null,
}: PenghuniFormProps) {
  const [state, formAction, isPending] = useActionState<
    PenghuniState,
    FormData
  >(simpanPenghuni, undefined);

  const isEdit = Boolean(defaultValue?.id);
  const isKeluar = defaultValue?.status === "Keluar";
  const tanggalAwal = defaultValue?.tglMasuk
    ? toTanggalInput(defaultValue.tglMasuk)
    : tanggalInputHariIni();

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {defaultValue?.id ? (
        <input type="hidden" name="id" value={defaultValue.id} />
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className={fieldClass}>
          <span className={labelClass}>Nama Lengkap</span>
          <input
            type="text"
            name="nama"
            required
            placeholder="Nama penghuni"
            defaultValue={defaultValue?.nama ?? ""}
            className={inputClass}
          />
        </label>

        <label className={fieldClass}>
          <span className={labelClass}>Jenis Kelamin</span>
          <select
            name="jenisKelamin"
            defaultValue={defaultValue?.jenisKelamin ?? "Perempuan"}
            className={selectClass}
          >
            <option value="Perempuan">Perempuan</option>
            <option value="Laki-laki">Laki-laki</option>
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className={fieldClass}>
          <span className={labelClass}>Nomor HP / WA</span>
          <input
            type="tel"
            name="noHp"
            required
            placeholder="cth: 0812-3456-7890"
            defaultValue={defaultValue?.noHp ?? ""}
            className={inputClass}
          />
        </label>

        <label className={fieldClass}>
          <span className={labelClass}>Tanggal Masuk</span>
          <input
            type="date"
            name="tglMasuk"
            required
            defaultValue={tanggalAwal}
            className={inputClass}
          />
        </label>
      </div>

      <label className={fieldClass}>
        <span className={labelClass}>Alamat Asal</span>
        <textarea
          name="alamat"
          required
          placeholder="Alamat lengkap sesuai KTP/domisili"
          defaultValue={defaultValue?.alamat ?? ""}
          className={textareaClass}
        />
      </label>

      {isKeluar ? (
        <div className={fieldClass}>
          <span className={labelClass}>Kamar</span>
          <div className={`${inputClass} flex items-center opacity-80`}>
            <span>Keluar — tidak memiliki kamar</span>
          </div>
          <span className={helpClass}>
            Data penghuni berstatus keluar tidak dapat ditempatkan di kamar.
          </span>
        </div>
      ) : (
        <label className={fieldClass}>
          <span className={labelClass}>
            Kamar (maks. {KAPASITAS_KAMAR} penghuni / kamar)
          </span>
          <select
            name="idKamar"
            defaultValue={defaultValue?.idKamar ?? ""}
            className={selectClass}
          >
            <option value="">— Tanpa kamar —</option>
            {kamarOptions.map((k) => (
              <option key={k.id} value={k.id}>
                {k.noKamar} · {labelPenghuniKamar(k.terisi)} terisi (sisa{" "}
                {k.sisaSlot} slot)
                {k.statusKamar !== "Tersedia" ? ` · ${k.statusKamar}` : ""}
              </option>
            ))}
          </select>
          <span className={helpClass}>
            {isEdit
              ? "Kamar milik penghuni ini tetap ditampilkan sebagai pilihan. Satu kamar boleh dihuni maksimal " +
                `${KAPASITAS_KAMAR} penghuni.`
              : `Kamar otomatis berstatus "Terisi" — kecuali bila Anda membuatkan akun portal: kamar menunggu Pembayaran Awal penghuni (aturan "Bayar di Awal"). Satu kamar maksimal ${KAPASITAS_KAMAR} penghuni, masing-masing berakun sendiri.`}
          </span>
        </label>
      )}

      {akunEmail ? (
        <div className={fieldClass}>
          <span className={labelClass}>Akun Login Portal</span>
          <div
            className={`${inputClass} flex items-center justify-between gap-2 opacity-90`}
          >
            <span className="truncate">{akunEmail}</span>
            <span className="shrink-0 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-emerald-300">
              Penghuni
            </span>
          </div>
          <span className={helpClass}>
            Penghuni ini sudah memiliki akun untuk login ke portal penghuni
            (/portal). Email akun tidak dapat diubah dari form ini.
          </span>
        </div>
      ) : null}

      {!isEdit ? (
        <fieldset className="rounded-md border border-primary/20 p-4">
          <legend className="px-1 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
            Akun Login Penghuni — opsional (Bayar di Awal)
          </legend>
          <p className="mb-4 text-xs leading-relaxed text-white/50">
            Isi email &amp; password bila penghuni baru akan login sendiri ke
            portal. Saat pertama login, menu otomatis dikunci &amp; diarahkan
            ke halaman <em>Pembayaran Awal</em>; kamar baru resmi aktif setelah
            tagihan awal lunas.
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className={fieldClass}>
              <span className={labelClass}>Email Akun</span>
              <input
                type="email"
                name="emailAkun"
                autoComplete="off"
                placeholder="cth: siti@email.com"
                className={inputClass}
              />
            </label>
            <label className={fieldClass}>
              <span className={labelClass}>Password Akun</span>
              <input
                type="password"
                name="passwordAkun"
                autoComplete="new-password"
                minLength={6}
                placeholder="Minimal 6 karakter"
                className={inputClass}
              />
            </label>
          </div>
        </fieldset>
      ) : null}

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
              : "Daftarkan Penghuni"}
        </button>
        <Link href="/penghuni" className={btnSecondaryClass}>
          Batal
        </Link>
      </div>
    </form>
  );
}
