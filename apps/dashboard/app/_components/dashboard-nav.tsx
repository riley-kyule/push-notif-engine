"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface DashboardNavItem {
  href: string;
  label: string;
}

export function DashboardNav({ items }: { items: DashboardNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="nav" aria-label="Primary">
      {items.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));

        return (
          <Link key={item.href} href={item.href} aria-current={isActive ? "page" : undefined}>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
