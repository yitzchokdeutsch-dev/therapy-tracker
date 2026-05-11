"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useClients } from "@/hooks";
import { fmt } from "@/lib/utils";
import type { Client } from "@/lib/types";

interface Charge {
  id: string;
  charge_date: string;
  description: string;
  amount: number;
  session_id: string | null;
}

interface Session {
  id: string;
  service_type_id: string;
  session_time: string | null;
}

interface ServiceType {
  id: string;
  name: string;
  cpt_code: string | null;
  duration: number;
}

export default function SuperbillPage() {
  const [selectedClient, setSelectedClient] = useState("");
  const [billingMonth, setBillingMonth]     = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const [client,       setClient]       = useState<Client | null>(null);
  const [charges,      setCharges]      = useState<Charge[]>([]);
  const [sessions,     setSessions]     = useState<Session[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [settings,     setSettings]     = useState<Record<string, string>>({});
  const [loading,      setLoading]      = useState(false);

  const { data: clients = [] } = useClients(true);

  useEffect(() => {
    supabase.from("settings").select("key, value").then(({ data }) => {
      const map: Record<string, string> = {};
      (data || []).forEach((r) => { map[r.key] = r.value || ""; });
      setSettings(map);
    });
    supabase.from("service_types").select("id, name, cpt_code, duration").then(({ data }) => {
      setServiceTypes(data || []);
    });
  }, []);

  useEffect(() => {
    if (!selectedClient) return;
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient, billingMonth]);

  const loadData = async () => {
    setLoading(true);
    const [y, m] = billingMonth.split("-").map(Number);
    const start  = `${billingMonth}-01`;
    const end    = `${billingMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;

    const [clientRes, chargesRes, sessionsRes] = await Promise.all([
      supabase.from("clients").select("*").eq("id", selectedClient).single(),
      supabase.from("charges").select("*").eq("client_id", selectedClient)
        .gte("charge_date", start).lte("charge_date", end).is("deleted_at", null).order("charge_date"),
      supabase.from("sessions").select("id, service_type_id, session_time")
        .eq("client_id", selectedClient).gte("session_date", start).lte("session_date", end)
        .eq("status", "attended").is("deleted_at", null),
    ]);

    setClient(clientRes.data);
    setCharges(chargesRes.data || []);
    setSessions(sessionsRes.data || []);
    setLoading(false);
  };

  const g = (key: string) => settings[key] || "";
  const getSvc = (id: string) => serviceTypes.find((s) => s.id === id);
  const getSvcForCharge = (charge: Charge) => {
    const session = sessions.find((s) => s.id === charge.session_id);
    return session ? getSvc(session.service_type_id) : null;
  };

  const total        = charges.reduce((s, c) => s + Number(c.amount), 0);
  const monthLabel   = new Date(billingMonth + "-15").toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div>
      {/* Controls — hidden on print */}
      <div className="print:hidden mb-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Superbill Generator</h1>
          <button onClick={() => window.print()} disabled={!client} className="btn-primary">
            Print / Save PDF
          </button>
        </div>
        <div className="card p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="label">Client</label>
            <select className="input-field w-56" value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}>
              <option value="">Select client...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Month</label>
            <input type="month" className="input-field w-44" value={billingMonth} onChange={(e) => setBillingMonth(e.target.value)} />
          </div>
        </div>
        {selectedClient && !loading && charges.length === 0 && (
          <div className="card p-8 text-center text-ink-400">No charges for this client in {monthLabel}.</div>
        )}
      </div>

      {/* Superbill — printable */}
      {client && charges.length > 0 && !loading && (
        <div className="max-w-3xl mx-auto bg-white" id="superbill">
          {/* Header */}
          <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-ink-900">
            <div>
              <h1 className="text-2xl font-bold text-ink-900">{g("clinic_name") || "Therapy Clinic"}</h1>
              {g("clinic_address") && <div className="text-sm text-ink-600 mt-1">{g("clinic_address")}</div>}
              {g("clinic_phone")   && <div className="text-sm text-ink-600">{g("clinic_phone")}</div>}
              {g("clinic_npi")     && <div className="text-xs text-ink-400 mt-1">NPI: {g("clinic_npi")}</div>}
              {g("clinic_tax_id")  && <div className="text-xs text-ink-400">Tax ID: {g("clinic_tax_id")}</div>}
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-ink-900 uppercase tracking-wide">Superbill</div>
              <div className="text-sm text-ink-500 mt-1">{monthLabel}</div>
              <div className="text-xs text-ink-400 mt-1">Printed: {new Date().toLocaleDateString()}</div>
            </div>
          </div>

          {/* Patient + Insurance side by side */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-ink-400 mb-2">Patient Information</div>
              <table className="text-sm w-full">
                <tbody>
                  {[
                    ["Patient Name",   `${client.first_name} ${client.last_name}`],
                    ["Date of Birth",  client.start_date || "—"],
                    ["Guardian",       client.guardian   || "—"],
                    ["Phone",          client.phone      || "—"],
                    ["Address",        client.address    || "—"],
                    ...(client.diagnosis_codes?.length > 0
                      ? [["Diagnosis (ICD-10)", client.diagnosis_codes.join(", ")]] : []),
                  ].map(([label, value]) => (
                    <tr key={label} className="border-b border-surface-100">
                      <td className="py-1 font-semibold text-ink-500 pr-3 whitespace-nowrap">{label}</td>
                      <td className="py-1">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-ink-400 mb-2">Insurance Information</div>
              <table className="text-sm w-full">
                <tbody>
                  {[
                    ["Insurance",    client.insurance_company || "—"],
                    ["Policy #",     client.policy_number     || "—"],
                    ["Group #",      client.group_number      || "—"],
                    ["Subscriber",   client.subscriber_name   || "—"],
                    ["Auth #",       client.auth_number       || "—"],
                    ["Auth Expiry",  client.auth_expiration   || "—"],
                  ].map(([label, value]) => (
                    <tr key={label} className="border-b border-surface-100">
                      <td className="py-1 font-semibold text-ink-500 pr-3 whitespace-nowrap">{label}</td>
                      <td className="py-1">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Services table */}
          <div className="mb-6">
            <div className="text-xs font-bold uppercase tracking-wide text-ink-400 mb-2">Services Rendered</div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-ink-900">
                  <th className="text-left py-2 font-semibold">Date</th>
                  <th className="text-left py-2 font-semibold">CPT Code</th>
                  <th className="text-left py-2 font-semibold">Service Description</th>
                  <th className="text-left py-2 font-semibold">Diagnosis</th>
                  <th className="text-right py-2 font-semibold">Fee</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((c) => {
                  const svc = getSvcForCharge(c);
                  return (
                    <tr key={c.id} className="border-b border-surface-200">
                      <td className="py-2 whitespace-nowrap">{c.charge_date}</td>
                      <td className="py-2 font-mono">{svc?.cpt_code || "—"}</td>
                      <td className="py-2">{c.description}{svc ? ` (${svc.duration} min)` : ""}</td>
                      <td className="py-2 font-mono text-xs">{client.diagnosis_codes?.[0] || "—"}</td>
                      <td className="py-2 text-right font-semibold">{fmt(Number(c.amount))}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink-900">
                  <td colSpan={4} className="py-3 font-bold text-right pr-4">Total Charges</td>
                  <td className="py-3 font-bold text-right text-lg">{fmt(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Provider signature */}
          <div className="grid grid-cols-2 gap-8 mt-8 pt-6 border-t border-surface-200">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-ink-400 mb-3">Rendering Provider</div>
              <div className="text-sm">{g("provider_name") || "___________________________"}</div>
              {g("provider_credentials") && <div className="text-xs text-ink-500">{g("provider_credentials")}</div>}
              {g("clinic_npi") && <div className="text-xs text-ink-400 mt-1">NPI: {g("clinic_npi")}</div>}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-ink-400 mb-3">Signature</div>
              <div className="border-b border-ink-900 mt-8 w-full" />
              <div className="text-xs text-ink-400 mt-1">Signature / Date</div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-surface-200 text-xs text-ink-400 text-center">
            This superbill may be submitted to your insurance company for reimbursement.
            Please retain a copy for your records.
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          aside, header { display: none !important; }
          main { margin-left: 0 !important; padding: 0 !important; }
          #superbill { max-width: 100% !important; }
        }
      `}</style>
    </div>
  );
}
