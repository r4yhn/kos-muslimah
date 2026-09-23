"use client";

import { LockKeyhole, Mail } from "lucide-react";
import { useActionState } from "react";

import {
  btnPrimaryClass,
  errorBoxClass,
  fieldClass,
  helpClass,
  inputClass,
  labelClass,
  selectClass,
  textareaClass,
} from "@/lib/ui";
import { formatIDR, tanggalInputHariIni } from "@/lib/format";
import { KAPASITAS_KAMAR, labelPenghuniKamar } from "@/lib/kapasitas-kamar";
import { daftarPenghuni, type DaftarState } from "./actions";

export type KamarDaftarOption = {
  id: string;
  noKamar: string;
  hargaSewa: number;
  /** Jumlah penghuni aktif saat ini (termasuk yang menunggu bayar awal). */
  terisi: number;
  /** Sisa slot kamar (maksimal KAPASITAS_KAMAR penghuni per kamar). */
  sisaSlot: number;
};

type DaftarFormProps = {
  kamarOptions: KamarDaftarOption[];
};

/** Form registrasi mandiri penghuni baru (halaman publik /daftar). */
export function DaftarForm({ kamarOptions }: DaftarFormProps) {
  const [state, formAction, isPending] = useActionState<DaftarState, FormData>(
    daftarPenghuni,
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
            placeholder="Nama sesuai identitas"
            className={inputClass}
          />
        </label>

        <label className={fieldClass}>
          <span className={labelClass}>Jenis Kelamin</span>
          <select
            name="jenisKelamin"
            defaultValue="Perempuan"
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
            className={inputClass}
          />
        </label>

        <label className={fieldClass}>
          <span className={labelClass}>Tanggal Masuk</span>
          <input
            type="date"
            name="tglMasuk"
            required
            defaultValue={tanggalInputHariIni()}
            className={inputClass}
          />
        </label>
      </div>

      <label className={fieldClass}>
        <span className={labelClass}>Alamat Asal</span>
        <textarea
          name="alamat"
          required
          placeholder="Alamat lengkap di luar kos"
          className={textareaClass}
        />
      </label>

      <label className={fieldClass}>
        <span className={labelClass}>Pilih Kamar</span>
        <select name="idKamar" required defaultValue="" className={selectClass}>
          <option value="" disabled>
            — Pilih kamar yang masih tersedia —
          </option>
          {kamarOptions.map((k) => (
            <option key={k.id} value={k.id}>
              Kamar {k.noKamar} · {formatIDR.format(k.hargaSewa)}/bulan ·{" "}
              {labelPenghuniKamar(k.terisi)} terisi (sisa {k.sisaSlot} slot)
            </option>
          ))}
        </select>
        <span className={helpClass}>
          Setiap kamar dapat ditempati maksimal {KAPASITAS_KAMAR} penghuni, dan
          setiap penghuni punya akun portal sendiri (email &amp; password
          berbeda). Kamar resmi berstatus Terisi setelah Pembayaran Awal lunas.
        </span>
      </label>

      <fieldset className="rounded-md border border-primary/20 p-4">
        <legend className="px-1 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
          Akun Login Anda
        </legend>
        <p className="mb-4 text-xs leading-relaxed text-white/50">
          Email &amp; password ini digunakan untuk masuk ke portal penghuni.
          Simpan baik-baik — jangan bagikan kepada siapa pun.
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className={fieldClass}>
            <span className={labelClass}>Email</span>
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
          {isPending ? "Mendaftarkan…" : "Daftar & Lanjut ke Pembayaran"}
        </button>
        <p className="text-xs leading-relaxed text-white/45">
          Dengan mendaftar, Anda menyetujui aturan kos, termasuk pembayaran awal
          sewa di muka sebelum kamar resmi aktif.
        </p>
      </div>
    </form>
  );
}
