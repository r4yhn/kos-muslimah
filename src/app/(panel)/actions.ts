"use server";

import { revalidatePath } from "next/cache";

import { auth, signOut } from "@/auth";
import { tandaiSemuaNotifikasiDibaca } from "@/lib/notifikasi";

/** Server action logout — dipakai tombol Keluar pada layout panel. */
export async function logout() {
  await signOut({ redirectTo: "/login" });
}

/** Tandai seluruh notifikasi admin yang sedang login sebagai sudah dibaca. */
export async function tandaiSemuaNotifikasiDibacaPanel(): Promise<void> {
  const session = await auth();
  if (session?.user?.role !== "admin") return;

  await tandaiSemuaNotifikasiDibaca(session.user.id);
  revalidatePath("/notifikasi");
}
