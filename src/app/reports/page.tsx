"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useClients, useTherapists } from "@/hooks";
import { fmt } from "@/lib/utils";

interface MonthStat {
  month: string;
  label: string;
  total: number;
  attended: number;
  noShow: number;
  lateCancel: number;
  cancelled: number;
  charged: number;
  collected: number;
}

interface TherapistStat {
  id: string;
  name: string;
  color: string;
  total: number;
  attended: number;
  rate: number;
}

interface AgingRow {
  clientId: string;
  name: string;
  balance: number;
  current: number;
  days30: number;
  days60: number;
  days90plus: number;
}

export default function ReportsPage() {
  const [monthStats,     setMonthStats]     = useState<MonthStat[]>([]);
  const [therapistStats, setTherapistStats] = useState<TherapistStat[]>([]);
  const [aging,          setAging]          = useState<AgingRow[]>([]);
  const [loading,        setLoading]        = useState(true);

  const { data: clients    = [] } = useClients();
  const { data: therapists = [] } = useTherapists();

  useEffect(() => {
    if (!therapists.length) return;
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [therapists.length, clients.length]);

  const load = async () => {
    setLoading(true);

    const today      = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    // Sessions for last 6 months
    const sixMonthsAgo = months[0] + "-01";
    const { data: sessions } = await supabase
      .from("sessions").select("session_date, status, therapist_id")
      .gte("session_date", sixMonthsAgo)
      .is("deleted_at", null);

    // Charges + payments for last 6 months
    const { data: charges  } = await supabase.from("charges").select("charge_date, amount").gte("charge_date", sixMonthsAgo).is("deleted_at", null);
    const { data: payments } = await supabase.from("payments").select("payment_date, amount").gte("payment_date", sixMonthsAgo).is("deleted_at", null);

    // Month stats
    const mStats: MonthStat[] = months.map((m) => {
      const label = new Date(m + "-15").toLocaleDateString("en-US", { month: "short", year: "numeric" });
      const mSessions = (sessions || []).filter((s) => s.session_date.startsWith(m));
      const [y, mo] = m.split("-").map(Number);
      const lastDay = new Date(y, mo, 0).getDate();
      const mEnd = `${m}-${String(lastDay).padStart(2, "0")}`;
      const mCharges  = (charges  || []).filter((c) => c.charge_date  >= m + "-01" && c.charge_date  <= mEnd).reduce((s: number, c: any) => s + Number(c.amount), 0);
      const mPayments = (payments || []).filter((p) => p.payment_date >= m + "-01" && p.payment_date <= mEnd).reduce((s: number, p: any) => s + Number(p.amount), 0);
      return {
        month: m, label,
        total:      mSessions.length,
        attended:   mSessions.filter((s) => s.status === "attended").length,
        noShow:     mSessions.filter((s) => s.status === "no_show").length,
        lateCancel: mSessions.filter((s) => s.status === "late_cancel").length,
        cancelled:  mSessions.filter((s) => s.status === "cancelled").length,
        charged:    mCharges,
        collected:  mPayments,
      };
    });
    setMonthStats(mStats);

    // Therapist stats (current month)
    const thisMo = months[months.length - 1];
    const tStats: TherapistStat[] = therapists.map((t) => {
      const tSessions = (sessions || []).filter((s) => s.therapist_id === t.id && s.session_date.startsWith(thisMo));
      const attended  = tSessions.filter((s) => s.status === "attended").length;
      return { id: t.id, name: t.name, color: t.color, total: tSessions.length, attended, rate: tSessions.length > 0 ? Math.round((attended / tSessions.length) * 100) : 0 };
    }).filter((t) => t.total > 0);
    setTherapistStats(tStats);

    // Balance aging
    const now = new Date();
    const { data: allCharges  } = await supabase.from("charges").select("client_id, charge_date, amount").is("deleted_at", null);
    const { data: allPayments } = await supabase.from("payments").select("client_id, amount").is("deleted_at", null);

    const agingRows: AgingRow[] = clients
      .filter((c) => c.active)
      .map((c) => {
        const cCharges  = (allCharges  || []).filter((ch) => ch.client_id === c.id);
        const cPayments = (allPayments || []).filter((p)  => p.client_id  === c.id);
        const balance   = cCharges.reduce((s: number, ch: any) => s + Number(ch.amount), 0) - cPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
        if (balance <= 0) return null;

        const current  = cCharges.filter((ch: any) => daysDiff(now, new Date(ch.charge_date)) < 30).reduce((s: number, ch: any) => s + Number(ch.amount), 0);
        const days30   = cCharges.filter((ch: any) => { const d = daysDiff(now, new Date(ch.charge_date)); return d >= 30 && d < 60; }).reduce((s: number, ch: any) => s + Number(ch.amount), 0);
        const days60   = cCharges.filter((ch: any) => { const d = daysDiff(now, new Date(ch.charge_date)); return d >= 60 && d < 90; }).reduce((s: number, ch: any) => s + Number(ch.amount), 0);
        const days90   = cCharges.filter((ch: any) => daysDiff(now, new Date(ch.charge_date)) >= 90).reduce((s: number, ch: any) => s + Number(ch.amount), 0);

        return { clientId: c.id, name: `${c.first_name} ${c.last_name}`, balance, current, days30, days60, days90plus: days90 };
      })
      .filter(Boolean) as AgingRow[];

    setAging(agingRows.sort((a, b) => b.balance - a.balance));
    setLoading(false);
  };

  const daysDiff = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / 86400000);

  if (loading) return <div className="text-ink-400 py-12 text-center">Loading reports...</div>;

  const totals = monthStats[monthStats.length - 1];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Reports</h1>

      {/* Top stats — current month */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Sessions This Month", value: totals.total.toString(), sub: `${totals.attended} attended` },
            { label: "Attendance Rate",     value: totals.total > 0 ? `${Math.round((totals.attended / totals.total) * 100)}%` : "—", sub: `${totals.noShow} no-shows` },
            { label: "Revenue Charged",     value: fmt(totals.charged),   sub: "this month" },
            { label: "Payments Collected",  value: fmt(totals.collected), sub: `${fmt(totals.charged - totals.collected)} outstanding` },
          ].map(({ label, value, sub }) => (
            <div key={label} className="card p-4">
              <div className="text-xs text-ink-400 uppercase tracking-wide font-semibold">{label}</div>
              <div className="text-2xl font-bold mt-1">{value}</div>
              <div className="text-xs text-ink-500 mt-0.5">{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Sessions by month */}
      <div className="card overflow-hidden mb-6">
        <div className="px-5 py-3 bg-surface-50 border-b border-surface-200">
          <h3 className="font-semibold">Sessions — Last 6 Months</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-surface-200">
              <th className="table-header">Month</th>
              <th className="table-header text-right">Total</th>
              <th className="table-header text-right">Attended</th>
              <th className="table-header text-right">No-Show</th>
              <th className="table-header text-right">Late Cancel</th>
              <th className="table-header text-right">Rate</th>
              <th className="table-header text-right">Charged</th>
              <th className="table-header text-right">Collected</th>
            </tr></thead>
            <tbody>
              {monthStats.map((m) => (
                <tr key={m.month} className="table-row">
                  <td className="table-cell font-semibold">{m.label}</td>
                  <td className="table-cell text-right">{m.total}</td>
                  <td className="table-cell text-right text-emerald-600 font-semibold">{m.attended}</td>
                  <td className="table-cell text-right text-red-500">{m.noShow}</td>
                  <td className="table-cell text-right text-amber-500">{m.lateCancel}</td>
                  <td className="table-cell text-right">
                    <span className={m.total > 0 && m.attended / m.total < 0.7 ? "text-red-500 font-semibold" : ""}>
                      {m.total > 0 ? `${Math.round((m.attended / m.total) * 100)}%` : "—"}
                    </span>
                  </td>
                  <td className="table-cell text-right">{fmt(m.charged)}</td>
                  <td className="table-cell text-right text-emerald-600">{fmt(m.collected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* This month by therapist */}
      {therapistStats.length > 0 && (
        <div className="card overflow-hidden mb-6">
          <div className="px-5 py-3 bg-surface-50 border-b border-surface-200">
            <h3 className="font-semibold">This Month by Therapist</h3>
          </div>
          <div className="divide-y divide-surface-200">
            {therapistStats.map((t) => (
              <div key={t.id} className="px-5 py-3 flex items-center gap-4">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                <span className="font-semibold text-sm flex-1">{t.name}</span>
                <span className="text-sm text-ink-500">{t.total} sessions</span>
                <span className="text-sm text-emerald-600 font-semibold w-16 text-right">{t.attended} attended</span>
                <div className="w-32 bg-surface-200 rounded-full h-2">
                  <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${t.rate}%` }} />
                </div>
                <span className="text-sm font-bold w-10 text-right">{t.rate}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outstanding balance aging */}
      {aging.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 bg-surface-50 border-b border-surface-200 flex items-center justify-between">
            <h3 className="font-semibold">Outstanding Balance Aging</h3>
            <span className="text-sm text-ink-500">{aging.length} client{aging.length !== 1 ? "s" : ""} with balances</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-surface-200">
                <th className="table-header">Client</th>
                <th className="table-header text-right">Total Due</th>
                <th className="table-header text-right">Current</th>
                <th className="table-header text-right">30+ days</th>
                <th className="table-header text-right">60+ days</th>
                <th className="table-header text-right text-red-500">90+ days</th>
              </tr></thead>
              <tbody>
                {aging.map((row) => (
                  <tr key={row.clientId} className="table-row">
                    <td className="table-cell font-semibold">{row.name}</td>
                    <td className="table-cell text-right font-bold text-red-600">{fmt(row.balance)}</td>
                    <td className="table-cell text-right">{row.current > 0 ? fmt(row.current) : "—"}</td>
                    <td className="table-cell text-right">{row.days30 > 0 ? fmt(row.days30) : "—"}</td>
                    <td className="table-cell text-right text-amber-600">{row.days60 > 0 ? fmt(row.days60) : "—"}</td>
                    <td className="table-cell text-right text-red-600 font-semibold">{row.days90plus > 0 ? fmt(row.days90plus) : "—"}</td>
                  </tr>
                ))}
                <tr className="bg-surface-50 border-t border-surface-200 font-semibold">
                  <td className="table-cell">Total</td>
                  <td className="table-cell text-right text-red-600">{fmt(aging.reduce((s, r) => s + r.balance, 0))}</td>
                  <td className="table-cell text-right">{fmt(aging.reduce((s, r) => s + r.current, 0))}</td>
                  <td className="table-cell text-right">{fmt(aging.reduce((s, r) => s + r.days30, 0))}</td>
                  <td className="table-cell text-right">{fmt(aging.reduce((s, r) => s + r.days60, 0))}</td>
                  <td className="table-cell text-right text-red-600">{fmt(aging.reduce((s, r) => s + r.days90plus, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
