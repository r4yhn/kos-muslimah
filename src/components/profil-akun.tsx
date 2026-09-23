import { CalendarClock, Mail, ShieldCheck, UserRound } from "lucide-react";

import { ProfilIdentitasForm } from "@/components/profil-identitas-form";
import { ProfilPasswordForm } from "@/components/profil-password-form";
import { formatTanggal } from "@/lib/format";
import type { ProfilAkun } from "@/lib/profil";
import { LABEL_ROLE } from "@/lib/role";
import { cardClass, eyebrowClass, headingClass } from "@/lib/ui";

type Props = {
  profil: ProfilAkun;
  /** Area tempat halaman dibuka — hanya untuk penyesuaian teks. */
  area: "panel" | "monitoring";
};

/**
 * Isi halaman "Ubah Password & Profil" (Roadmap 2D) yang dipakai bersama:
 * - `/profil` untuk admin/pengelola;
 * - `/monitoring/profil` untuk Pemilik Kos.
 *
 * Semua perubahan di sini hanya menyentuh **akun milik pengguna sendiri**, bukan
 * data kamar/penghuni/pembayaran/pengaduan.
 */
export function ProfilAkunView({ profil, area }: Props) {
  const diPanel = area === "panel";

  const identitas = [
    { label: "Nama", nilai: profil.nama, ikon: UserRound },
    { label: "Email (Username)", nilai: profil.email, ikon: Mail },
    { label: "Peran Akun", nilai: LABEL_ROLE[profil.peran], ikon: ShieldCheck },
    {
      label: "Akun Dibuat",
      nilai: formatTanggal(profil.createdAt),
      ikon: CalendarClock,
    },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Judul */}
      <section>
        <p className={eyebrowClass}>
          {diPanel ? "Akun · Pengelola" : "Pemantauan · Akun Pemilik"}
        </p>
        <h1 className={headingClass}>Profil &amp; Keamanan Akun</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
          {diPanel ? (
            <>
              Perbarui nama dan email akun pengelola, atau ganti password untuk
              menjaga keamanan akses panel manajemen kos.
            </>
          ) : (
            <>
              Perbarui nama dan email akun Pemilik Kos, atau ganti password
              secara mandiri. Area pemantauan bersifat <em>read-only</em> untuk
              data kos, tetapi data akun Anda sendiri tetap dapat diubah di sini.
            </>
          )}
        </p>
      </section>

      {/* Ringkasan identitas akun */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {identitas.map((i) => (
          <article key={i.label} className={`${cardClass} p-4`}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary/60">
                {i.label}
              </p>
              <i.ikon aria-hidden className="size-4 shrink-0 text-primary/50" />
            </div>
            <p className="mt-2 break-words font-bold leading-relaxed text-white">
              {i.nilai}
            </p>
          </article>
        ))}
      </section>

      {/* Form identitas */}
      <section className={`${cardClass} p-5 sm:p-6`}>
        <h2 className="font-display text-xl font-bold tracking-tight text-white">
          Data Akun
        </h2>
        <p className="mb-5 mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
          Nama tampil pada header aplikasi; email dipakai sebagai username login
          dan harus unik antar akun.
        </p>
        <ProfilIdentitasForm nama={profil.nama} email={profil.email} />
      </section>

      {/* Form password */}
      <section className={`${cardClass} p-5 sm:p-6`}>
        <h2 className="font-display text-xl font-bold tracking-tight text-white">
          Ubah Password
        </h2>
        <p className="mb-5 mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
          Gunakan password yang kuat dan tidak dipakai di layanan lain. Password
          lama wajib diisi sebagai konfirmasi.
        </p>
        <ProfilPasswordForm />
      </section>
    </div>
  );
}
