"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useClients, useTherapists, useServiceTypes, useSchedules } from "@/hooks";
import { formatTime, timeToMin, minToTime, DAYS, DAYS_FULL } from "@/lib/utils";
import type { Session } from "@/lib/types";

export default function SchedulingPage() {
  const [mode, setMode] = useState<"recurring" | "onetime">("recurring");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: string[] } | null>(null);

  const { data: clients = [], isLoading: loadingClients } = useClients(true);
  const { data: therapists = [], isLoading: loadingTherapists } = useTherapists();
  const { data: serviceTypes = [], isLoading: loadingServices } = useServiceTypes();
  const { data: schedules = [], isLoading: loadingSchedules } = useSchedules();

  const loading = loadingClients || loadingTherapists || loadingServices || loadingSchedules;

  const [recForm, setRecForm] = useState({
    client_id: "", therapist_id: "", service_type_id: "",
    days: [] as { day: number; time: string }[],
    start_date: "", end_date: "",
  });

  const [oneForm, setOneForm] = useState({
    client_id: "", therapist_id: "", service_type_id: "",
    date: "", time: "10:00", notes: "",
  });

  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);

  const getService = (id: string) => serviceTypes.find((s) => s.id === id);
  const getTherapist = (id: string) => therapists.find((t) => t.id === id);

  const calcAvailableSlots = async (therapistId: string, date: string, serviceTypeId: string) => {
    if (!therapistId || !date || !serviceTypeId) { setAvailableSlots([]); return; }

    const dayOfWeek = new Date(date + "T12:00:00").getDay();
    const workSchedule = schedules.find((s) => s.therapist_id === therapistId && s.day_of_week === dayOfWeek);

    if (!workSchedule) {
      setAvailableSlots([]);
      setConflicts(["Therapist is not scheduled to work this day"]);
      return;
    }

    const svc = getService(serviceTypeId);
    const duration = svc?.duration || 30;
    const workStart = timeToMin(workSchedule.start_time.slice(0, 5));
    const workEnd = timeToMin(workSchedule.end_time.slice(0, 5));

    const { data: daySessions } = await supabase.from("sessions").select("*")
      .eq("therapist_id", therapistId).eq("session_date", date)
      .not("status", "in", '("cancelled","rescheduled")');

    const booked = (daySessions || []).map((s: Session) => {
      const sSvc = getService(s.service_type_id);
      return { start: timeToMin(s.session_time || "10:00"), end: timeToMin(s.session_time || "10:00") + (sSvc?.duration || 30), clientId: s.client_id };
    });

    const slots: string[] = [];
    const conflictList: string[] = [];
    for (let t = workStart; t + duration <= workEnd; t += 15) {
      const slotEnd = t + duration;
      const hasConflict = booked.some((b) => t < b.end && slotEnd > b.start);
      if (!hasConflict) slots.push(minToTime(t));
    }
    booked.forEach((b) => {
      const sess = (daySessions || []).find((s: Session) => timeToMin(s.session_time || "10:00") === b.start);
      if (sess) {
        const cl = clients.find((c) => c.id === sess.client_id);
        conflictList.push(`${formatTime(minToTime(b.start))} - ${formatTime(minToTime(b.end))}: ${cl ? `${cl.first_name} ${cl.last_name}` : "Unknown"}`);
      }
    });

    setAvailableSlots(slots);
    setConflicts(conflictList);
  };

  const selectClient = (clientId: string, formType: "rec" | "one") => {
    const client = clients.find((c) => c.id === clientId);
    if (formType === "rec") {
      setRecForm({ ...recForm, client_id: clientId, therapist_id: client?.therapist_id || recForm.therapist_id, service_type_id: client?.service_type_id || recForm.service_type_id });
    } else {
      setOneForm({ ...oneForm, client_id: clientId, therapist_id: client?.therapist_id || oneForm.therapist_id, service_type_id: client?.service_type_id || oneForm.service_type_id });
    }
  };

  const toggleRecDay = (dayIdx: number) => {
    setRecForm((prev) => {
      const existing = prev.days.find((d) => d.day === dayIdx);
      if (existing) return { ...prev, days: prev.days.filter((d) => d.day !== dayIdx) };
      return { ...prev, days: [...prev.days, { day: dayIdx, time: "10:00" }].sort((a, b) => a.day - b.day) };
    });
  };

  const updateRecDayTime = (dayIdx: number, time: string) => {
    setRecForm((prev) => ({ ...prev, days: prev.days.map((d) => d.day === dayIdx ? { ...d, time } : d) }));
  };

  const saveRecurring = async () => {
    if (!recForm.client_id || !recForm.therapist_id || !recForm.service_type_id || recForm.days.length === 0 || !recForm.start_date || !recForm.end_date) return;
    setSaving(true);
    setResult(null);

    const svc = getService(recForm.service_type_id);
    const duration = svc?.duration || 30;

    const { data: existing } = await supabase.from("sessions").select("client_id, session_date")
      .eq("client_id", recForm.client_id).gte("session_date", recForm.start_date).lte("session_date", recForm.end_date);
    const existingSet = new Set((existing || []).map((s: any) => s.session_date));

    const { data: therapistSessions } = await supabase.from("sessions").select("*")
      .eq("therapist_id", recForm.therapist_id).gte("session_date", recForm.start_date).lte("session_date", recForm.end_date)
      .not("status", "in", '("cancelled","rescheduled")');

    const newSessions: any[] = [];
    const skipped: string[] = [];

    const start = new Date(recForm.start_date + "T12:00:00");
    const end = new Date(recForm.end_date + "T12:00:00");

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      const dayConfig = recForm.days.find((dd) => dd.day === dayOfWeek);
      if (!dayConfig) continue;

      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (existingSet.has(dateStr)) { skipped.push(`${dateStr}: already has session`); continue; }

      const workSched = schedules.find((s) => s.therapist_id === recForm.therapist_id && s.day_of_week === dayOfWeek);
      if (!workSched) { skipped.push(`${dateStr}: therapist off`); continue; }

      const sessionStart = timeToMin(dayConfig.time);
      const sessionEnd = sessionStart + duration;
      const workStart = timeToMin(workSched.start_time.slice(0, 5));
      const workEnd = timeToMin(workSched.end_time.slice(0, 5));
      if (sessionStart < workStart || sessionEnd > workEnd) { skipped.push(`${dateStr} at ${formatTime(dayConfig.time)}: outside work hours`); continue; }

      const conflict = (therapistSessions || []).some((s: Session) => {
        if (s.session_date !== dateStr) return false;
        const sSvc = getService(s.service_type_id);
        const sStart = timeToMin(s.session_time || "10:00");
        const sEnd = sStart + (sSvc?.duration || 30);
        return sessionStart < sEnd && sessionEnd > sStart;
      });

      const selfConflict = newSessions.some((ns) => {
        if (ns.session_date !== dateStr) return false;
        const nsSvc = getService(ns.service_type_id);
        const nsStart = timeToMin(ns.session_time);
        const nsEnd = nsStart + (nsSvc?.duration || 30);
        return sessionStart < nsEnd && sessionEnd > nsStart;
      });

      if (conflict || selfConflict) { skipped.push(`${dateStr} at ${formatTime(dayConfig.time)}: time conflict`); continue; }

      newSessions.push({ client_id: recForm.client_id, therapist_id: recForm.therapist_id, service_type_id: recForm.service_type_id, session_date: dateStr, session_time: dayConfig.time, status: "scheduled" });
    }

    if (newSessions.length > 0) {
      for (let i = 0; i < newSessions.length; i += 100) {
        await supabase.from("sessions").insert(newSessions.slice(i, i + 100));
      }
    }

    setSaving(false);
    setResult({ created: newSessions.length, skipped });
  };

  const saveOneTime = async () => {
    if (!oneForm.client_id || !oneForm.therapist_id || !oneForm.service_type_id || !oneForm.date || !oneForm.time) return;
    setSaving(true);
    setResult(null);

    const svc = getService(oneForm.service_type_id);
    const duration = svc?.duration || 30;
    const dayOfWeek = new Date(oneForm.date + "T12:00:00").getDay();

    const workSched = schedules.find((s) => s.therapist_id === oneForm.therapist_id && s.day_of_week === dayOfWeek);
    if (!workSched) { setSaving(false); setResult({ created: 0, skipped: ["Therapist is not scheduled to work this day"] }); return; }

    const sessionStart = timeToMin(oneForm.time);
    const sessionEnd = sessionStart + duration;
    const workStart = timeToMin(workSched.start_time.slice(0, 5));
    const workEnd = timeToMin(workSched.end_time.slice(0, 5));

    if (sessionStart < workStart || sessionEnd > workEnd) {
      setSaving(false);
      setResult({ created: 0, skipped: [`${formatTime(oneForm.time)} is outside work hours (${formatTime(workSched.start_time.slice(0, 5))} - ${formatTime(workSched.end_time.slice(0, 5))})`] });
      return;
    }

    const { data: daySessions } = await supabase.from("sessions").select("*")
      .eq("therapist_id", oneForm.therapist_id).eq("session_date", oneForm.date)
      .not("status", "in", '("cancelled","rescheduled")');

    const conflict = (daySessions || []).some((s: Session) => {
      const sSvc = getService(s.service_type_id);
      const sStart = timeToMin(s.session_time || "10:00");
      const sEnd = sStart + (sSvc?.duration || 30);
      return sessionStart < sEnd && sessionEnd > sStart;
    });

    if (conflict) { setSaving(false); setResult({ created: 0, skipped: ["Time slot conflicts with an existing session"] }); return; }

    await supabase.from("sessions").insert({ client_id: oneForm.client_id, therapist_id: oneForm.therapist_id, service_type_id: oneForm.service_type_id, session_date: oneForm.date, session_time: oneForm.time, status: "scheduled", notes: oneForm.notes.trim() || null });

    setSaving(false);
    setResult({ created: 1, skipped: [] });
  };

  if (loading) return <div className="text-ink-400 py-12 text-center">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Schedule Sessions</h1>

      <div className="flex gap-1 bg-surface-100 rounded-lg p-1 w-fit mb-6">
        {(["recurring", "onetime"] as const).map((m) => (
          <button key={m} onClick={() => { setMode(m); setResult(null); }}
            className={`px-5 py-2 rounded-md text-sm font-semibold transition-all ${mode === m ? "bg-white text-ink-900 shadow-sm" : "text-ink-500"}`}>
            {m === "recurring" ? "Recurring Schedule" : "One-Time Session"}
          </button>
        ))}
      </div>

      {result && (
        <div className={`card p-4 mb-4 ${result.created > 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
          <div className="font-semibold text-sm">{result.created > 0 ? `✓ ${result.created} session${result.created !== 1 ? "s" : ""} created` : "No sessions created"}</div>
          {result.skipped.length > 0 && (
            <div className="mt-2 text-xs text-ink-500">
              <div className="font-semibold mb-1">Skipped ({result.skipped.length}):</div>
              {result.skipped.map((s, i) => <div key={i}>{s}</div>)}
            </div>
          )}
        </div>
      )}

      {mode === "recurring" && (
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Set Up Recurring Sessions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="label">Client *</label>
              <select className="input-field" value={recForm.client_id} onChange={(e) => selectClient(e.target.value, "rec")}>
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Therapist *</label>
              <select className="input-field" value={recForm.therapist_id} onChange={(e) => setRecForm({ ...recForm, therapist_id: e.target.value })}>
                <option value="">Select...</option>
                {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Service Type *</label>
              <select className="input-field" value={recForm.service_type_id} onChange={(e) => setRecForm({ ...recForm, service_type_id: e.target.value })}>
                <option value="">Select...</option>
                {serviceTypes.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration}min)</option>)}
              </select>
            </div>
          </div>

          {recForm.therapist_id && (
            <div className="bg-surface-50 rounded-lg p-3 mb-4 text-sm">
              <div className="font-semibold text-xs text-ink-500 uppercase mb-1">{getTherapist(recForm.therapist_id)?.name}&apos;s Hours</div>
              <div className="flex flex-wrap gap-3">
                {DAYS_FULL.map((_day, i) => {
                  const sched = schedules.find((s) => s.therapist_id === recForm.therapist_id && s.day_of_week === i);
                  return (
                    <span key={i} className={`text-xs ${sched ? "text-ink-700" : "text-ink-300"}`}>
                      {DAYS[i]}: {sched ? `${formatTime(sched.start_time.slice(0, 5))} - ${formatTime(sched.end_time.slice(0, 5))}` : "Off"}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-5">
            <label className="label">Days & Times *</label>
            <div className="space-y-2">
              {DAYS_FULL.map((_day, i) => {
                const isOn = recForm.days.some((d) => d.day === i);
                const dayConfig = recForm.days.find((d) => d.day === i);
                const therapistWorks = schedules.some((s) => s.therapist_id === recForm.therapist_id && s.day_of_week === i);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <button onClick={() => toggleRecDay(i)}
                      className={`w-20 text-center py-2 rounded-lg text-sm font-semibold border transition-all ${isOn ? "bg-brand-600 text-white border-brand-600" : "bg-white text-ink-500 border-surface-300 hover:border-brand-300"}`}>
                      {DAYS[i]}
                    </button>
                    {isOn && <input type="time" className="input-field w-32 py-1.5 text-sm" value={dayConfig?.time || "10:00"} onChange={(e) => updateRecDayTime(i, e.target.value)} />}
                    {isOn && !therapistWorks && recForm.therapist_id && <span className="text-xs text-red-500 font-medium">⚠ Therapist off this day</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="label">Start Date *</label>
              <input type="date" className="input-field" value={recForm.start_date} onChange={(e) => setRecForm({ ...recForm, start_date: e.target.value })} />
            </div>
            <div>
              <label className="label">End Date *</label>
              <input type="date" className="input-field" value={recForm.end_date} onChange={(e) => setRecForm({ ...recForm, end_date: e.target.value })} />
            </div>
          </div>

          <button onClick={saveRecurring} disabled={saving || !recForm.client_id || !recForm.therapist_id || recForm.days.length === 0 || !recForm.start_date || !recForm.end_date} className="btn-primary">
            {saving ? "Creating Sessions..." : "Create Recurring Sessions"}
          </button>
        </div>
      )}

      {mode === "onetime" && (
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Book a Single Session</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div>
              <label className="label">Client *</label>
              <select className="input-field" value={oneForm.client_id} onChange={(e) => selectClient(e.target.value, "one")}>
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Therapist *</label>
              <select className="input-field" value={oneForm.therapist_id}
                onChange={(e) => { setOneForm({ ...oneForm, therapist_id: e.target.value }); if (oneForm.date && oneForm.service_type_id) calcAvailableSlots(e.target.value, oneForm.date, oneForm.service_type_id); }}>
                <option value="">Select...</option>
                {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Service Type *</label>
              <select className="input-field" value={oneForm.service_type_id}
                onChange={(e) => { setOneForm({ ...oneForm, service_type_id: e.target.value }); if (oneForm.date && oneForm.therapist_id) calcAvailableSlots(oneForm.therapist_id, oneForm.date, e.target.value); }}>
                <option value="">Select...</option>
                {serviceTypes.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration}min)</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input-field" value={oneForm.date}
                onChange={(e) => { setOneForm({ ...oneForm, date: e.target.value }); if (oneForm.therapist_id && oneForm.service_type_id) calcAvailableSlots(oneForm.therapist_id, e.target.value, oneForm.service_type_id); }} />
            </div>
            <div>
              <label className="label">Time *</label>
              <input type="time" className="input-field" value={oneForm.time} onChange={(e) => setOneForm({ ...oneForm, time: e.target.value })} />
            </div>
          </div>

          {oneForm.therapist_id && oneForm.date && oneForm.service_type_id && (
            <div className="bg-surface-50 rounded-lg p-4 mb-5">
              {conflicts.length > 0 && (
                <div className="mb-3">
                  <div className="text-xs font-semibold text-ink-500 uppercase mb-1">Already Booked</div>
                  {conflicts.map((c, i) => <div key={i} className="text-xs text-red-500">{c}</div>)}
                </div>
              )}
              {availableSlots.length > 0 ? (
                <div>
                  <div className="text-xs font-semibold text-ink-500 uppercase mb-2">Available Slots (click to select)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {availableSlots.map((slot) => (
                      <button key={slot} onClick={() => setOneForm({ ...oneForm, time: slot })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${oneForm.time === slot ? "bg-brand-600 text-white border-brand-600" : "bg-white text-ink-700 border-surface-300 hover:border-brand-300"}`}>
                        {formatTime(slot)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-red-500">No available slots for this day</div>
              )}
            </div>
          )}

          <div className="mb-5">
            <label className="label">Notes</label>
            <input className="input-field" placeholder="e.g. Makeup session, evaluation..." value={oneForm.notes} onChange={(e) => setOneForm({ ...oneForm, notes: e.target.value })} />
          </div>

          <button onClick={saveOneTime} disabled={saving || !oneForm.client_id || !oneForm.therapist_id || !oneForm.date || !oneForm.time} className="btn-primary">
            {saving ? "Booking..." : "Book Session"}
          </button>
        </div>
      )}
    </div>
  );
}
