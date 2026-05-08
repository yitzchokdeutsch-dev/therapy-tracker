import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase redirects here after invite links, magic links, and OAuth.
// Exchanges the one-time code for a real session, then forwards the user.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type"); // "invite" | "recovery" | "signup" etc.
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // New invited users need to set a password before using the app
      if (type === "invite") {
        return NextResponse.redirect(`${origin}/auth/set-password`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=invalid_link`);
}
