import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
const supabase = createClient();
import type { SessionCreateInput, SessionUpdateInput } from "@/lib/schemas";

export async function dbCreateSession(data: SessionCreateInput) {
  const { data: session, error } = await supabase
    .from("sessions")
    .insert({ ...data, status: "scheduled" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  await logAudit("session.created", { tableName: "sessions", recordId: session.id, details: { session_date: data.session_date, client_id: data.client_id } });
  return session;
}

export async function dbUpdateSession(id: string, data: SessionUpdateInput) {
  const { error } = await supabase
    .from("sessions")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logAudit("session.updated", { tableName: "sessions", recordId: id });
}

export async function dbUpdateSessionStatus(
  sessionId: string,
  status: string,
  charge?: { client_id: string; amount: number; description: string; session_date: string }
) {
  const { error: statusErr } = await supabase
    .from("sessions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (statusErr) throw new Error(statusErr.message);

  // Soft-delete any existing charge for this session
  await supabase
    .from("charges")
    .update({ deleted_at: new Date().toISOString() })
    .eq("session_id", sessionId)
    .is("deleted_at", null);

  if (charge && charge.amount > 0) {
    const { error: chargeErr } = await supabase
      .from("charges")
      .insert({ ...charge, session_id: sessionId });
    if (chargeErr) throw new Error(chargeErr.message);
  }

  await logAudit("session.status_changed", {
    tableName: "sessions",
    recordId: sessionId,
    details: { status, charge_amount: charge?.amount },
  });
}

export async function dbDeleteSession(id: string) {
  const now = new Date().toISOString();
  // Soft-delete related charges first
  await supabase
    .from("charges")
    .update({ deleted_at: now })
    .eq("session_id", id)
    .is("deleted_at", null);
  // Soft-delete the session
  const { error } = await supabase
    .from("sessions")
    .update({ deleted_at: now })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logAudit("session.deleted", { tableName: "sessions", recordId: id });
}
