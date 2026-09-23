import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { berandaPeran } from "@/lib/role";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  redirect(berandaPeran(session?.user?.role));
}
