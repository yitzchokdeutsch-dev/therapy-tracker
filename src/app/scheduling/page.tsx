"use client";

import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useClients, useTherapists, useServiceTypes, useSchedules } from "@/hooks";
import { formatTime, timeToMin, minToTime, DAYS } from "@/lib/utils";
import type { Session } from "@/lib/types";

const SCHED_DAYS = [0, 1, 2, 3, 4, 5]; // Sun–Fri (Sat excluded)

function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function in3months() {
  const d = new Date();
  d.setMonth(d.getMonth() + 3);
  return d.toISOString().split("T")[0];
}

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
    days: [] as number[],
    time: "10:00",
    start_date: todayStr(), end_date: in3months(),
  });

  const [oneForm, setOneForm] = useState({
    client_id: "", therapist_id: "", service_type_id: "",
    date: todayStr(), time: "10:00", notes: "",
  });

  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [bookedLabels, setBookedLabels] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const getService = (id: string) => serviceTypes.find((s) => s.id === id);

  // All slots available across the union of selected days (for recurring picker)
  const recSlots = useMemo((): string[] => {
    if (!recForm.therapist_id || recForm.days.length === 0) return [];
    const svc = getService(recForm.service_type_id);
    const duration = svc?.duration || 30;
    const allSlots = new Set<string>();
    for (const dayIdx of recForm.days) {
      const workSched = schedules.find((s) => s.therapist_id === recForm.therapist_id && s.day_of_week === dayIdx);
      if (!workSched) continue;
      const workStart = timeToMin(workSched.start_time.slice(0, 5));
      const workEnd = timeToMin(workSched.end_time.slice(0, 5));
      for (let t = workStart; t + duration <= workEnd; t += 15) allSlots.add(minToTime(t));
    }
    return Array.from(allSlots).sort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recForm.therapist_id, recForm.service_type_id, recForm.days, schedules, serviceTypes]);

  const sessionPreview = useMemo(() => {
    if (!recForm.start_date || !recForm.end_date || recForm.days.length === 0) return null;
    const daySet = new Set(recForm.days);
    let count = 0;
    const end = new Date(recForm.end_date + "T12:00:00");
    for (let d = new Date(recForm.start_date + "T12:00:00"); d <= end; d.setDate(d.getDate() + 1)) {
      if (daySet.has(d.getDay())) count++;
    }
    return count;
  }, [recForm.start_date, recForm.end_date, recForm.days]);

  const calcAvailableSlots = async (therapistId: string, date: string, serviceTypeId: string) => {
    if (!therapistId || !date || !serviceTypeId) { setAvailableSlots([]); setBookedLabels([]); return; }
    setSlotsLoading(true);

    const dayOfWeek = new Date(date + "T12:00:00").getDay();
    const workSchedule = schedules.find((s) => s.therapist_id === therapistId && s.day_of_week === dayOfWeek);

    if (!workSchedule) {
      setAvailableSlots([]);
      setBookedLabels(["Therapist does not work this day"]);
      setSlotsLoading(false);
      return;
    }

    const svc = getService(serviceTypeId);
    const duration = svc?.duration || 30;
    const workStart = timeToMin(workSchedule.start_time.slice(0, 5));
    const workEnd = timeToMin(workSchedule.end_time.slice(0, 5));

    const { data: daySessions } = await supabase
      .from("sessions").select("*")
      .eq("therapist_id", therapistId).eq("session_date", date)
      .not("status", "in", '("cancelled","rescheduled")');

    const booked = (daySessions || []).map((s: Session) => {
      const sSvc = getService(s.service_type_id);
      const cl = clients.find((c) => c.id === s.client_id);
      const start = timeToMin(s.session_time || "10:00");
      return {
        start,
        end: start + (sSvc?.duration || 30),
        label: `${formatTime(s.session_time || "10:00")} — ${cl ? `${cl.first_name} ${cl.last_name}` : "Client"}`,
      };
    });

    const slots: string[] = [];
    for (let t = workStart; t + duration <= workEnd; t += 15) {
      if (!booked.some((b) => t < b.end && t + duration > b.start)) slots.push(minToTime(t));
    }

    setAvailableSlots(slots);
    setBookedLabels(booked.map((b) => b.label));
    setSlotsLoading(false);
  };

  const selectClient = (clientId: string, formType: "rec" | "one") => {
    const client = clients.find((c) => c.id === clientId);
    if (formType === "rec") {
      setRecForm((prev) => ({
        ...prev,
        client_id: clientId,
        therapist_id: client?.therapist_id || prev.therapist_id,
        service_type_id: client?.service_type_id || prev.service_type_id,
        days: (client?.session_days || []).length > 0 ? (client?.session_days as number[]) : prev.days,
      }));
    } else {
      const therapistId = client?.therapist_id || oneForm.therapist_id;
      const serviceId = client?.service_type_id || oneForm.service_type_id;
      setOneForm((prev) => ({ ...prev, client_id: clientId, therapist_id: therapistId, service_type_id: serviceId }));
      if (therapistId && serviceId) calcAvailableSlots(therapistId, oneForm.date, serviceId);
    }
  };

  const toggleRecDay = (dayIdx: number) => {
    setRecForm((prev) => ({
      ...prev,
      days: prev.days.includes(dayIdx)
        ? prev.days.filter((d) => d !== dayIdx)
        : [...prev.days, dayIdx].sort((a, b) => a - b),
    }));
  };

  const saveRecurring = async () => {
    if (!recForm.client_id || !recForm.therapist_id || !recForm.service_type_id || recForm.days.length === 0 || !recForm.start_date || !recForm.end_date || !recForm.time) return;
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
    const daySet = new Set(recForm.days);

    const end = new Date(recForm.end_date + "T12:00:00");
    for (let d = new Date(recForm.start_date + "T12:00:00"); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (!daySet.has(dayOfWeek)) continue;

      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (existingSet.has(dateStr)) { skipped.push(`${dateStr}: already has session`); continue; }

      const workSched = schedules.find((s) => s.therapist_id === recForm.therapist_id && s.day_of_week === dayOfWeek);
      if (!workSched) { skipped.push(`${dateStr}: therapist off`); continue; }

      const sessionStart = timeToMin(recForm.time);
      const sessionEnd = sessionStart + duration;
      const workStart = timeToMin(workSched.start_time.slice(0, 5));
      const workEnd = timeToMin(workSched.end_time.slice(0, 5));
      if (sessionStart < workStart || sessionEnd > workEnd) { skipped.push(`${dateStr} at ${formatTime(recForm.time)}: outside work hours`); continue; }

      const conflict = (therapistSessions || []).some((s: Session) => {
        if (s.session_date !== dateStr) return false;
        const sSvc = getService(s.service_type_id);
        const sStart = timeToMin(s.session_time || "10:00");
        return sessionStart < sStart + (sSvc?.duration || 30) && sessionEnd > sStart;
      });
      const selfConflict = newSessions.some((ns) => {
        if (ns.session_date !== dateStr) return false;
        const nsSvc = getService(ns.service_type_id);
        const nsStart = timeToMin(ns.session_time);
        return sessionStart < nsStart + (nsSvc?.duration || 30) && sessionEnd > nsStart;
      });
      if (conflict || selfConflict) { skipped.push(`${dateStr} at ${formatTime(recForm.time)}: time conflict`); continue; }

      newSessions.push({ client_id: recForm.client_id, therapist_id: recForm.therapist_id, service_type_id: recForm.service_type_id, session_date: dateStr, session_time: recForm.time, status: "scheduled" });
    }

    for (let i = 0; i < newSessions.length; i += 100) {
      await supabase.from("sessions").insert(newSessions.slice(i, i + 100));
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
    if (!workSched) {
      setSaving(false);
      setResult({ created: 0, skipped: ["Therapist is not scheduled to work this day"] });
      return;
    }

    const sessionStart = timeToMin(oneForm.time);
    const sessionEnd = sessionStart + duration;
    const workStart = timeToMin(workSched.start_time.slice(0, 5));
    const workEnd = timeToMin(workSched.end_time.slice(0, 5));

    if (sessionStart < workStart || sessionEnd > workEnd) {
      setSaving(false);
      setResult({ created: 0, skipped: [`${formatTime(oneForm.time)} is outside work hours (${formatTime(workSched.start_time.slice(0, 5))} – ${formatTime(workSched.end_time.slice(0, 5))})`] });
      return;
    }

    const { data: daySessions } = await supabase.from("sessions").select("*")
      .eq("therapist_id", oneForm.therapist_id).eq("session_date", oneForm.date)
      .not("status", "in", '("cancelled","rescheduled")');

    const conflict = (daySessions || []).some((s: Session) => {
      const sSvc = getService(s.service_type_id);
      const sStart = timeToMin(s.session_time || "10:00");
      return sessionStart < sStart + (sSvc?.duration || 30) && sessionEnd > sStart;
    });

    if (conflict) {
      setSaving(false);
      setResult({ created: 0, skipped: ["Time slot conflicts with an existing session"] });
      return;
    }

    await supabase.from("sessions").insert({
      client_id: oneForm.client_id, therapist_id: oneForm.therapist_id,
      service_type_id: oneForm.service_type_id, session_date: oneForm.date,
      session_time: oneForm.time, status: "scheduled",
      notes: oneForm.notes.trim() || null,
    });

    setSaving(false);
    setResult({ created: 1, skipped: [] });
    setOneForm((prev) => ({ ...prev, notes: "" }));
  };

  if (loading) return <div className="text-ink-400 py-12 text-center">Loading...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-5">Schedule Sessions</h1>

      <div className="flex gap-1 bg-surface-100 rounded-lg p-1 w-fit mb-5">
        {(["recurring", "onetime"] as const).map((m) => (
          <button key={m} onClick={() => { setMode(m); setResult(null); }}
            className={`px-5 py-2 rounded-md text-sm font-semibold transition-all ${mode === m ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}>
            {m === "recurring" ? "Recurring" : "One-Time"}
          </button>
        ))}
      </div>

      {result && (
        <div className={`rounded-xl p-4 mb-4 border ${result.created > 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
          <div className={`font-semibold text-sm ${result.created > 0 ? "text-emerald-700" : "text-red-700"}`}>
            {result.created > 0 ? `✓ ${result.created} session${result.created !== 1 ? "s" : ""} created` : "No sessions created"}
          </div>
          {result.skipped.length > 0 && (
            <details className="mt-2">
              <summary className="text-xs text-ink-500 cursor-pointer select-none">
                {result.skipped.length} skipped — click to view
              </summary>
              <div className="mt-1.5 space-y-0.5 pl-2 border-l-2 border-surface-300">
                {result.skipped.map((s, i) => <div key={i} className="text-xs text-ink-500">{s}</div>)}
              </div>
            </details>
          )}
        </div>
      )}

      {mode === "recurring" && (
        <div className="card p-5 space-y-4">
          <div>
            <label className="label">Client *</label>
            <select className="input-field" value={recForm.client_id} onChange={(e) => selectClient(e.target.value, "rec")}>
              <option value="">Select client...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Therapist *</label>
              <select className="input-field" value={recForm.therapist_id} onChange={(e) => setRecForm({ ...recForm, therapist_id: e.target.value })}>
                <option value="">Select...</option>
                {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Service *</label>
              <select className="input-field" value={recForm.service_type_id} onChange={(e) => setRecForm({ ...recForm, service_type_id: e.target.value })}>
                <option value="">Select...</option>
                {serviceTypes.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration}min)</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Days *</label>
            <div className="flex gap-2 flex-wrap">
              {SCHED_DAYS.map((dayIdx) => {
                const isOn = recForm.days.includes(dayIdx);
                const therapistWorks = !recForm.therapist_id || schedules.some((s) => s.therapist_id === recForm.therapist_id && s.day_of_week === dayIdx);
                return (
                  <button
                    key={dayIdx}
                    onClick={() => toggleRecDay(dayIdx)}
                    title={recForm.therapist_id && !therapistWorks ? "Therapist is off this day" : undefined}
                    className={`px-3.5 py-2 rounded-lg text-sm font-semibold border transition-all ${
                      isOn
                        ? "bg-brand-600 text-white border-brand-600"
                        : recForm.therapist_id && !therapistWorks
                        ? "bg-surface-100 text-ink-300 border-surface-200 cursor-default"
                        : "bg-white text-ink-500 border-surface-300 hover:border-brand-300"
                    }`}
                  >
                    {DAYS[dayIdx]}
                  </button>
                );
              })}
            </div>
          </div>

          {recForm.days.length > 0 && (
            <div>
              <label className="label">Time *</label>
              {recSlots.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {recSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setRecForm({ ...recForm, time: slot })}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                        recForm.time === slot
                          ? "bg-brand-600 text-white border-brand-600"
                          : "bg-white text-ink-700 border-surface-300 hover:border-brand-300"
                      }`}
                    >
                      {formatTime(slot)}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  type="time"
                  className="input-field w-32 py-1.5 text-sm"
                  value={recForm.time}
                  onChange={(e) => setRecForm({ ...recForm, time: e.target.value })}
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start Date *</label>
              <input type="date" className="input-field" value={recForm.start_date} onChange={(e) => setRecForm({ ...recForm, start_date: e.target.value })} />
            </div>
            <div>
              <label className="label">End Date *</label>
              <input type="date" className="input-field" value={recForm.end_date} onChange={(e) => setRecForm({ ...recForm, end_date: e.target.value })} />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-sm text-ink-400">
              {sessionPreview !== null && sessionPreview > 0
                ? `~${sessionPreview} session${sessionPreview !== 1 ? "s" : ""} will be created`
                : ""}
            </span>
            <button
              onClick={saveRecurring}
              disabled={saving || !recForm.client_id || !recForm.therapist_id || !recForm.service_type_id || recForm.days.length === 0 || !recForm.start_date || !recForm.end_date}
              className="btn-primary"
            >
              {saving ? "Creating..." : "Create Sessions"}
            </button>
          </div>
        </div>
      )}

      {mode === "onetime" && (
        <div className="card p-5 space-y-4">
          <div>
            <label className="label">Client *</label>
            <select className="input-field" value={oneForm.client_id} onChange={(e) => selectClient(e.target.value, "one")}>
              <option value="">Select client...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Therapist *</label>
              <select className="input-field" value={oneForm.therapist_id}
                onChange={(e) => {
                  setOneForm({ ...oneForm, therapist_id: e.target.value });
                  if (oneForm.date && oneForm.service_type_id) calcAvailableSlots(e.target.value, oneForm.date, oneForm.service_type_id);
                }}>
                <option value="">Select...</option>
                {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Service *</label>
              <select className="input-field" value={oneForm.service_type_id}
                onChange={(e) => {
                  setOneForm({ ...oneForm, service_type_id: e.target.value });
                  if (oneForm.date && oneForm.therapist_id) calcAvailableSlots(oneForm.therapist_id, oneForm.date, e.target.value);
                }}>
                <option value="">Select...</option>
                {serviceTypes.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration}min)</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Date *</label>
            <input
              type="date"
              className="input-field w-40"
              value={oneForm.date}
              onChange={(e) => {
                setOneForm({ ...oneForm, date: e.target.value });
                if (oneForm.therapist_id && oneForm.service_type_id) calcAvailableSlots(oneForm.therapist_id, e.target.value, oneForm.service_type_id);
              }}
            />
          </div>

          <div>
            <label className="label">Time *</label>
            {slotsLoading ? (
              <div className="text-sm text-ink-400 py-1">Checking availability...</div>
            ) : oneForm.therapist_id && oneForm.date && oneForm.service_type_id ? (
              availableSlots.length > 0 ? (
                <div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setOneForm({ ...oneForm, time: slot })}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                          oneForm.time === slot
                            ? "bg-brand-600 text-white border-brand-600"
                            : "bg-white text-ink-700 border-surface-300 hover:border-brand-300"
                        }`}
                      >
                        {formatTime(slot)}
                      </button>
                    ))}
                  </div>
                  {bookedLabels.length > 0 && (
                    <div className="text-xs text-ink-400">
                      Already booked: {bookedLabels.join(" · ")}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="text-sm text-red-500 mb-2">{bookedLabels[0] || "No available slots for this day"}</div>
                  <input type="time" className="input-field w-32 py-1.5 text-sm" value={oneForm.time} onChange={(e) => setOneForm({ ...oneForm, time: e.target.value })} />
                </div>
              )
            ) : (
              <input type="time" className="input-field w-32 py-1.5 text-sm" value={oneForm.time} onChange={(e) => setOneForm({ ...oneForm, time: e.target.value })} />
            )}
          </div>

          <div>
            <label className="label">Notes</label>
            <input className="input-field" placeholder="e.g. Makeup session, evaluation..." value={oneForm.notes} onChange={(e) => setOneForm({ ...oneForm, notes: e.target.value })} />
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={saveOneTime}
              disabled={saving || !oneForm.client_id || !oneForm.therapist_id || !oneForm.service_type_id || !oneForm.date || !oneForm.time}
              className="btn-primary"
            >
              {saving ? "Booking..." : "Book Session"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
