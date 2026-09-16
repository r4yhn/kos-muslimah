import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { penghuni, users } from "@/db/schema";
import { cardClass, eyebrowClass, headingClass } from "@/lib/ui";
import { kamarBisaDitempati } from "@/lib/kamar-options";
import { PenghuniForm } from "../../penghuni-form";

export const dynamic = "force-dynamic";

export default async function EditPenghuniPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const [baris] = await db
    .select()
    .from(penghuni)
    .where(eq(penghuni.id, id))
    .limit(1);
  if (!baris) notFound();

  // Opsi kamar: kamar berstatus Tersedia & tidak sedang dipesan penghuni
  // lain yang menunggu pembayaran awal; kamar miliknya sendiri tetap muncul.
  const kamarOptions = await kamarBisaDitempati({
    kecualiPenghuniId: baris.id,
    termasukKamarId: baris.idKamar ?? undefined,
  });

  // Email akun portal (bila penghuni ini punya akun login).
  const [akun] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.idPenghuni, baris.id))
    .limit(1);

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <Link
          href="/penghuni"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm text-white/60 transition-colors duration-[100ms] ease-brand hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Kembali ke Data Penghuni
        </Link>
        <p className={`${eyebrowClass} mt-4`}>Penghuni · Edit</p>
        <h1 className={headingClass}>Edit {baris.nama}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
          Perbarui data penghuni. Pemindahan kamar hanya bisa ke kamar yang
          berstatus{" "}
          <span className="font-mono text-primary">Tersedia</span>.
        </p>
      </div>

      <div className={`${cardClass} p-6`}>
        <PenghuniForm
          kamarOptions={kamarOptions}
          akunEmail={akun?.email ?? null}
          defaultValue={{
            id: baris.id,
            nama: baris.nama,
            jenisKelamin: baris.jenisKelamin as "Perempuan" | "Laki-laki",
            alamat: baris.alamat,
            noHp: baris.noHp,
            tglMasuk: baris.tglMasuk,
            idKamar: baris.idKamar,
            status: baris.status,
          }}
        />
      </div>
    </div>
  );
}

