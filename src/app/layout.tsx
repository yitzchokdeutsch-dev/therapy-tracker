import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import Providers from "@/components/Providers";
import SessionGuard from "@/components/SessionGuard";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Therapy Tracker",
  description: "OT Clinic scheduling, check-in & billing",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userRole: Role = "admin"; // safe default before migration is run
  if (user) {
    const { data: roleRow } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).single();
    if (roleRow?.role) userRole = roleRow.role as Role;
  }

  return (
    <html lang="en">
      <body>
        <Providers>
          {user ? (
            <SessionGuard>
              <AppShell userEmail={user.email ?? ""} userRole={userRole}>
                {children}
              </AppShell>
            </SessionGuard>
          ) : (
            <>{children}</>
          )}
        </Providers>
      </body>
    </html>
  );
}
