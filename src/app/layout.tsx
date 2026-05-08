import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
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
              <div className="flex min-h-screen">
                <Sidebar userEmail={user.email ?? ""} />
                <main className="flex-1 ml-64">
                  <div className="max-w-6xl mx-auto px-6 py-8">{children}</div>
                </main>
              </div>
            </SessionGuard>
          ) : (
            <>{children}</>
          )}
        </Providers>
      </body>
    </html>
  );
}
