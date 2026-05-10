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

  let userRole: Role = "admin"; // safe default until migration is run
  let userTherapistId: string | null = null;

  if (user) {
    try {
      const { data: roleRow } = await supabase
        .from("user_roles").select("role, therapist_id").eq("user_id", user.id).single();
      if (roleRow?.role) userRole = roleRow.role as Role;
      if (roleRow?.therapist_id) userTherapistId = roleRow.therapist_id;
    } catch {
      // user_roles table doesn't exist yet — keep admin default
    }
  }

  return (
    <html lang="en">
      <body>
        <Providers>
          {user ? (
            <SessionGuard>
              <AppShell
                userEmail={user.email ?? ""}
                userRole={userRole}
                userTherapistId={userTherapistId}
              >
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
