"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Client { id: string; first_name: string; last_name: string; phone: string; email: string; guardian: string; address: string; active: boolean; }
interface Charge { id: string; client_id: string; charge_date: string; description: string; amount: number; }
interface Payment { id: string; client_id: string; payment_date: string; amount: number; method: string; reference: string; }

export default function BillingPage() {
  const today = new Date();
  const [billingMonth, setBillingMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
  const [selectedClient, setSelectedClient] = useState("all");
  const [clients, setClients] = useState<Client[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allCharges, setAllCharges] = useState<Charge[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [cRes, chRes, pRes, achRes, apRes] = await Promise.all([
      supabase.from("clients").select("*").eq("active", true).order("last_name, first_name").then(r => r),
      supabase.from("charges").select("*").gte("charge_date", billingMonth + "-01").lte("charge_date", billingMonth + "-31").order("charge_date").then(r => r),
      supabase.from("payments").select("*").gte("payment_date", billingMonth + "-01").lte("payment_date", billingMonth + "-31").order("payment_date").then(r => r),
      supabase.from("charges").select("*").lt("charge_date", billingMonth + "-01").order("charge_date").then(r => r),
      supabase.from("payments").select("*").lt("payment_date", billingMonth + "-01").order("payment_date").then(r => r),
    ]);
    setClients(cRes.data || []);
    setCharges(chRes.data || []);
    setPayments(pRes.data || []);
    setAllCharges(achRes.data || []);
    setAllPayments(apRes.data || []);
    setLoading(false);
  }, [billingMonth]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const fmt = (n: number) => "$" + Math.abs(n).toFixed(2);

  const billClients = selectedClient === "all"
    ? clients.filter((c) => {
        // Only include clients with activity
        const hasCharges = charges.some((ch) => ch.client_id === c.id) || allCharges.some((ch) => ch.client_id === c.id);
        const hasPayments = payments.some((p) => p.client_id === c.id) || allPayments.some((p) => p.client_id === c.id);
        return hasCharges || hasPayments;
      })
    : clients.filter((c) => c.id === selectedClient);

  const monthName = new Date(billingMonth + "-15").toLocaleDateString("en-US", { month: "long", year: "numeric" });

  if (loading) return <div className="text-ink-400 py-12 text-center">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Monthly Billing</h1>

      {/* Controls - hidden when printing */}
      <div className="flex items-end gap-3 mb-6 flex-wrap print:hidden">
        <div>
          <label className="label">Billing Month</label>
          <input type="month" className="input-field w-44" value={billingMonth}
            onChange={(e) => setBillingMonth(e.target.value)} />
        </div>
        <div>
          <label className="label">Client</label>
          <select className="input-field w-56" value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}>
            <option value="all">All Clients ({billClients.length})</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
          </select>
        </div>
        <button onClick={() => window.print()} className="btn-primary">
          Print Bills
        </button>
      </div>

      {/* Summary - hidden when printing */}
      <div className="card p-4 mb-6 print:hidden">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-xs text-ink-400 uppercase font-semibold">Clients</div>
            <div className="text-2xl font-bold">{billClients.length}</div>
          </div>
          <div>
            <div className="text-xs text-ink-400 uppercase font-semibold">Total Charged</div>
            <div className="text-2xl font-bold text-red-600">
              {fmt(charges.filter((ch) => billClients.some((c) => c.id === ch.client_id)).reduce((s, ch) => s + Number(ch.amount), 0))}
            </div>
          </div>
          <div>
            <div className="text-xs text-ink-400 uppercase font-semibold">Total Received</div>
            <div className="text-2xl font-bold text-emerald-600">
              {fmt(payments.filter((p) => billClients.some((c) => c.id === p.client_id)).reduce((s, p) => s + Number(p.amount), 0))}
            </div>
          </div>
          <div>
            <div className="text-xs text-ink-400 uppercase font-semibold">Total Outstanding</div>
            <div className="text-2xl font-bold text-ink-900">
              {fmt(billClients.reduce((total, c) => {
                const prevCh = allCharges.filter((ch) => ch.client_id === c.id).reduce((s, ch) => s + Number(ch.amount), 0);
                const prevPm = allPayments.filter((p) => p.client_id === c.id).reduce((s, p) => s + Number(p.amount), 0);
                const mCh = charges.filter((ch) => ch.client_id === c.id).reduce((s, ch) => s + Number(ch.amount), 0);
                const mPm = payments.filter((p) => p.client_id === c.id).reduce((s, p) => s + Number(p.amount), 0);
                return total + Math.max(0, (prevCh - prevPm) + mCh - mPm);
              }, 0))}
            </div>
          </div>
        </div>
      </div>

      {/* Bills */}
      {billClients.length === 0 ? (
        <div className="card p-12 text-center text-ink-400 print:hidden">
          No billing activity for {monthName}.
        </div>
      ) : (
        billClients.map((c) => {
          const mCharges = charges.filter((ch) => ch.client_id === c.id);
          const mPayments = payments.filter((p) => p.client_id === c.id);
          const prevCharges = allCharges.filter((ch) => ch.client_id === c.id).reduce((s, ch) => s + Number(ch.amount), 0);
          const prevPayments = allPayments.filter((p) => p.client_id === c.id).reduce((s, p) => s + Number(p.amount), 0);
          const prevBal = prevCharges - prevPayments;
          const mChargeTotal = mCharges.reduce((s, ch) => s + Number(ch.amount), 0);
          const mPayTotal = mPayments.reduce((s, p) => s + Number(p.amount), 0);
          const newBal = prevBal + mChargeTotal - mPayTotal;

          return (
            <div key={c.id} className="card mb-6 overflow-hidden" style={{ pageBreakAfter: "always", pageBreakInside: "avoid" }}>
              {/* Statement Header */}
              <div className="bg-surface-50 border-b border-surface-200 px-6 py-4">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="text-xs text-ink-400 uppercase tracking-wider font-bold mb-1">Statement &middot; {monthName}</div>
                    <h2 className="text-xl font-bold">{c.first_name} {c.last_name}</h2>
                    <div className="text-sm text-ink-500 mt-0.5">
                      {c.guardian && <span>{c.guardian} &middot; </span>}
                      {c.phone && <span>{c.phone} &middot; </span>}
                      {c.email && <span>{c.email}</span>}
                    </div>
                    {c.address && <div className="text-sm text-ink-400">{c.address}</div>}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-ink-400 uppercase font-semibold">Amount Due</div>
                    <div className={`text-3xl font-bold ${newBal > 0 ? "text-red-600" : newBal < 0 ? "text-emerald-600" : "text-ink-500"}`}>
                      {newBal > 0 ? fmt(newBal) : newBal < 0 ? `-${fmt(newBal)}` : "$0.00"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4">
                {/* Previous Balance */}
                {prevBal !== 0 && (
                  <div className="flex justify-between py-2 px-3 bg-surface-50 rounded-lg mb-4 text-sm">
                    <span>Previous Balance</span>
                    <span className="font-bold">{prevBal > 0 ? fmt(prevBal) : `-${fmt(prevBal)}`}</span>
                  </div>
                )}

                {/* Charges */}
                {mCharges.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-bold text-ink-400 uppercase tracking-wide mb-2">Charges</div>
                    {mCharges.map((ch) => (
                      <div key={ch.id} className="flex justify-between py-1.5 border-b border-surface-200 text-sm">
                        <span>
                          <span className="text-ink-500">{ch.charge_date}</span>
                          <span className="ml-3">{ch.description}</span>
                        </span>
                        <span className="font-semibold">{fmt(Number(ch.amount))}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-bold text-sm">
                      <span>Total Charges</span>
                      <span>{fmt(mChargeTotal)}</span>
                    </div>
                  </div>
                )}

                {/* Payments */}
                {mPayments.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-bold text-ink-400 uppercase tracking-wide mb-2">Payments Received</div>
                    {mPayments.map((p) => {
                      const methodLabel = p.method.charAt(0).toUpperCase() + p.method.slice(1);
                      return (
                        <div key={p.id} className="flex justify-between py-1.5 border-b border-surface-200 text-sm">
                          <span>
                            <span className="text-ink-500">{p.payment_date}</span>
                            <span className="ml-3">{methodLabel}{p.reference ? ` (${p.reference})` : ""}</span>
                          </span>
                          <span className="font-semibold text-emerald-600">-{fmt(Number(p.amount))}</span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between py-2 font-bold text-sm text-emerald-600">
                      <span>Total Payments</span>
                      <span>-{fmt(mPayTotal)}</span>
                    </div>
                  </div>
                )}

                {/* Balance Due */}
                <div className={`flex justify-between py-3 px-4 rounded-lg text-lg font-bold ${
                  newBal > 0 ? "bg-red-50 text-red-700" : newBal < 0 ? "bg-emerald-50 text-emerald-700" : "bg-surface-100 text-ink-500"
                }`}>
                  <span>{newBal > 0 ? "Balance Due" : newBal < 0 ? "Credit Balance" : "Paid in Full"}</span>
                  <span>{newBal !== 0 ? (newBal > 0 ? fmt(newBal) : `-${fmt(newBal)}`) : "$0.00"}</span>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          aside { display: none !important; }
          main { margin-left: 0 !important; }
          .card { box-shadow: none !important; border: 1px solid #e5e7eb !important; }
        }
      `}</style>
    </div>
  );
}
