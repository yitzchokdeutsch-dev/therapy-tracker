"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { Role } from "@/lib/permissions";
import { canAccessPage } from "@/lib/permissions";

interface Props {
  role: Role | null;
  children: React.ReactNode;
}

// Redirects to / if the user's role cannot access the current page.
export default function RoleGuard({ role, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (role && !canAccessPage(role, pathname)) {
      router.replace("/");
    }
  }, [role, pathname, router]);

  if (!role) return null;
  if (!canAccessPage(role, pathname)) return null;

  return <>{children}</>;
}
