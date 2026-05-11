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

  // Remove any existing charge for this session (try soft-delete, fall back to hard-delete)
  const softDel = await supabase
    .from("charges")
    .update({ deleted_at: new Date().toISOString() })
    .eq("session_id", sessionId);
  if (softDel.error) {
    // deleted_at column doesn't exist yet — hard delete instead
    await supabase.from("charges").delete().eq("session_id", sessionId);
  }

  if (charge && charge.amount > 0) {
    const { error: chargeErr } = await supabase
      .from("charges")
      .insert({
        client_id:   charge.client_id,
        amount:      charge.amount,
        description: charge.description,
        charge_date: charge.session_date, // session_date in schema maps to charge_date in DB
        session_id:  sessionId,
      });
    if (chargeErr) throw new Error(chargeErr.message);
  }

  await logAudit("session.status_changed", {
    tableName: "sessions",
    recordId: sessionId,
    details: { status, charge_amount: charge?.amount },
  });

  // Auto-create a SOAP note reminder task — wrapped so it never breaks the main flow
  if (status === "attended") {
    try {
      const { data: session } = await supabase
        .from("sessions").select("client_id, session_date").eq("id", sessionId).single();
      const { data: client } = session?.client_id
        ? await supabase.from("clients").select("first_name, last_name").eq("id", session.client_id).single()
        : { data: null };
      const { count } = await supabase
        .from("session_notes").select("*", { count: "exact", head: true })
        .eq("session_id", sessionId);
      if ((count ?? 0) === 0 && session && client) {
        await supabase.from("tasks").insert({
          client_id: session.client_id,
          session_id: sessionId,
          title: `Write SOAP note — ${client.first_name} ${client.last_name} (${session.session_date})`,
          task_type: "soap_note",
          due_date: session.session_date,
        });
      }
    } catch {
      // Task creation is non-critical — never crash the status update
    }
  }
}

export async function dbDeleteSession(id: string) {
  const now = new Date().toISOString();
  // Remove related charges (soft-delete if column exists, hard-delete otherwise)
  const softDelCharge = await supabase
    .from("charges").update({ deleted_at: now }).eq("session_id", id);
  if (softDelCharge.error) {
    await supabase.from("charges").delete().eq("session_id", id);
  }
  // Soft-delete the session
  const { error } = await supabase
    .from("sessions")
    .update({ deleted_at: now })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logAudit("session.deleted", { tableName: "sessions", recordId: id });
}
