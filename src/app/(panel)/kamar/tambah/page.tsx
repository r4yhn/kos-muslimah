import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  cardClass,
  eyebrowClass,
  headingClass,
} from "@/lib/ui";
import { KamarForm } from "../kamar-form";

export const dynamic = "force-dynamic";

export default async function TambahKamarPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

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
        <p className={`${eyebrowClass} mt-4`}>Kamar · Tambah</p>
        <h1 className={headingClass}>Tambah Kamar Baru</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
          Isi informasi kamar. Kamar baru berstatus{" "}
          <span className="font-mono text-primary">Tersedia</span> dan siap
          ditempati.
        </p>
      </div>

      <div className={`${cardClass} p-6`}>
        <KamarForm />
      </div>
    </div>
  );
}
