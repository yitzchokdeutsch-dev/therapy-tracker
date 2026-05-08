"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Client { id: string; first_name: string; last_name: string; active: boolean; }
interface Payment { id: string; client_id: string; payment_date: string; amount: number; method: string; reference: string; notes: string; created_at: string; }

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "card", label: "Credit/Debit Card" },
  { value: "insurance", label: "Insurance" },
  { value: "other", label: "Other" },
];

export default function PaymentsPage() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [clients, setClients] = useState<Client[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    client_id: "",
    amount: "",
    method: "cash",
    reference: "",
    notes: "",
    payment_date: todayStr,
  });

  const [filterMonth, setFilterMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
  const [searchClient, setSearchClient] = useState("");

  const load = useCallback(async () => {
    const cRes = await supabase.from("clients").select("id, first_name, last_name, active").order("last_name, first_name");
    setClients(cRes.data || []);

    const pRes = await supabase.from("payments").select("*").order("payment_date", { ascending: false }).limit(200);
    setPayments(pRes.data || []);

    // Calculate balances
    const chRes = await supabase.from("charges").select("client_id, amount");
    const pmRes = await supabase.from("payments").select("client_id, amount");
    const bals: Record<string, number> = {};
    (chRes.data || []).forEach((c: any) => { bals[c.client_id] = (bals[c.client_id] || 0) + Number(c.amount); });
    (pmRes.data || []).forEach((p: any) => { bals[p.client_id] = (bals[p.client_id] || 0) - Number(p.amount); });
    setBalances(bals);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const getClient = (id: string) => clients.find((c) => c.id === id);
  const fmt = (n: number) => "$" + Math.abs(n).toFixed(2);

  const savePayment = async () => {
    if (!form.client_id || !form.amount || Number(form.amount) <= 0) return;
    setSaving(true);

    await supabase.from("payments").insert({
      client_id: form.client_id,
      payment_date: form.payment_date,
      amount: parseFloat(form.amount),
      method: form.method,
      reference: form.reference.trim() || null,
      notes: form.notes.trim() || null,
    });

    setForm({ ...form, amount: "", reference: "", notes: "" });
    setSaving(false);
    load();
  };

  const deletePayment = async (id: string) => {
    if (!confirm("Delete this payment? This will affect the client's balance.")) return;
    await supabase.from("payments").delete().eq("id", id);
    load();
  };

  // Filter payments by month
  const filteredPayments = payments.filter((p) => {
    const matchMonth = p.payment_date.startsWith(filterMonth);
    const cl = getClient(p.client_id);
    const matchSearch = !searchClient || (cl && `${cl.first_name} ${cl.last_name}`.toLowerCase().includes(searchClient.toLowerCase()));
    return matchMonth && matchSearch;
  });

  const monthTotal = filteredPayments.reduce((s, p) => s + Number(p.amount), 0);

  // Clients sorted by balance (highest first) for quick reference
  const clientsByBalance = [...clients]
    .filter((c) => c.active && (balances[c.id] || 0) > 0)
    .sort((a, b) => (balances[b.id] || 0) - (balances[a.id] || 0));

  if (loading) return <div className="text-ink-400 py-12 text-center">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Payments</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Record Payment */}
        <div>
          <div className="card p-5 mb-4">
            <h3 className="font-semibold mb-4">Record Payment</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Client *</label>
                <select className="input-field" value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                  <option value="">Select client...</option>
                  {clients.filter((c) => c.active).map((c) => {
                    const bal = balances[c.id] || 0;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name}{bal > 0 ? ` — owes ${fmt(bal)}` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              {form.client_id && (balances[form.client_id] || 0) > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                  Balance due: <span className="font-bold text-red-600">{fmt(balances[form.client_id])}</span>
                </div>
              )}

              <div>
                <label className="label">Amount *</label>
                <input className="input-field" type="number" step="0.01" placeholder="0.00" value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>

              <div>
                <label className="label">Date</label>
                <input className="input-field" type="date" value={form.payment_date}
                  onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
              </div>

              <div>
                <label className="label">Method</label>
                <select className="input-field" value={form.method}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Reference (optional)</label>
                <input className="input-field" placeholder="Check #, last 4 digits, claim #..." value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              </div>

              <div>
                <label className="label">Note (optional)</label>
                <input className="input-field" placeholder="Any additional info..." value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>

              <button onClick={savePayment}
                disabled={saving || !form.client_id || !form.amount || Number(form.amount) <= 0}
                className="btn-primary w-full">
                {saving ? "Saving..." : "Record Payment"}
              </button>
            </div>
          </div>

          {/* Outstanding Balances */}
          {clientsByBalance.length > 0 && (
            <div className="card p-4">
              <h3 className="font-semibold text-sm mb-3">Outstanding Balances</h3>
              <div className="space-y-2 max-h-64 overflow-auto">
                {clientsByBalance.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-surface-200 last:border-0">
                    <button
                      onClick={() => setForm({ ...form, client_id: c.id })}
                      className="text-sm font-medium text-brand-600 hover:text-brand-800 text-left">
                      {c.first_name} {c.last_name}
                    </button>
                    <span className="text-sm font-bold text-red-600">{fmt(balances[c.id])}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-surface-200 mt-2 pt-2 flex justify-between">
                <span className="text-xs font-semibold text-ink-500">Total Outstanding</span>
                <span className="text-sm font-bold text-red-600">
                  {fmt(clientsByBalance.reduce((s, c) => s + (balances[c.id] || 0), 0))}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Payment History */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
            <h3 className="font-semibold">Payment History</h3>
            <div className="flex items-center gap-2">
              <input className="input-field w-48 py-1.5 text-sm" placeholder="Search client..."
                value={searchClient} onChange={(e) => setSearchClient(e.target.value)} />
              <input type="month" className="input-field w-40 py-1.5 text-sm" value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)} />
            </div>
          </div>

          {/* Month Summary */}
          <div className="card p-3 mb-3 flex items-center justify-between">
            <span className="text-sm text-ink-500">{filteredPayments.length} payment{filteredPayments.length !== 1 ? "s" : ""} this month</span>
            <span className="font-bold text-emerald-600 text-lg">{fmt(monthTotal)}</span>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="card p-10 text-center text-ink-400">No payments found for this period.</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-200">
                    <th className="table-header">Date</th>
                    <th className="table-header">Client</th>
                    <th className="table-header">Method</th>
                    <th className="table-header">Reference</th>
                    <th className="table-header text-right">Amount</th>
                    <th className="table-header text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p) => {
                    const cl = getClient(p.client_id);
                    const methodLabel = METHODS.find((m) => m.value === p.method)?.label || p.method;
                    return (
                      <tr key={p.id} className="table-row">
                        <td className="table-cell text-sm">{p.payment_date}</td>
                        <td className="table-cell font-semibold text-sm">
                          {cl ? `${cl.first_name} ${cl.last_name}` : "Unknown"}
                        </td>
                        <td className="table-cell">
                          <span className="badge badge-gray">{methodLabel}</span>
                        </td>
                        <td className="table-cell text-ink-500 text-sm">{p.reference || "\u2014"}</td>
                        <td className="table-cell text-right font-bold text-emerald-600">{fmt(Number(p.amount))}</td>
                        <td className="table-cell text-right">
                          <button onClick={() => deletePayment(p.id)} className="btn-ghost btn-sm text-red-500">Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
