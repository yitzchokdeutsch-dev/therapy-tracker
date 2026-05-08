import { z } from "zod";

export const SessionCreateSchema = z.object({
  client_id: z.string().uuid(),
  therapist_id: z.string().uuid(),
  service_type_id: z.string().uuid(),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  session_time: z.string().min(4).max(8),
  notes: z.string().max(1000).nullable().optional(),
});
export type SessionCreateInput = z.infer<typeof SessionCreateSchema>;

export const SessionUpdateSchema = z.object({
  therapist_id: z.string().uuid().optional(),
  service_type_id: z.string().uuid().optional(),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  session_time: z.string().min(4).max(8).optional(),
  notes: z.string().max(1000).nullable().optional(),
});
export type SessionUpdateInput = z.infer<typeof SessionUpdateSchema>;

export const SessionStatusSchema = z.object({
  sessionId: z.string().uuid(),
  status: z.enum(["scheduled", "attended", "late_cancel", "no_show", "cancelled"]),
  charge: z
    .object({
      client_id: z.string().uuid(),
      amount: z.number().nonnegative(),
      description: z.string().min(1).max(200),
      session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .optional(),
});
export type SessionStatusInput = z.infer<typeof SessionStatusSchema>;

export const PaymentCreateSchema = z.object({
  client_id: z.string().uuid(),
  payment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive().max(100_000),
  method: z.enum(["cash", "check", "card", "insurance", "other"]),
  reference: z.string().max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});
export type PaymentCreateInput = z.infer<typeof PaymentCreateSchema>;
