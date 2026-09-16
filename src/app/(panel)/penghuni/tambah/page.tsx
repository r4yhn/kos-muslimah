import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { cardClass, eyebrowClass, headingClass } from "@/lib/ui";
import { kamarBisaDitempati } from "@/lib/kamar-options";
import { PenghuniForm } from "../penghuni-form";

export const dynamic = "force-dynamic";

export default async function TambahPenghuniPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const kamarTersedia = await kamarBisaDitempati();

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
        <p className={`${eyebrowClass} mt-4`}>Penghuni · Daftar Baru</p>
        <h1 className={headingClass}>Daftarkan Penghuni</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
          Lengkapi data identitas penghuni. Opsional: buatkan akun login untuk
          penghuni baru — saat login pertama, menu akan terkunci dan diarahkan
          ke halaman{" "}
          <span className="font-mono text-primary">Pembayaran Awal</span>{" "}
          sebelum status kamar resmi aktif.
        </p>
      </div>

      <div className={`${cardClass} p-6`}>
        <PenghuniForm kamarOptions={kamarTersedia} />
      </div>
    </div>
  );
}
