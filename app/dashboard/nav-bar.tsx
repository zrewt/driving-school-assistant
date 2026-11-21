"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/login/actions";

const LINKS = [
  { href: "/dashboard", label: "Leads" },
  { href: "/dashboard/stats", label: "Stats" },
  { href: "/dashboard/settings", label: "Settings" },
] as const;

export function NavBar({ schoolName }: { schoolName: string }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname.startsWith("/dashboard/leads");
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2">
        <span className="truncate text-sm font-semibold text-slate-900">{schoolName}</span>
        <nav className="flex items-center gap-1 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-2.5 py-2 font-medium ${
                isActive(link.href) ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <form action={logout}>
            <button type="submit" className="rounded-md px-2.5 py-2 font-medium text-slate-600 hover:bg-slate-100">
              Logout
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
