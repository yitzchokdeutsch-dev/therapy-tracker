"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Session { id: string; client_id: string; therapist_id: string; service_type_id: string; session_date: string; status: string; }
interface Client { id: string; first_name: string; last_name: string; active: boolean; }
interface Therapist { id: string; name: string; color: string; }
interface ServiceType { id: string; name: string; rate: number; }

export default function DashboardPage() {
  const router = useRouter();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

  const [loading, setLoading] = useState(true);
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [monthPayments, setMonthPayments] = useState(0);
  const [monthCharges, setMonthCharges] = useState(0);
  const [topBalances, setTopBalances] = useState<{ client: Client; balance: number }[]>([]);

  const load = useCallback(async () => {
    const [sRes, cRes, tRes, stRes] = await Promise.all([
      supabase.from("sessions").select("*").eq("session_date", todayStr).order("session_time").then(r => r),
      supabase.from("clients").select("*").order("last_name").then(r => r),
      supabase.from("therapists").select("*").eq("active", true).order("name").then(r => r),
      supabase.from("service_types").select("*").eq("active", true).then(r => r),
    ]);
    setTodaySessions(sRes.data || []);
    setClients(cRes.data || []);
    setTherapists(tRes.data || []);
    setServiceTypes(stRes.data || []);

    // Balances
    const chRes = await supabase.from("charges").select("client_id, amount");
    const pRes = await supabase.from("payments").select("client_id, amount");
    const bals: Record<string, number> = {};
    (chRes.data || []).forEach((c: any) => { bals[c.client_id] = (bals[c.client_id] || 0) + Number(c.amount); });
    (pRes.data || []).forEach((p: any) => { bals[p.client_id] = (bals[p.client_id] || 0) - Number(p.amount); });

    let outstanding = 0;
    const balList: { client: Client; balance: number }[] = [];
    (cRes.data || []).forEach((c: Client) => {
      const b = bals[c.id] || 0;
      if (b > 0) { outstanding += b; balList.push({ client: c, balance: b }); }
    });
    setTotalOutstanding(outstanding);
    setTopBalances(balList.sort((a, b) => b.balance - a.balance).slice(0, 8));

    // Month totals
    const mchRes = await supabase.from("charges").select("amount").gte("charge_date", monthStart).lte("charge_date", todayStr);
    const mpRes = await supabase.from("payments").select("amount").gte("payment_date", monthStart).lte("payment_date", todayStr);
    setMonthCharges((mchRes.data || []).reduce((s: number, r: any) => s + Number(r.amount), 0));
    setMonthPayments((mpRes.data || []).reduce((s: number, r: any) => s + Number(r.amount), 0));

    setLoading(false);
  }, [todayStr, monthStart]);

  useEffect(() => { load(); }, [load]);

  const getClient = (id: string) => clients.find((c) => c.id === id);
  const getTherapist = (id: string) => therapists.find((t) => t.id === id);
  const getService = (id: string) => serviceTypes.find((s) => s.id === id);
  const fmt = (n: number) => "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const displayDate = today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const checkedIn = todaySessions.filter((s) => s.status !== "scheduled").length;

  if (loading) return <div className="text-ink-400 py-12 text-center">Loading...</div>;

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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card p-4">
          <div className="text-xs text-ink-400 uppercase tracking-wide font-semibold">Today&apos;s Sessions</div>
          <div className="text-3xl font-bold mt-1 text-brand-600">{todaySessions.length}</div>
          <div className="text-xs text-ink-500 mt-0.5">{checkedIn} checked in</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-ink-400 uppercase tracking-wide font-semibold">Active Clients</div>
          <div className="text-3xl font-bold mt-1">{clients.filter((c) => c.active).length}</div>
          <div className="text-xs text-ink-500 mt-0.5">{clients.length} total</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-ink-400 uppercase tracking-wide font-semibold">Outstanding</div>
          <div className="text-3xl font-bold mt-1 text-red-600">{fmt(totalOutstanding)}</div>
          <div className="text-xs text-ink-500 mt-0.5">{topBalances.length} clients owe</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-ink-400 uppercase tracking-wide font-semibold">This Month</div>
          <div className="text-3xl font-bold mt-1 text-emerald-600">{fmt(monthPayments)}</div>
          <div className="text-xs text-ink-500 mt-0.5">{fmt(monthCharges)} charged</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Today's Schedule */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 bg-surface-50 border-b border-surface-200 flex items-center justify-between">
            <h3 className="font-semibold">Today&apos;s Schedule</h3>
            <button onClick={() => router.push("/checkin")} className="btn-ghost btn-sm text-brand-600">Check-In &rarr;</button>
          </div>
          {todaySessions.length === 0 ? (
            <div className="p-8 text-center text-ink-400 text-sm">No sessions scheduled today</div>
          ) : (
            <div>
              {todaySessions.map((s) => {
                const cl = getClient(s.client_id);
                const th = getTherapist(s.therapist_id);
                const svc = getService(s.service_type_id);
                const statusBadge: Record<string, string> = {
                  scheduled: "badge-gray", attended: "badge-green",
                  late_cancel: "badge-amber", no_show: "badge-red", cancelled: "badge-gray",
                };
                return (
                  <div key={s.id} className="px-5 py-2.5 border-b border-surface-200 last:border-0 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: th?.color || "#999" }} />
                      <div>
                        <div className="font-semibold text-sm">{cl ? `${cl.first_name} ${cl.last_name}` : "Unknown"}</div>
                        <div className="text-xs text-ink-400">{th?.name} &middot; {svc?.name}</div>
                      </div>
                    </div>
                    <span className={`badge ${statusBadge[s.status] || "badge-gray"}`}>
                      {s.status.replace("_", " ")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Outstanding Balances */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3 bg-surface-50 border-b border-surface-200 flex items-center justify-between">
            <h3 className="font-semibold">Outstanding Balances</h3>
            <button onClick={() => router.push("/payments")} className="btn-ghost btn-sm text-brand-600">Payments &rarr;</button>
          </div>
          {topBalances.length === 0 ? (
            <div className="p-8 text-center text-ink-400 text-sm">All accounts are current</div>
          ) : (
            <div>
              {topBalances.map(({ client: c, balance }) => (
                <div key={c.id} className="px-5 py-2.5 border-b border-surface-200 last:border-0 flex items-center justify-between">
                  <button onClick={() => router.push(`/clients/${c.id}`)}
                    className="font-semibold text-sm text-brand-600 hover:text-brand-800">
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
        </div>
      </div>
    </div>
  );
}
