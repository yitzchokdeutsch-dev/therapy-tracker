"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: row, error: rowErr } = await supabase
    .from("user_roles").select("role").eq("user_id", user.id).single();

  if (row?.role === "admin") return user;

  // If the table doesn't exist yet, allow access (migration not run)
  if (rowErr?.code === "42P01") return user; // 42P01 = undefined_table

  // Allow access when no roles have been configured yet (initial setup)
  // Only possible if service role key is available
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient();
    const { count } = await admin
      .from("user_roles").select("*", { count: "exact", head: true });
    if (count === 0) return user;
  }

  throw new Error("Admin access required");
}

export type UserRow = {
  id: string;
  email: string;
  role: string;
  therapistId: string | null;
  lastSignIn: string | null;
};

export async function listUsers(): Promise<UserRow[]> {
  await requireAdmin();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set. Add it to your Vercel environment variables.");
  }
  const admin = createAdminClient();

  const [{ data: authData }, { data: roles }] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("user_roles").select("user_id, role, therapist_id"),
  ]);

  return (authData?.users ?? []).map((u) => {
    const roleRow = (roles ?? []).find((r) => r.user_id === u.id);
    return {
      id: u.id,
      email: u.email ?? "(no email)",
      role: roleRow?.role ?? "readonly",
      therapistId: roleRow?.therapist_id ?? null,
      lastSignIn: u.last_sign_in_at ?? null,
    };
  });
}

export async function setUserRole(
  userId: string,
  role: string,
  therapistId: string | null
): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();
  await admin.from("user_roles").upsert(
    { user_id: userId, role, therapist_id: therapistId, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
}
