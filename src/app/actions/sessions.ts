"use server";

import {
  SessionCreateSchema,
  SessionUpdateSchema,
  SessionStatusSchema,
  type SessionCreateInput,
  type SessionUpdateInput,
  type SessionStatusInput,
} from "@/lib/schemas";
import {
  dbCreateSession,
  dbUpdateSession,
  dbUpdateSessionStatus,
  dbDeleteSession,
} from "@/services/sessions";

export async function createSessionAction(input: SessionCreateInput) {
  const data = SessionCreateSchema.parse(input);
  return dbCreateSession(data);
}

export async function updateSessionAction(id: string, input: SessionUpdateInput) {
  const data = SessionUpdateSchema.parse(input);
  return dbUpdateSession(id, data);
}

export async function updateSessionStatusAction(input: SessionStatusInput) {
  const data = SessionStatusSchema.parse(input);
  return dbUpdateSessionStatus(data.sessionId, data.status, data.charge);
}

export async function deleteSessionAction(id: string) {
  return dbDeleteSession(id);
}
