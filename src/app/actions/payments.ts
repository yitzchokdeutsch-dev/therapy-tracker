"use server";

import { PaymentCreateSchema, type PaymentCreateInput } from "@/lib/schemas";
import { dbRecordPayment, dbDeletePayment } from "@/services/payments";

export async function recordPaymentAction(input: PaymentCreateInput) {
  const data = PaymentCreateSchema.parse(input);
  return dbRecordPayment(data);
}

export async function deletePaymentAction(id: string) {
  return dbDeletePayment(id);
}
