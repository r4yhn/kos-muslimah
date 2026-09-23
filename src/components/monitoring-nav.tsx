"use client";

import {
  ChartColumn,
  DoorOpen,
  LayoutDashboard,
  MessageSquareWarning,
  ReceiptText,
  UserCircle,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/monitoring", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/monitoring/kamar", label: "Kamar", icon: DoorOpen },
  { href: "/monitoring/penghuni", label: "Penghuni", icon: Users },
  { href: "/monitoring/pembayaran", label: "Pembayaran", icon: ReceiptText },
  {
    href: "/monitoring/pengaduan",
    label: "Pengaduan",
    icon: MessageSquareWarning,
  },
  { href: "/monitoring/laporan", label: "Laporan Keuangan", icon: ChartColumn },
  { href: "/monitoring/profil", label: "Profil", icon: UserCircle },
] as const;

/** Navigasi area pemantauan Pemilik Kos — menyorot link aktif sesuai path. */
export function MonitoringNav() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    return (
      pathname === href ||
      (href !== "/monitoring" && pathname.startsWith(`${href}/`))
    );
  }

  return (
    <nav
      aria-label="Navigasi pemantauan pemilik"
      className="-mx-1 overflow-x-auto scrollbar-none"
    >
      <ul className="flex w-max items-center gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-md px-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.15em] transition-all duration-[100ms] ease-brand ${
                  active
                    ? "bg-primary/15 text-primary shadow-card"
                    : "text-white/55 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
