import { and, count, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { kamar, penghuni } from "@/db/schema";
import { cardClass, eyebrowClass, headingClass } from "@/lib/ui";
import { KamarForm } from "../../kamar-form";

export const dynamic = "force-dynamic";

export default async function EditKamarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const [baris] = await db
    .select()
    .from(kamar)
    .where(eq(kamar.id, id))
    .limit(1);
  if (!baris) notFound();

  const [penghuniAktif] = await db
    .select({ total: count() })
    .from(penghuni)
    .where(and(eq(penghuni.idKamar, id), eq(penghuni.status, "Aktif")));
  const terkunci = (penghuniAktif?.total ?? 0) > 0;

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <Link
          href="/kamar"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm text-white/60 transition-colors duration-[100ms] ease-brand hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Kembali ke Data Kamar
        </Link>
        <p className={`${eyebrowClass} mt-4`}>Kamar · Edit</p>
        <h1 className={headingClass}>Edit Kamar {baris.noKamar}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
          Perbarui informasi kamar. Status kamar yang terisi dikelola otomatis.
        </p>
      </div>

      <div className={`${cardClass} p-6`}>
        <KamarForm
          defaultValue={{
            id: baris.id,
            noKamar: baris.noKamar,
            tipeKamar: baris.tipeKamar,
            hargaSewa: baris.hargaSewa,
            statusKamar: baris.statusKamar,
            terkunci,
          }}
        />
      </div>
    </div>
  );
}
