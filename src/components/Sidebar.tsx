"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Dashboard", icon: "\u25C9" },
  { href: "/clients", label: "Clients", icon: "\u25CE" },
  { href: "/calendar", label: "Calendar", icon: "\u25A6" },
  { href: "/checkin", label: "Check-In", icon: "\u2713" },
  { href: "/payments", label: "Payments", icon: "$" },
  { href: "/billing", label: "Billing", icon: "\u25E7" },
  { href: "/setup", label: "Setup", icon: "\u2699" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-surface-200 flex flex-col z-50">
      <div className="px-6 py-5 border-b border-surface-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-sm">
            TT
          </div>
          <div>
            <div className="font-bold text-base text-ink-900">Therapy Tracker</div>
            <div className="text-xs text-ink-400">OT Clinic Manager</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:bg-surface-100 hover:text-ink-700"
              }`}>
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-4 border-t border-surface-200">
        <div className="text-xs text-ink-400">v0.1.0</div>
      </div>
    </aside>
  );
}
