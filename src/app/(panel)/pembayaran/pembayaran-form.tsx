"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  NAMA_BULAN,
  daftarTahun,
  tanggalInputHariIni,
  toTanggalInput,
} from "@/lib/format";
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
import { simpanPembayaran, type PembayaranState } from "./actions";

const METODE = ["Cash", "Transfer", "E-Wallet", "Lainnya"] as const;

export type PembayaranFormValue = {
  id?: string;
  idPenghuni?: string;
  bulan?: number;
  tahun?: number;
  jumlahBayar?: number;
  metodeBayar?: string;
  statusBayar?: string;
  keterangan?: string | null;
  tanggalBayar?: Date | string | null;
  jatuhTempo?: Date | string | null;
};

export type PenghuniOption = {
  id: string;
  nama: string;
  noKamar: string | null;
  status: string;
};

type PembayaranFormProps = {
  defaultValue?: PembayaranFormValue;
  penghuniOptions: PenghuniOption[];
};

const TAHUN_OPTIONS = daftarTahun();

function namaPenghuniOption(p: PenghuniOption): string {
  const kamar = p.noKamar ? `Kamar ${p.noKamar}` : "Tanpa kamar";
  const status = p.status === "Aktif" ? "" : ` · ${p.status}`;
  return `${p.nama} — ${kamar}${status}`;
}

/** Form catat/edit pembayaran sewa (client) — server action simpanPembayaran. */
export function PembayaranForm({
  defaultValue,
  penghuniOptions,
}: PembayaranFormProps) {
  const [state, formAction, isPending] = useActionState<
    PembayaranState,
    FormData
  >(simpanPembayaran, undefined);

  const isEdit = Boolean(defaultValue?.id);
  const sekarang = new Date();
  const bulanAwal = defaultValue?.bulan ?? sekarang.getMonth() + 1;
  const tahunAwal = defaultValue?.tahun ?? sekarang.getFullYear();
  const tanggalAwal = defaultValue?.tanggalBayar
    ? toTanggalInput(defaultValue.tanggalBayar)
    : tanggalInputHariIni();
  const jatuhTempoAwal = defaultValue?.jatuhTempo
    ? toTanggalInput(defaultValue.jatuhTempo)
    : "";

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {defaultValue?.id ? (
        <input type="hidden" name="id" value={defaultValue.id} />
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className={fieldClass}>
          <span className={labelClass}>Penghuni</span>
          <select
            name="idPenghuni"
            required
            disabled={isEdit}
            defaultValue={defaultValue?.idPenghuni ?? ""}
            className={`${selectClass} ${isEdit ? "cursor-not-allowed opacity-80" : ""}`}
          >
            {!isEdit ? <option value="">— Pilih penghuni —</option> : null}
            {penghuniOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {namaPenghuniOption(p)}
              </option>
            ))}
          </select>
          {isEdit ? (
            <span className={helpClass}>
              Penghuni tidak dapat diubah pada catatan yang sudah ada.
            </span>
          ) : null}
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className={fieldClass}>
            <span className={labelClass}>Bulan</span>
            <select name="bulan" defaultValue={bulanAwal} className={selectClass}>
              {NAMA_BULAN.map((nama, index) => (
                <option key={nama} value={index + 1}>
                  {nama}
                </option>
              ))}
            </select>
          </label>

          <label className={fieldClass}>
            <span className={labelClass}>Tahun</span>
            <select name="tahun" defaultValue={tahunAwal} className={selectClass}>
              {TAHUN_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className={fieldClass}>
          <span className={labelClass}>Tanggal Bayar</span>
          <input
            type="date"
            name="tanggalBayar"
            required
            defaultValue={tanggalAwal}
            className={inputClass}
          />
        </label>

        <label className={fieldClass}>
          <span className={labelClass}>Jumlah Bayar (Rp)</span>
          <input
            type="number"
            name="jumlahBayar"
            required
            min={1}
            step={1}
            inputMode="numeric"
            placeholder="cth: 500000"
            defaultValue={defaultValue?.jumlahBayar ?? ""}
            className={inputClass}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className={fieldClass}>
          <span className={labelClass}>Metode Bayar</span>
          <select
            name="metodeBayar"
            defaultValue={defaultValue?.metodeBayar ?? "Cash"}
            className={selectClass}
          >
            {METODE.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className={fieldClass}>
          <span className={labelClass}>Status Bayar</span>
          <select
            name="statusBayar"
            defaultValue={defaultValue?.statusBayar ?? "Lunas"}
            className={selectClass}
          >
            <option value="Lunas">Lunas</option>
            <option value="Belum Lunas">Belum Lunas</option>
          </select>
          <span className={helpClass}>
            Gunakan &quot;Belum Lunas&quot; untuk mencatat tagihan yang belum
            dibayar penghuni.
          </span>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className={fieldClass}>
          <span className={labelClass}>Jatuh Tempo (opsional)</span>
          <input
            type="date"
            name="jatuhTempo"
            defaultValue={jatuhTempoAwal}
            className={inputClass}
          />
          <span className={helpClass}>
            Batas akhir pembayaran tagihan. Umumnya terisi otomatis pada
            tagihan &quot;Belum Lunas&quot; yang diterbitkan sistem.
          </span>
        </label>
      </div>

      <label className={fieldClass}>
        <span className={labelClass}>Keterangan (opsional)</span>
        <textarea
          name="keterangan"
          placeholder="cth: Pembayaran sewa bulan ke-3 sekaligus"
          defaultValue={defaultValue?.keterangan ?? ""}
          className={textareaClass}
        />
      </label>

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
              : "Catat Pembayaran"}
        </button>
        <Link href="/pembayaran" className={btnSecondaryClass}>
          Batal
        </Link>
      </div>
    </form>
  );
}

