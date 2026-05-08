import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/AppShell";
import Providers from "@/components/Providers";
import SessionGuard from "@/components/SessionGuard";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Therapy Tracker",
  description: "OT Clinic scheduling, check-in & billing",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body>
        <Providers>
          {user ? (
            <SessionGuard>
              <AppShell userEmail={user.email ?? ""}>{children}</AppShell>
            </SessionGuard>
          ) : (
            <>{children}</>
          )}
        </Providers>
      </body>
    </html>
  );
}
