import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
const supabase = createClient();
import type { PaymentCreateInput } from "@/lib/schemas";

export async function dbRecordPayment(data: PaymentCreateInput) {
  const { data: payment, error } = await supabase
    .from("payments")
    .insert(data)
    .select()
    .single();
  if (error) throw new Error(error.message);
  await logAudit("payment.recorded", {
    tableName: "payments",
    recordId: payment.id,
    details: { client_id: data.client_id, amount: data.amount, method: data.method },
  });
  return payment;
}

export async function dbDeletePayment(id: string) {
  const { error } = await supabase
    .from("payments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logAudit("payment.deleted", { tableName: "payments", recordId: id });
}
