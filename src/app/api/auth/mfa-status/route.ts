import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createClient();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  return NextResponse.json({
    currentLevel: aal?.currentLevel,
    nextLevel: aal?.nextLevel,
    hasMfaEnrolled: (factors?.totp?.length ?? 0) > 0,
  });
}
