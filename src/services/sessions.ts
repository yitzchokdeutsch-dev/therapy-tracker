import { supabase } from "@/lib/supabase";
import type { SessionCreateInput, SessionUpdateInput } from "@/lib/schemas";

export async function dbCreateSession(data: SessionCreateInput) {
  const { data: session, error } = await supabase
    .from("sessions")
    .insert({ ...data, status: "scheduled" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return session;
}

export async function dbUpdateSession(id: string, data: SessionUpdateInput) {
  const { error } = await supabase
    .from("sessions")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function dbUpdateSessionStatus(
  sessionId: string,
  status: string,
  charge?: {
    client_id: string;
    amount: number;
    description: string;
    session_date: string;
  }
) {
  const { error: statusErr } = await supabase
    .from("sessions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (statusErr) throw new Error(statusErr.message);

  await supabase.from("charges").delete().eq("session_id", sessionId);

  if (charge && charge.amount > 0) {
    const { error: chargeErr } = await supabase
      .from("charges")
      .insert({ ...charge, session_id: sessionId });
    if (chargeErr) throw new Error(chargeErr.message);
  }
}

export async function dbDeleteSession(id: string) {
  await supabase.from("charges").delete().eq("session_id", id);
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
