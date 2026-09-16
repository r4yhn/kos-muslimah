"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartColumn,
  DoorOpen,
  LayoutDashboard,
  ReceiptText,
  Users,
} from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/kamar", label: "Kamar", icon: DoorOpen },
  { href: "/penghuni", label: "Penghuni", icon: Users },
  { href: "/pembayaran", label: "Pembayaran", icon: ReceiptText },
  { href: "/laporan", label: "Laporan Keuangan", icon: ChartColumn },
] as const;

/** Navigasi utama panel — disorot berdasarkan path aktif. */
export function AppNav() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    return (
      pathname === href ||
      (href !== "/dashboard" && pathname.startsWith(`${href}/`))
    );
  }

  return (
    <nav
      aria-label="Navigasi utama"
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
