import type { Metadata } from "next";
import { ShieldCheck, UserCog, UserPlus, Users2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { daftarAkunStaf } from "@/lib/akun";
import { formatTanggal } from "@/lib/format";
import { LABEL_ROLE, berandaPeran } from "@/lib/role";
import { btnSecondaryClass, cardClass, eyebrowClass, headingClass } from "@/lib/ui";
import { ResetPasswordForm, UbahAkunForm } from "./aksi-akun-forms";
import { TambahAkunForm } from "./tambah-akun-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kelola Akun",
};

/**
 * Halaman "Kelola Akun" (khusus pengelola/admin).
 *
 * Mengelola akun staf — `admin` (pengelola) & `pemilik` (Pemilik Kos): melihat
 * email/username, membuat akun baru (lengkap dengan password), mengubah
 * nama/email, dan mereset password. Dengan begitu akun Pemilik Kos dapat
 * dibuat & diatur langsung dari web tanpa mengubah `.env` atau menjalankan
 * perintah CLI.
 *
 * Akun `penghuni` tidak dikelola di sini (terikat data penghuni & dibuat lewat
 * pendaftaran/aktivasi portal).
 */
export default async function AkunPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") {
    redirect(berandaPeran(session.user.role));
  }

  const daftar = await daftarAkunStaf();
  const jumlahAdmin = daftar.filter((a) => a.peran === "admin").length;
  const jumlahPemilik = daftar.filter((a) => a.peran === "pemilik").length;

  const kartu = [
    {
      label: "Total Akun Staf",
      nilai: daftar.length,
      ikon: Users2,
      kelas: "text-white",
    },
    {
      label: `${LABEL_ROLE.admin} (Admin)`,
      nilai: jumlahAdmin,
      ikon: UserCog,
      kelas: "text-primary",
    },
    {
      label: `${LABEL_ROLE.pemilik} (Pemilik)`,
      nilai: jumlahPemilik,
      ikon: ShieldCheck,
      kelas: "text-emerald-300",
    },
  ];

  return (
    <div className="flex w-full flex-col gap-6">
      {/* Judul */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={eyebrowClass}>Kelola · Akun</p>
          <h1 className={headingClass}>Kelola Akun Staf</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
            Buat dan atur akun <strong>{LABEL_ROLE.pemilik}</strong> serta{" "}
            <strong>{LABEL_ROLE.admin}</strong> dari sini: email dipakai sebagai
            username login, password diisi saat membuat akun atau direset bila
            lupa. Akun {LABEL_ROLE.pemilik} hanya bisa membuka area pemantauan
            read-only.
          </p>
        </div>
        <Link href="/profil" className={btnSecondaryClass}>
          <UserCog aria-hidden className="size-4" />
          Profil Akun Saya
        </Link>
      </section>

      {/* Ringkasan */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kartu.map((k) => (
          <article key={k.label} className={`${cardClass} p-4`}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary/60">
                {k.label}
              </p>
              <k.ikon aria-hidden className="size-4 shrink-0 text-primary/50" />
            </div>
            <p
              className={`mt-2 text-3xl font-bold leading-none tabular-nums ${k.kelas}`}
            >
              {k.nilai}
            </p>
          </article>
        ))}
      </section>

      {/* Form tambah akun */}
      <section className={`${cardClass} p-5 sm:p-6`}>
        <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-white">
          <UserPlus aria-hidden className="size-5 text-primary" />
          Tambah Akun Staf
        </h2>
        <p className="mb-5 mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
          Isi nama, email (username login), peran, dan password. Akun langsung
          aktif dan dapat dipakai masuk ke sistem.
        </p>
        <TambahAkunForm />
      </section>

      {/* Daftar akun staf */}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-bold tracking-tight text-white">
          Daftar Akun Staf ({daftar.length})
        </h2>

        {daftar.map((a) => {
          const akunSaya = a.id === session.user.id;
          const badgeKelas =
            a.peran === "admin"
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";

          return (
            <article key={a.id} className={`${cardClass} p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-bold leading-tight text-white">
                    {a.nama}
                    {akunSaya ? (
                      <span className="rounded-full border border-white/20 bg-white/5 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-white/60">
                        akun Anda
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1.5 break-all font-mono text-xs leading-tight text-white/60">
                    {a.email}
                  </p>
                  <p className="mt-1 font-mono text-[10px] leading-tight text-white/35">
                    Dibuat {formatTanggal(a.createdAt)}
                  </p>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium leading-none ${badgeKelas}`}
                >
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full bg-current"
                  />
                  {LABEL_ROLE[a.peran]} · {a.peran}
                </span>
              </div>

              {akunSaya ? (
                <p className="mt-4 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs leading-relaxed text-white/60">
                  Ini akun Anda sendiri. Untuk mengubah nama, email, atau
                  password akun Anda, gunakan{" "}
                  <Link
                    href="/profil"
                    className="font-bold text-primary underline-offset-4 hover:underline"
                  >
                    halaman Profil
                  </Link>{" "}
                  (wajib memasukkan password lama).
                </p>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-5 border-t border-white/10 pt-4 lg:grid-cols-2">
                  <div>
                    <h3 className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary/70">
                      Ubah Nama &amp; Email
                    </h3>
                    <UbahAkunForm idAkun={a.id} nama={a.nama} email={a.email} />
                  </div>
                  <div className="lg:border-l lg:border-white/10 lg:pl-5">
                    <h3 className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-primary/70">
                      Reset Password
                    </h3>
                    <ResetPasswordForm idAkun={a.id} />
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
