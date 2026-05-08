import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createSessionAction,
  updateSessionAction,
  updateSessionStatusAction,
  deleteSessionAction,
} from "@/app/actions/sessions";
import { recordPaymentAction, deletePaymentAction } from "@/app/actions/payments";
import type { SessionCreateInput, SessionUpdateInput, SessionStatusInput, PaymentCreateInput } from "@/lib/schemas";
import type { Session } from "@/lib/types";

/** Optimistic: flips the status immediately in cache, rolls back on error. */
export function useUpdateSessionStatus(date: string) {
  const queryClient = useQueryClient();
  const queryKey = ["sessions", "date", date];

  return useMutation({
    mutationFn: (input: SessionStatusInput) => updateSessionStatusAction(input),
    onMutate: async ({ sessionId, status }) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<Session[]>(queryKey);
      queryClient.setQueryData<Session[]>(queryKey, (old) =>
        old?.map((s) => (s.id === sessionId ? { ...s, status } : s)) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SessionCreateInput) => createSessionAction(input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

export function useUpdateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SessionUpdateInput }) =>
      updateSessionAction(id, data),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSessionAction(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function useRecordPayment(filterMonth: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PaymentCreateInput) => recordPaymentAction(input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["payments", filterMonth] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}

export function useDeletePayment(filterMonth: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePaymentAction(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["payments", filterMonth] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
  });
}
