import { createClient } from "@/lib/supabase/server";

export async function logAudit(
  action: string,
  options: {
    tableName?: string;
    recordId?: string;
    details?: Record<string, unknown>;
  } = {}
) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_log").insert({
      user_id: user?.id ?? null,
      action,
      table_name: options.tableName ?? null,
      record_id: options.recordId ?? null,
      details: options.details ?? null,
    });
  } catch {
    // Audit logging must never crash the main operation
  }
}
