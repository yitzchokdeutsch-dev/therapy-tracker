"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAllTherapists, useAllServiceTypes } from "@/hooks";
import { fmt, DAYS, DAYS_FULL } from "@/lib/utils";
import type { Therapist, ServiceType, Fee, TherapistSchedule } from "@/lib/types";

type Tab = "therapists" | "services" | "fees";

const COLORS = ["#2563eb","#7c3aed","#059669","#dc2626","#d97706","#0891b2","#be185d","#4f46e5","#15803d","#b45309"];

export default function SetupPage() {
  const [tab, setTab] = useState<Tab>("therapists");
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Setup</h1>
      <div className="flex gap-1 bg-surface-100 rounded-lg p-1 w-fit mb-6">
        {([{ id: "therapists", label: "Therapists" }, { id: "services", label: "Service Types" }, { id: "fees", label: "Fees" }] as const).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-md text-sm font-semibold transition-all ${tab === t.id ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "therapists" && <TherapistsTab />}
      {tab === "services" && <ServicesTab />}
      {tab === "fees" && <FeesTab />}
    </div>
  );
}

function TherapistsTab() {
  const queryClient = useQueryClient();
  const { data: therapists = [], isLoading } = useAllTherapists();
  const [schedules, setSchedules] = useState<TherapistSchedule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", color: COLORS[0] });
  const [saving, setSaving] = useState(false);
  const [editHoursId, setEditHoursId] = useState<string | null>(null);

  const loadSchedules = async () => {
    const { data } = await supabase.from("therapist_schedules").select("*").order("day_of_week");
    setSchedules(data || []);
  };
  useEffect(() => { loadSchedules(); }, []);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["therapists"] });
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const payload = { name: form.name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null, color: form.color };
    if (editId) { await supabase.from("therapists").update(payload).eq("id", editId); }
    else { await supabase.from("therapists").insert(payload); }
    setSaving(false);
    setShowForm(false);
    invalidate();
  };

  const toggleActive = async (t: Therapist) => {
    await supabase.from("therapists").update({ active: !t.active }).eq("id", t.id);
    invalidate();
  };

  const toggleDay = async (therapistId: string, day: number) => {
    const existing = schedules.find((s) => s.therapist_id === therapistId && s.day_of_week === day);
    if (existing) {
      await supabase.from("therapist_schedules").delete().eq("id", existing.id);
    } else {
      await supabase.from("therapist_schedules").insert({ therapist_id: therapistId, day_of_week: day, start_time: "09:00", end_time: "17:00" });
    }
    loadSchedules();
  };

  const updateScheduleTime = async (scheduleId: string, field: "start_time" | "end_time", value: string) => {
    await supabase.from("therapist_schedules").update({ [field]: value }).eq("id", scheduleId);
    loadSchedules();
  };

  if (isLoading) return <div className="text-ink-400 py-12 text-center">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-ink-500">{therapists.length} therapist{therapists.length !== 1 ? "s" : ""}</p>
        <button onClick={() => { setForm({ name: "", email: "", phone: "", color: COLORS[therapists.length % COLORS.length] }); setEditId(null); setShowForm(true); }} className="btn-primary btn-sm">
          + Add Therapist
        </button>
      </div>

      {showForm && (
        <div className="card p-5 mb-4">
          <h3 className="font-semibold mb-4">{editId ? "Edit" : "Add"} Therapist</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div><label className="label">Name *</label><input className="input-field" placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input-field" placeholder="email@clinic.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">Phone</label><input className="input-field" placeholder="732-555-0100" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="mb-4">
            <label className="label">Calendar Color</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setForm({ ...form, color: c })} className="w-8 h-8 rounded-full transition-transform"
                  style={{ backgroundColor: c, transform: form.color === c ? "scale(1.2)" : "scale(1)", outline: form.color === c ? `3px solid ${c}60` : "none", outlineOffset: 2 }} />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving || !form.name.trim()} className="btn-primary btn-sm">
              {saving ? "Saving..." : editId ? "Update" : "Add"} Therapist
            </button>
            <button onClick={() => setShowForm(false)} className="btn-ghost btn-sm">Cancel</button>
          </div>
        </div>
      )}

      {therapists.length === 0 ? (
        <div className="card p-12 text-center text-ink-400">No therapists yet.</div>
      ) : (
        <div className="space-y-4">
          {therapists.map((t) => {
            const tSchedule = schedules.filter((s) => s.therapist_id === t.id);
            const isExpanded = editHoursId === t.id;
            return (
              <div key={t.id} className="card overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: t.color }} />
                    <div>
                      <span className="font-semibold">{t.name}</span>
                      <span className="text-ink-400 text-sm ml-3">{t.email || ""}</span>
                    </div>
                    <span className={t.active ? "badge badge-green" : "badge badge-gray"}>{t.active ? "Active" : "Inactive"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditHoursId(isExpanded ? null : t.id)} className="btn-ghost btn-sm">
                      {isExpanded ? "Hide Hours" : "Work Hours"}
                    </button>
                    <button onClick={() => { setForm({ name: t.name, email: t.email || "", phone: t.phone || "", color: t.color }); setEditId(t.id); setShowForm(true); }} className="btn-ghost btn-sm">Edit</button>
                    <button onClick={() => toggleActive(t)} className="btn-ghost btn-sm">{t.active ? "Deactivate" : "Activate"}</button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-5 py-4 bg-surface-50 border-t border-surface-200">
                    <div className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">Work Schedule</div>
                    <div className="space-y-2">
                      {DAYS_FULL.map((_day, dayIdx) => {
                        const sched = tSchedule.find((s) => s.day_of_week === dayIdx);
                        const isOn = !!sched;
                        return (
                          <div key={dayIdx} className="flex items-center gap-3">
                            <button onClick={() => toggleDay(t.id, dayIdx)}
                              className={`w-16 text-center py-1.5 rounded-lg text-xs font-semibold border transition-all ${isOn ? "bg-brand-600 text-white border-brand-600" : "bg-white text-ink-400 border-surface-300"}`}>
                              {DAYS[dayIdx]}
                            </button>
                            {isOn && sched ? (
                              <div className="flex items-center gap-2">
                                <input type="time" className="input-field w-28 py-1 text-sm" value={sched.start_time.slice(0, 5)}
                                  onChange={(e) => updateScheduleTime(sched.id, "start_time", e.target.value)} />
                                <span className="text-ink-400 text-sm">to</span>
                                <input type="time" className="input-field w-28 py-1 text-sm" value={sched.end_time.slice(0, 5)}
                                  onChange={(e) => updateScheduleTime(sched.id, "end_time", e.target.value)} />
                              </div>
                            ) : <span className="text-xs text-ink-400">Off</span>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-xs text-ink-400 mt-3">Click a day to toggle on/off. Adjust start and end times as needed.</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ServicesTab() {
  const queryClient = useQueryClient();
  const { data: services = [], isLoading } = useAllServiceTypes();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", duration: "30", rate: "" });
  const [saving, setSaving] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["service_types"] });

  const save = async () => {
    if (!form.name.trim() || !form.rate) return;
    setSaving(true);
    const payload = { name: form.name.trim(), duration: parseInt(form.duration), rate: parseFloat(form.rate) };
    if (editId) { await supabase.from("service_types").update(payload).eq("id", editId); }
    else { await supabase.from("service_types").insert(payload); }
    setSaving(false);
    setShowForm(false);
    invalidate();
  };

  if (isLoading) return <div className="text-ink-400 py-12 text-center">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-ink-500">{services.length} service type{services.length !== 1 ? "s" : ""}</p>
        <button onClick={() => { setForm({ name: "", duration: "30", rate: "" }); setEditId(null); setShowForm(true); }} className="btn-primary btn-sm">
          + Add Service Type
        </button>
      </div>
      {showForm && (
        <div className="card p-5 mb-4">
          <h3 className="font-semibold mb-4">{editId ? "Edit" : "Add"} Service Type</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div><label className="label">Name *</label><input className="input-field" placeholder="Individual 30 min" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <label className="label">Duration (minutes)</label>
              <select className="input-field" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}>
                {[15, 30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
            <div><label className="label">Default Rate *</label><input className="input-field" type="number" step="0.01" placeholder="125.00" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving || !form.name.trim() || !form.rate} className="btn-primary btn-sm">
              {saving ? "Saving..." : editId ? "Update" : "Add"} Service
            </button>
            <button onClick={() => setShowForm(false)} className="btn-ghost btn-sm">Cancel</button>
          </div>
        </div>
      )}
      {services.length === 0 ? (
        <div className="card p-12 text-center text-ink-400">No service types yet.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead><tr className="border-b border-surface-200">
              <th className="table-header">Service</th><th className="table-header">Duration</th><th className="table-header">Default Rate</th><th className="table-header">Status</th><th className="table-header text-right">Actions</th>
            </tr></thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="table-row">
                  <td className="table-cell font-semibold">{s.name}</td>
                  <td className="table-cell text-ink-500">{s.duration} min</td>
                  <td className="table-cell font-bold text-lg">{fmt(s.rate)}</td>
                  <td className="table-cell"><span className={s.active ? "badge badge-green" : "badge badge-gray"}>{s.active ? "Active" : "Inactive"}</span></td>
                  <td className="table-cell text-right">
                    <button onClick={() => { setForm({ name: s.name, duration: String(s.duration), rate: String(s.rate) }); setEditId(s.id); setShowForm(true); }} className="btn-ghost btn-sm">Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FeesTab() {
  const queryClient = useQueryClient();
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => { const { data } = await supabase.from("fees").select("*").order("name"); setFees(data || []); setLoading(false); };
  useEffect(() => { load(); }, []);

  const updateFee = async (id: string, amount: number) => {
    setSaving(true);
    await supabase.from("fees").update({ amount, updated_at: new Date().toISOString() }).eq("id", id);
    setSaving(false);
    load();
    queryClient.invalidateQueries({ queryKey: ["fees"] });
  };

  const feeLabels: Record<string, string> = { late_cancel: "Late Cancellation Fee", no_show: "No-Show Fee" };
  const feeDesc: Record<string, string> = {
    late_cancel: "Default fee when a client cancels late (overridden by per-client fee if set)",
    no_show: "Default fee when a client no-shows (overridden by per-client fee if set)",
  };

  if (loading) return <div className="text-ink-400 py-12 text-center">Loading...</div>;

  return (
    <div className="max-w-lg">
      <p className="text-sm text-ink-500 mb-4">Default fees — these apply when a client doesn&apos;t have their own rate set.</p>
      <div className="space-y-4">
        {fees.map((f) => (
          <div key={f.id} className="card p-5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold">{feeLabels[f.name] || f.name}</h3>
              <span className="text-2xl font-bold">${Number(f.amount).toFixed(2)}</span>
            </div>
            <p className="text-sm text-ink-400 mb-3">{feeDesc[f.name]}</p>
            <div className="flex items-center gap-3">
              <label className="label mb-0">Amount</label>
              <input className="input-field w-32" type="number" step="0.01" defaultValue={f.amount}
                onBlur={(e) => { const val = parseFloat(e.target.value); if (!isNaN(val) && val !== f.amount) updateFee(f.id, val); }} />
              {saving && <span className="text-xs text-ink-400">Saving...</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
