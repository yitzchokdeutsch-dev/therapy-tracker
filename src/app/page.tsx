"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTherapists, useServiceTypes, useClients, useBalances, useSessions } from "@/hooks";
import { supabase } from "@/lib/supabase";
import { fmt, todayStr, STATUS_BADGE } from "@/lib/utils";
import { SkeletonStatCards, SkeletonCard } from "@/components/Skeleton";
import { useUser } from "@/lib/user-context";

export default function DashboardPage() {
  const router = useRouter();
  const { role, therapistId } = useUser();
  const isTherapist = role === "therapist" && !!therapistId;

  // Therapists live in the calendar, not the dashboard
  useEffect(() => {
    if (role === "therapist") router.replace("/calendar");
  }, [role, router]);

  const today = new Date();
  const date = todayStr();
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

  const { data: sessions = [], isLoading: loadingSessions } = useSessions(date);
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: therapists = [] } = useTherapists();
  const { data: serviceTypes = [] } = useServiceTypes();
  const { data: balances = {} } = useBalances();

  const { data: monthlyStats } = useQuery({
    queryKey: ["monthly_stats", monthStart],
    queryFn: async () => {
      const [{ data: charges }, { data: payments }] = await Promise.all([
        supabase.from("charges").select("amount").gte("charge_date", monthStart).lte("charge_date", date).is("deleted_at", null),
        supabase.from("payments").select("amount").gte("payment_date", monthStart).lte("payment_date", date).is("deleted_at", null),
      ]);
      return {
        monthCharges: (charges ?? []).reduce((s, r: { amount: number }) => s + Number(r.amount), 0),
        monthPayments: (payments ?? []).reduce((s, r: { amount: number }) => s + Number(r.amount), 0),
      };
    },
    staleTime: 30_000,
  });

  const loading = loadingSessions || loadingClients;

  const getClient = (id: string) => clients.find((c) => c.id === id);
  const getTherapist = (id: string) => therapists.find((t) => t.id === id);
  const getService = (id: string) => serviceTypes.find((s) => s.id === id);

  const displayDate = today.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  const visibleSessions = isTherapist
    ? sessions.filter((s) => s.therapist_id === therapistId)
    : sessions;
  const visibleClients = isTherapist
    ? clients.filter((c) => c.therapist_id === therapistId)
    : clients;

  const checkedIn = visibleSessions.filter((s) => s.status !== "scheduled").length;

  const topBalances = clients
    .map((c) => ({ client: c, balance: balances[c.id] ?? 0 }))
    .filter(({ balance }) => balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 8);

  const totalOutstanding = topBalances.reduce((s, { balance }) => s + balance, 0);

  if (loading) return (
    <div>
      <SkeletonStatCards />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SkeletonCard rows={5} />
        <SkeletonCard rows={5} />
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="text-sm text-ink-500 mt-0.5">{displayDate}</div>
        </div>
        <button onClick={() => router.push("/checkin")} className="btn-primary">
          Open Check-In &rarr;
        </button>
      </div>

      <div className={`grid gap-4 mb-6 ${isTherapist ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
        <div className="card p-4">
          <div className="text-xs text-ink-400 uppercase tracking-wide font-semibold">Today&apos;s Sessions</div>
          <div className="text-3xl font-bold mt-1 text-brand-600">{visibleSessions.length}</div>
          <div className="text-xs text-ink-500 mt-0.5">{checkedIn} checked in</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-ink-400 uppercase tracking-wide font-semibold">
            {isTherapist ? "My Clients" : "Active Clients"}
          </div>
          <div className="text-3xl font-bold mt-1">{visibleClients.filter((c) => c.active).length}</div>
          <div className="text-xs text-ink-500 mt-0.5">{visibleClients.length} total</div>
        </div>
        {!isTherapist && (
          <>
            <div className="card p-4">
              <div className="text-xs text-ink-400 uppercase tracking-wide font-semibold">Outstanding</div>
              <div className="text-3xl font-bold mt-1 text-red-600">{fmt(totalOutstanding)}</div>
              <div className="text-xs text-ink-500 mt-0.5">{topBalances.length} clients owe</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-ink-400 uppercase tracking-wide font-semibold">This Month</div>
              <div className="text-3xl font-bold mt-1 text-emerald-600">{fmt(monthlyStats?.monthPayments ?? 0)}</div>
              <div className="text-xs text-ink-500 mt-0.5">{fmt(monthlyStats?.monthCharges ?? 0)} charged</div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card overflow-hidden">
          <div className="px-5 py-3 bg-surface-50 border-b border-surface-200 flex items-center justify-between">
            <h3 className="font-semibold">{isTherapist ? "My Schedule Today" : "Today's Schedule"}</h3>
            <button onClick={() => router.push("/checkin")} className="btn-ghost btn-sm text-brand-600">
              Check-In &rarr;
            </button>
          </div>
          {visibleSessions.length === 0 ? (
            <div className="p-8 text-center text-ink-400 text-sm">No sessions scheduled today</div>
          ) : (
            <div>
              {visibleSessions.map((s) => {
                const cl = getClient(s.client_id);
                const th = getTherapist(s.therapist_id);
                const svc = getService(s.service_type_id);
                return (
                  <div key={s.id} className="px-5 py-2.5 border-b border-surface-200 last:border-0 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: th?.color || "#999" }} />
                      <div>
                        <div className="font-semibold text-sm">{cl ? `${cl.first_name} ${cl.last_name}` : "Unknown"}</div>
                        <div className="text-xs text-ink-400">{th?.name} &middot; {svc?.name}</div>
                      </div>
                    </div>
                    <span className={`badge ${STATUS_BADGE[s.status] || "badge-gray"}`}>
                      {s.status.replace("_", " ")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!isTherapist && <div className="card overflow-hidden">
          <div className="px-5 py-3 bg-surface-50 border-b border-surface-200 flex items-center justify-between">
            <h3 className="font-semibold">Outstanding Balances</h3>
            <button onClick={() => router.push("/payments")} className="btn-ghost btn-sm text-brand-600">
              Payments &rarr;
            </button>
          </div>
          {topBalances.length === 0 ? (
            <div className="p-8 text-center text-ink-400 text-sm">All accounts are current</div>
          ) : (
            <div>
              {topBalances.map(({ client: c, balance }) => (
                <div key={c.id} className="px-5 py-2.5 border-b border-surface-200 last:border-0 flex items-center justify-between">
                  <button
                    onClick={() => router.push(`/clients/${c.id}`)}
                    className="font-semibold text-sm text-brand-600 hover:text-brand-800"
                  >
                    {c.first_name} {c.last_name}
                  </button>
                  <span className="font-bold text-red-600">{fmt(balance)}</span>
                </div>
              ))}
              <div className="px-5 py-2.5 bg-surface-50 flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-500">Total</span>
                <span className="font-bold text-red-600">{fmt(totalOutstanding)}</span>
              </div>
            </div>
          )}
        </div>}
      </div>
    </div>
  );
}
