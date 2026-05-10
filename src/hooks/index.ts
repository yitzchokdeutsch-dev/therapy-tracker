import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  Client, Therapist, ServiceType, Fee,
  Session, TherapistSchedule, Payment, Charge,
} from "@/lib/types";

export function useTherapists() {
  return useQuery<Therapist[]>({
    queryKey: ["therapists"],
    queryFn: async () => {
      const { data } = await supabase
        .from("therapists").select("*").eq("active", true).order("name");
      return (data ?? []) as Therapist[];
    },
    staleTime: 60_000,
  });
}

export function useAllTherapists() {
  return useQuery<Therapist[]>({
    queryKey: ["therapists", "all"],
    queryFn: async () => {
      const { data } = await supabase.from("therapists").select("*").order("name");
      return (data ?? []) as Therapist[];
    },
    staleTime: 60_000,
  });
}

export function useServiceTypes() {
  return useQuery<ServiceType[]>({
    queryKey: ["service_types"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_types").select("*").eq("active", true).order("name");
      return (data ?? []) as ServiceType[];
    },
    staleTime: 60_000,
  });
}

export function useAllServiceTypes() {
  return useQuery<ServiceType[]>({
    queryKey: ["service_types", "all"],
    queryFn: async () => {
      const { data } = await supabase.from("service_types").select("*").order("name");
      return (data ?? []) as ServiceType[];
    },
    staleTime: 60_000,
  });
}

export function useClients(activeOnly = false) {
  return useQuery<Client[]>({
    queryKey: ["clients", activeOnly],
    queryFn: async () => {
      let q = supabase.from("clients").select("*").order("last_name, first_name");
      if (activeOnly) q = (q as any).eq("active", true);
      const { data } = await q;
      return (data ?? []) as Client[];
    },
    staleTime: 30_000,
  });
}

export function useFees() {
  return useQuery<Fee[]>({
    queryKey: ["fees"],
    queryFn: async () => {
      const { data } = await supabase.from("fees").select("*");
      return (data ?? []) as Fee[];
    },
    staleTime: 60_000,
  });
}

export function useBalances() {
  return useQuery<Record<string, number>>({
    queryKey: ["balances"],
    queryFn: async () => {
      // Prefer the client_balances SQL view (see supabase/migrations/001_client_balances_view.sql).
      // Falls back to client-side calculation if the view hasn't been created yet.
      const { data, error } = await supabase
        .from("client_balances")
        .select("client_id, balance");

      if (error) {
        const [{ data: charges }, { data: payments }] = await Promise.all([
          supabase.from("charges").select("client_id, amount").is("deleted_at", null),
          supabase.from("payments").select("client_id, amount").is("deleted_at", null),
        ]);
        const bals: Record<string, number> = {};
        (charges ?? []).forEach((c: Pick<Charge, "client_id" | "amount">) => {
          bals[c.client_id] = (bals[c.client_id] ?? 0) + Number(c.amount);
        });
        (payments ?? []).forEach((p: Pick<Payment, "client_id" | "amount">) => {
          bals[p.client_id] = (bals[p.client_id] ?? 0) - Number(p.amount);
        });
        return bals;
      }

      const bals: Record<string, number> = {};
      for (const row of data ?? []) {
        bals[row.client_id] = Number(row.balance);
      }
      return bals;
    },
    staleTime: 15_000,
  });
}

export function useSessions(dateStr: string) {
  return useQuery<Session[]>({
    queryKey: ["sessions", "date", dateStr],
    queryFn: async () => {
      const { data } = await supabase
        .from("sessions").select("*")
        .eq("session_date", dateStr)
        .is("deleted_at", null)
        .order("session_time");
      return (data ?? []) as Session[];
    },
    staleTime: 15_000,
  });
}

export function useSessionsForMonth(year: number, month: number) {
  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return useQuery<Session[]>({
    queryKey: ["sessions", "month", year, month],
    queryFn: async () => {
      const { data } = await supabase
        .from("sessions").select("*")
        .gte("session_date", startDate)
        .lte("session_date", endDate)
        .is("deleted_at", null)
        .order("session_time");
      return (data ?? []) as Session[];
    },
    staleTime: 15_000,
  });
}

export function useSchedules() {
  return useQuery<TherapistSchedule[]>({
    queryKey: ["schedules"],
    queryFn: async () => {
      const { data } = await supabase.from("therapist_schedules").select("*").order("day_of_week");
      return (data ?? []) as TherapistSchedule[];
    },
    staleTime: 60_000,
  });
}

export function usePaymentsForMonth(filterMonth: string) {
  const [y, m] = filterMonth.split("-").map(Number);
  const monthEnd = `${filterMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
  return useQuery<Payment[]>({
    queryKey: ["payments", filterMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments").select("*")
        .gte("payment_date", filterMonth + "-01")
        .lte("payment_date", monthEnd)
        .is("deleted_at", null)
        .order("payment_date", { ascending: false });
      return (data ?? []) as Payment[];
    },
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}
