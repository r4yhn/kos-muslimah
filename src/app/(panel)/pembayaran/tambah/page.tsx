import { eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { kamar, penghuni } from "@/db/schema";
import { cardClass, eyebrowClass, headingClass } from "@/lib/ui";
import {
  PembayaranForm,
  type PenghuniOption,
} from "../pembayaran-form";

export const dynamic = "force-dynamic";

export default async function TambahPembayaranPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const penghuniOptions: PenghuniOption[] = await db
    .select({
      id: penghuni.id,
      nama: penghuni.nama,
      status: penghuni.status,
      noKamar: kamar.noKamar,
    })
    .from(penghuni)
    .leftJoin(kamar, eq(kamar.id, penghuni.idKamar))
    .where(eq(penghuni.status, "Aktif"))
    .orderBy(penghuni.nama);

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <Link
          href="/pembayaran"
          className="inline-flex min-h-[44px] items-center gap-2 text-sm text-white/60 transition-colors duration-[100ms] ease-brand hover:text-primary"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Kembali ke Pembayaran
        </Link>
        <p className={`${eyebrowClass} mt-4`}>Pembayaran · Catat Baru</p>
        <h1 className={headingClass}>Catat Pembayaran Sewa</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
          Pilih penghuni dan periode sewa, lalu isi nominal serta metode
          pembayaran.
        </p>
      </div>

      <div className={`${cardClass} p-6`}>
        <PembayaranForm penghuniOptions={penghuniOptions} />
      </div>
    </div>
  );
}
