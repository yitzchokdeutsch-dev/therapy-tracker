"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "@/app/actions/auth";

const nav = [
  { href: "/", label: "Dashboard", icon: "◉" },
  { href: "/clients", label: "Clients", icon: "◎" },
  { href: "/scheduling", label: "Scheduling", icon: "☰" },
  { href: "/checkin", label: "Check-In", icon: "✓" },
  { href: "/calendar", label: "Calendar", icon: "▦" },
  { href: "/payments", label: "Payments", icon: "$" },
  { href: "/billing", label: "Billing", icon: "◧" },
  { href: "/setup", label: "Setup", icon: "⚙" },
];

interface SidebarProps {
  userEmail: string;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ userEmail, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const handleNavClick = () => {
    // Close drawer on mobile after navigation
    onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-surface-200
          flex flex-col z-50 transition-transform duration-200 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >
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

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-500 hover:bg-surface-100 hover:text-ink-700"
                }`}
              >
                <span className="text-base w-5 text-center">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-surface-200 space-y-1">
          <Link
            href="/account"
            onClick={handleNavClick}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname.startsWith("/account")
                ? "bg-brand-50 text-brand-700"
                : "text-ink-500 hover:bg-surface-100 hover:text-ink-700"
            }`}
          >
            <span className="text-base w-5 text-center">👤</span>
            Account
          </Link>

          <div className="px-3 py-1">
            <div className="text-xs text-ink-400 truncate">{userEmail}</div>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-ink-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <span className="text-base w-5 text-center">→</span>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
