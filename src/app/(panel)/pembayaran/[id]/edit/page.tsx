import { and, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { kamar, pembayaran, penghuni } from "@/db/schema";
import { cardClass, eyebrowClass, headingClass } from "@/lib/ui";
import {
  PembayaranForm,
  type PenghuniOption,
} from "../../pembayaran-form";

export const dynamic = "force-dynamic";

export default async function EditPembayaranPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const [baris] = await db
    .select({
      id: pembayaran.id,
      idPenghuni: pembayaran.idPenghuni,
      tanggalBayar: pembayaran.tanggalBayar,
      jatuhTempo: pembayaran.jatuhTempo,
      bulan: pembayaran.bulan,
      tahun: pembayaran.tahun,
      jumlahBayar: pembayaran.jumlahBayar,
      metodeBayar: pembayaran.metodeBayar,
      statusBayar: pembayaran.statusBayar,
      keterangan: pembayaran.keterangan,
    })
    .from(pembayaran)
    .where(eq(pembayaran.id, id))
    .limit(1);
  if (!baris) notFound();

  // Opsi penghuni: seluruh yang aktif + pemilik catatan ini.
  const opsiAktif: PenghuniOption[] = await db
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

  const opsiPemilik: PenghuniOption[] = await db
    .select({
      id: penghuni.id,
      nama: penghuni.nama,
      status: penghuni.status,
      noKamar: kamar.noKamar,
    })
    .from(penghuni)
    .leftJoin(kamar, eq(kamar.id, penghuni.idKamar))
    .where(and(eq(penghuni.id, baris.idPenghuni)))
    .limit(1);

  const penghuniOptions = [...opsiAktif];
  if (opsiPemilik[0] && !penghuniOptions.some((o) => o.id === opsiPemilik[0].id)) {
    penghuniOptions.push(opsiPemilik[0]);
  }

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
        <p className={`${eyebrowClass} mt-4`}>Pembayaran · Edit</p>
        <h1 className={headingClass}>Edit Catatan Pembayaran</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/60">
          Perbaiki nominal, metode, atau status bayar pada catatan ini.
        </p>
      </div>

      <div className={`${cardClass} p-6`}>
        <PembayaranForm
          penghuniOptions={penghuniOptions}
          defaultValue={{
            id: baris.id,
            idPenghuni: baris.idPenghuni,
            tanggalBayar: baris.tanggalBayar,
            jatuhTempo: baris.jatuhTempo,
            bulan: baris.bulan,
            tahun: baris.tahun,
            jumlahBayar: baris.jumlahBayar,
            metodeBayar: baris.metodeBayar,
            statusBayar: baris.statusBayar,
            keterangan: baris.keterangan,
          }}
        />
      </div>
    </div>
  );
}
