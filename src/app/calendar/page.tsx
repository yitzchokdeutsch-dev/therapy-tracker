"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useClients, useTherapists, useServiceTypes, useFees, useSessionsForMonth } from "@/hooks";
import { getSessionRate, getLateCancelFee, getNoShowFee } from "@/lib/fees";
import { fmt, formatTime, todayStr, MONTHS } from "@/lib/utils";
import Modal from "@/components/Modal";
import type { Session } from "@/lib/types";

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_BTN: Record<string, { label: string; icon: string; cls: string }> = {
  attended: { label: "Attended", icon: "✓", cls: "bg-emerald-600 text-white" },
  late_cancel: { label: "Late", icon: "⏰", cls: "bg-amber-500 text-white" },
  no_show: { label: "No-Show", icon: "✗", cls: "bg-red-600 text-white" },
  cancelled: { label: "Cancel", icon: "—", cls: "bg-surface-300 text-ink-500" },
};

export default function CalendarPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const today = new Date();
  const todayDate = todayStr();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [filterTherapist, setFilterTherapist] = useState("all");
  const [updating, setUpdating] = useState<string | null>(null);
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [editForm, setEditForm] = useState({ therapist_id: "", service_type_id: "", session_time: "", session_date: "", notes: "" });

  const { data: sessions = [], isLoading: loadingSessions } = useSessionsForMonth(year, month);
  const { data: clients = [] } = useClients(true);
  const { data: therapists = [] } = useTherapists();
  const { data: serviceTypes = [] } = useServiceTypes();
  const { data: fees = [] } = useFees();

  const invalidateSessions = () => {
    queryClient.invalidateQueries({ queryKey: ["sessions"] });
    queryClient.invalidateQueries({ queryKey: ["balances"] });
  };

  const getClient = (id: string) => clients.find((c) => c.id === id);
  const getTherapist = (id: string) => therapists.find((t) => t.id === id);
  const getService = (id: string) => serviceTypes.find((s) => s.id === id);

  const updateStatus = async (session: Session, newStatus: string) => {
    if (updating) return;
    setUpdating(session.id);

    await supabase.from("sessions").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", session.id);
    await supabase.from("charges").delete().eq("session_id", session.id);

    const client = getClient(session.client_id);
    let chargeAmount = 0, chargeDesc = "";
    if (newStatus === "attended") { chargeAmount = getSessionRate(client, serviceTypes); chargeDesc = getService(session.service_type_id)?.name || "Session"; }
    else if (newStatus === "late_cancel") { chargeAmount = getLateCancelFee(client, fees); chargeDesc = "Late Cancellation Fee"; }
    else if (newStatus === "no_show") { chargeAmount = getNoShowFee(client, fees); chargeDesc = "No-Show Fee"; }

    if (chargeAmount > 0) {
      await supabase.from("charges").insert({ client_id: session.client_id, session_id: session.id, charge_date: session.session_date, description: chargeDesc, amount: chargeAmount });
    }
    setUpdating(null);
    invalidateSessions();
  };

  const saveEdit = async () => {
    if (!editSession) return;
    await supabase.from("sessions").update({
      therapist_id: editForm.therapist_id, service_type_id: editForm.service_type_id,
      session_time: editForm.session_time, session_date: editForm.session_date,
      notes: editForm.notes.trim() || null, updated_at: new Date().toISOString(),
    }).eq("id", editSession.id);
    setEditSession(null);
    invalidateSessions();
  };

  const deleteSession = async () => {
    if (!editSession || !confirm("Delete this session?")) return;
    await supabase.from("charges").delete().eq("session_id", editSession.id);
    await supabase.from("sessions").delete().eq("id", editSession.id);
    setEditSession(null);
    invalidateSessions();
  };

  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstOfMonth.getDay();
  const daysInMonth = lastOfMonth.getDate();

  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = new Array(firstDayOfWeek).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week); }

  const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const filteredSessions = filterTherapist === "all" ? sessions : sessions.filter((s) => s.therapist_id === filterTherapist);
  const getSessionsForDay = (day: number) =>
    filteredSessions.filter((s) => s.session_date === getDateStr(day)).sort((a, b) => (a.session_time || "").localeCompare(b.session_time || ""));
  const selectedSessions = selectedDay
    ? filteredSessions.filter((s) => s.session_date === selectedDay).sort((a, b) => (a.session_time || "").localeCompare(b.session_time || ""))
    : [];

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); setSelectedDay(null); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); setSelectedDay(null); };
  const checkedIn = selectedSessions.filter((s) => s.status !== "scheduled").length;

  if (loadingSessions && sessions.length === 0) return <div className="text-ink-400 py-12 text-center">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <select className="input-field w-44 py-1.5 text-sm" value={filterTherapist} onChange={(e) => setFilterTherapist(e.target.value)}>
          <option value="all">All Therapists</option>
          {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <button onClick={prevMonth} className="btn-ghost btn-sm">&larr;</button>
        <span className="font-bold text-lg min-w-[180px] text-center">{MONTHS[month]} {year}</span>
        <button onClick={nextMonth} className="btn-ghost btn-sm">&rarr;</button>
        <button onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(todayDate); }} className="btn-outline btn-sm ml-2">Today</button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">
          <div className="card overflow-hidden overflow-x-auto">
            <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr>{DAY_HEADERS.map((d) => <th key={d} className="text-xs font-semibold text-ink-500 uppercase py-2.5 text-center border-b border-surface-200 bg-surface-50">{d}</th>)}</tr>
              </thead>
              <tbody>
                {weeks.map((wk, wi) => (
                  <tr key={wi}>
                    {wk.map((day, di) => {
                      if (day === null) return <td key={di} className="border border-surface-200 bg-surface-50 h-24 align-top p-1" />;
                      const dateStr = getDateStr(day);
                      const daySessions = getSessionsForDay(day);
                      const isToday = dateStr === todayDate;
                      const isSelected = dateStr === selectedDay;
                      return (
                        <td key={di} onClick={() => setSelectedDay(dateStr)}
                          className={`border border-surface-200 h-24 align-top p-1 cursor-pointer transition-colors ${isSelected ? "bg-brand-50 ring-2 ring-brand-400 ring-inset" : isToday ? "bg-blue-50/50" : "hover:bg-surface-50"}`}>
                          <div className={`text-xs font-semibold mb-0.5 px-1 ${isToday ? "text-brand-600" : "text-ink-700"}`}>{day}</div>
                          <div className="space-y-0.5">
                            {daySessions.slice(0, 4).map((s) => {
                              const cl = getClient(s.client_id);
                              const th = getTherapist(s.therapist_id);
                              const statusDot = s.status === "attended" ? "🟢" : s.status === "late_cancel" ? "🟡" : s.status === "no_show" ? "🔴" : "";
                              return (
                                <div key={s.id} className="text-[10px] leading-tight px-1 py-0.5 rounded truncate font-medium"
                                  style={{ backgroundColor: th ? th.color + "18" : "#f3f4f6", color: th?.color || "#6b7280", borderLeft: `2px solid ${th?.color || "#d1d5db"}` }}>
                                  {statusDot}{s.session_time ? formatTime(s.session_time).replace(" ", "") + " " : ""}{cl ? `${cl.first_name} ${cl.last_name[0]}.` : "?"}
                                </div>
                              );
                            })}
                            {daySessions.length > 4 && <div className="text-[10px] text-ink-400 px-1">+{daySessions.length - 4}</div>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-ink-400 flex-wrap">
            {therapists.map((t) => <div key={t.id} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />{t.name}</div>)}
            <span className="ml-4">🟢 Attended &nbsp; 🟡 Late Cancel &nbsp; 🔴 No-Show</span>
          </div>
        </div>

        {selectedDay && (
          <div className="w-full lg:w-96 lg:flex-shrink-0">
            <div className="card sticky top-4">
              <div className="px-4 py-3 bg-surface-50 border-b border-surface-200 flex items-center justify-between">
                <div>
                  <h3 className="font-bold">{new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</h3>
                  {selectedSessions.length > 0 && <div className="text-xs text-ink-500">{checkedIn}/{selectedSessions.length} checked in</div>}
                </div>
                <button onClick={() => setSelectedDay(null)} className="btn-ghost btn-sm">&times;</button>
              </div>

              {selectedSessions.length === 0 ? (
                <div className="p-8 text-center text-ink-400 text-sm">No sessions scheduled</div>
              ) : (
                <div className="divide-y divide-surface-200 max-h-[70vh] overflow-auto">
                  {selectedSessions.map((s) => {
                    const cl = getClient(s.client_id);
                    const th = getTherapist(s.therapist_id);
                    const svc = getService(s.service_type_id);
                    const isProcessing = updating === s.id;

                    return (
                      <div key={s.id} className={`p-3 ${s.status !== "scheduled" ? "bg-surface-50/50" : ""} ${isProcessing ? "opacity-50" : ""}`}
                        style={{ borderLeft: `3px solid ${th?.color || "#d1d5db"}` }}>
                        <div className="flex items-center justify-between mb-1">
                          <button onClick={() => router.push(`/clients/${s.client_id}`)}
                            className="font-semibold text-sm text-brand-600 hover:text-brand-800 text-left">
                            {cl ? `${cl.first_name} ${cl.last_name}` : "Unknown"}
                          </button>
                          <button onClick={() => { setEditForm({ therapist_id: s.therapist_id, service_type_id: s.service_type_id, session_time: s.session_time || "10:00", session_date: s.session_date, notes: s.notes || "" }); setEditSession(s); }} className="text-[10px] text-ink-400 hover:text-brand-600">edit</button>
                        </div>
                        <div className="text-xs text-ink-400 mb-2">
                          {s.session_time && <span>{formatTime(s.session_time)} &middot; </span>}
                          {svc?.name} &middot; {svc?.duration}min
                          {s.notes && <span className="italic ml-1">— {s.notes}</span>}
                        </div>
                        <div className="flex gap-1">
                          {Object.entries(STATUS_BTN).map(([status, cfg]) => {
                            const isActive = s.status === status;
                            return (
                              <button key={status}
                                onClick={() => updateStatus(s, isActive ? "scheduled" : status)}
                                disabled={isProcessing}
                                className={`px-2 py-1 rounded text-[10px] font-semibold transition-all ${isActive ? cfg.cls : "bg-surface-100 text-ink-400 hover:bg-surface-200"}`}>
                                {cfg.icon} {cfg.label}
                              </button>
                            );
                          })}
                        </div>
                        {s.status === "attended" && <div className="text-xs text-emerald-600 font-semibold mt-1">{fmt(getSessionRate(cl, serviceTypes))}</div>}
                        {s.status === "late_cancel" && <div className="text-xs text-amber-600 font-semibold mt-1">{fmt(getLateCancelFee(cl, fees))} fee</div>}
                        {s.status === "no_show" && <div className="text-xs text-red-600 font-semibold mt-1">{fmt(getNoShowFee(cl, fees))} fee</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {editSession && (
        <Modal
          title="Edit Session"
          subtitle={`${getClient(editSession.client_id)?.first_name} ${getClient(editSession.client_id)?.last_name}`}
          onClose={() => setEditSession(null)}
          footer={
            <div className="flex justify-between">
              <button onClick={deleteSession} className="btn-ghost btn-sm text-red-500">Delete</button>
              <div className="flex gap-2">
                <button onClick={() => setEditSession(null)} className="btn-ghost btn-sm">Cancel</button>
                <button onClick={saveEdit} className="btn-primary btn-sm">Save</button>
              </div>
            </div>
          }
        >
          <div className="space-y-3">
            <div><label className="label">Therapist</label><select className="input-field" value={editForm.therapist_id} onChange={(e) => setEditForm({ ...editForm, therapist_id: e.target.value })}>{therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div><label className="label">Service</label><select className="input-field" value={editForm.service_type_id} onChange={(e) => setEditForm({ ...editForm, service_type_id: e.target.value })}>{serviceTypes.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration}min)</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Date</label><input type="date" className="input-field" value={editForm.session_date} onChange={(e) => setEditForm({ ...editForm, session_date: e.target.value })} /></div>
              <div><label className="label">Time</label><input type="time" className="input-field" value={editForm.session_time} onChange={(e) => setEditForm({ ...editForm, session_time: e.target.value })} /></div>
            </div>
            <div><label className="label">Notes</label><input className="input-field" placeholder="Rescheduled, swap, etc." value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
