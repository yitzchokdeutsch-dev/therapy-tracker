"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import RoleGuard from "@/components/RoleGuard";
import type { Role } from "@/lib/permissions";

export default function AppShell({
  children,
  userEmail,
  userRole,
}: {
  children: React.ReactNode;
  userEmail: string;
  userRole: Role;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        userEmail={userEmail}
        userRole={userRole}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-surface-200 h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-xs">
            TT
          </div>
          <span className="font-bold text-ink-900">Therapy Tracker</span>
        </div>
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg hover:bg-surface-100 text-ink-600"
          aria-label="Open menu"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <main className="flex-1 md:ml-64 pt-14 md:pt-0">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-5 md:py-8">
          <RoleGuard role={userRole}>
            {children}
          </RoleGuard>
        </div>
      </main>
    </div>
  );
}
