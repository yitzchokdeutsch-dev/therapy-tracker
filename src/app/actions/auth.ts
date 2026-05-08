"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signIn(email: string, password: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return { error: null };
}

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function verifyMfaCode(code: string) {
  const supabase = createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp?.[0];
  if (!totp) return { error: "No MFA factor found" };

  const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: totp.id });
  if (challengeErr) return { error: challengeErr.message };

  const { error: verifyErr } = await supabase.auth.mfa.verify({
    factorId: totp.id,
    challengeId: challenge.id,
    code,
  });
  if (verifyErr) return { error: verifyErr.message };
  return { error: null };
}

export async function enrollMfa() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator App" });
  if (error) return { error: error.message, data: null };
  return { error: null, data };
}

export async function unenrollMfa(factorId: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { error: error.message };
  return { error: null };
}

export async function getUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getMfaStatus() {
  const supabase = createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  return {
    currentLevel: data?.currentLevel,
    nextLevel: data?.nextLevel,
    hasMfaEnrolled: (factors?.totp?.length ?? 0) > 0,
    factors: factors?.totp ?? [],
  };
}
