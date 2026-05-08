import { supabase } from "@/lib/supabase";
import type { PaymentCreateInput } from "@/lib/schemas";

export async function dbRecordPayment(data: PaymentCreateInput) {
  const { data: payment, error } = await supabase
    .from("payments")
    .insert(data)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return payment;
}

export async function dbDeletePayment(id: string) {
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
