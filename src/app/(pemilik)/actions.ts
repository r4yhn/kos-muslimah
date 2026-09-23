"use server";

import { signOut } from "@/auth";

/** Server action logout — dipakai tombol Keluar pada layout pemantauan pemilik. */
export async function logoutMonitoring() {
  await signOut({ redirectTo: "/login" });
}
