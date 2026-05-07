"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Therapist { id: string; name: string; color: string; }
interface Client { id: string; first_name: string; last_name: string; therapist_id: string; service_type_id: string; session_days: number[]; start_date: string; active: boolean; }
interface ServiceType { id: string; name: string; duration: number; rate: number; }
interface Session { id: string; client_id: string; therapist_id: string; service_type_id: string; session_date: string; session_time: string; status: string; notes: string; }

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-surface-100 text-ink-500",
  attended: "bg-emerald-100 text-emerald-700",
  late_cancel: "bg-amber-100 text-amber-700",
  no_show: "bg-red-100 text-red-700",
  cancelled: "bg-surface-100 text-ink-400 line-through",
  rescheduled: "bg-blue-100 text-blue-700",
};

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [sessions, setSessions] = useState<Session[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [filterTherapist, setFilterTherapist] = useState<string>("all");

  // Date range for current month view
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastOfMonth.getDate()).padStart(2, "0")}`;

  const load = useCallback(async () => {
    const [sRes, cRes, tRes, stRes] = await Promise.all([
      supabase.from("sessions").select("*").gte("session_date", startDate).lte("session_date", endDate).order("session_time"),
      supabase.from("clients").select("*").eq("active", true).order("last_name"),
      supabase.from("therapists").select("*").eq("active", true).order("name"),
      supabase.from("service_types").select("*").eq("active", true).order("name"),
    ]);
    setSessions(sRes.data || []);
    setClients(cRes.data || []);
    setTherapists(tRes.data || []);
    setServiceTypes(stRes.data || []);
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const getClient = (id: string) => clients.find((c) => c.id === id);
  const getTherapist = (id: string) => therapists.find((t) => t.id === id);
  const getService = (id: string) => serviceTypes.find((s) => s.id === id);

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // ── Generate Sessions ──
  const generateSessions = async () => {
    if (!confirm(`Generate scheduled sessions for ${MONTHS[month]} ${year}?\n\nThis will create appointments based on each client's session days. Existing sessions won't be duplicated.`)) return;
    setGenerating(true);

    // Get all existing sessions for this month to avoid duplicates
    const { data: existing } = await supabase.from("sessions")
      .select("client_id, session_date")
      .gte("session_date", startDate)
      .lte("session_date", endDate);

    const existingSet = new Set((existing || []).map((s: any) => `${s.client_id}_${s.session_date}`));

    const newSessions: any[] = [];

    for (const client of clients) {
      if (!client.session_days?.length || !client.therapist_id || !client.service_type_id) continue;

      // Walk through every day in the month
      for (let d = new Date(year, month, 1); d <= lastOfMonth; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        if (!client.session_days.includes(dayOfWeek)) continue;

        // Check start date
        if (client.start_date && d < new Date(client.start_date)) continue;

        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const key = `${client.id}_${dateStr}`;

        if (existingSet.has(key)) continue;

        newSessions.push({
          client_id: client.id,
          therapist_id: client.therapist_id,
          service_type_id: client.service_type_id,
          session_date: dateStr,
          session_time: "10:00",
          status: "scheduled",
        });
      }
    }

    if (newSessions.length > 0) {
      // Batch insert in chunks of 100
      for (let i = 0; i < newSessions.length; i += 100) {
        await supabase.from("sessions").insert(newSessions.slice(i, i + 100));
      }
    }

    setGenerating(false);
    load();
    alert(`Done! ${newSessions.length} new sessions created for ${MONTHS[month]} ${year}.`);
  };

  // ── Calendar Grid ──
  const firstDayOfWeek = firstOfMonth.getDay();
  const daysInMonth = lastOfMonth.getDate();
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = new Array(firstDayOfWeek).fill(null);

  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const filteredSessions = filterTherapist === "all"
    ? sessions
    : sessions.filter((s) => s.therapist_id === filterTherapist);

  const getSessionsForDay = (day: number) => filteredSessions.filter((s) => s.session_date === getDateStr(day));

  // ── Day Detail Sidebar ──
  const selectedSessions = selectedDay
    ? filteredSessions.filter((s) => s.session_date === selectedDay).sort((a, b) => a.session_time.localeCompare(b.session_time))
    : [];

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); setSelectedDay(null); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); setSelectedDay(null); };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(todayStr); };

  if (loading) return <div className="text-ink-400 py-12 text-center">Loading...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-2">
          <button onClick={generateSessions} disabled={generating}
            className="btn-primary btn-sm">
            {generating ? "Generating..." : `Generate ${MONTHS[month]} Sessions`}
          </button>
        </div>
      </div>

      {/* Nav + Filters */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="btn-ghost btn-sm">&larr;</button>
          <span className="font-bold text-lg min-w-[180px] text-center">{MONTHS[month]} {year}</span>
          <button onClick={nextMonth} className="btn-ghost btn-sm">&rarr;</button>
          <button onClick={goToday} className="btn-outline btn-sm ml-2">Today</button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-ink-500">Filter:</label>
          <select className="input-field w-44 py-1.5 text-sm" value={filterTherapist}
            onChange={(e) => setFilterTherapist(e.target.value)}>
            <option value="all">All Therapists</option>
            {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Calendar Grid */}
        <div className="flex-1">
          <div className="card overflow-hidden">
            <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr>
                  {DAY_HEADERS.map((d) => (
                    <th key={d} className="text-xs font-semibold text-ink-500 uppercase tracking-wide py-2.5 text-center border-b border-surface-200 bg-surface-50">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeks.map((wk, wi) => (
                  <tr key={wi}>
                    {wk.map((day, di) => {
                      if (day === null) return (
                        <td key={di} className="border border-surface-200 bg-surface-50 h-24 align-top p-1" />
                      );

                      const dateStr = getDateStr(day);
                      const daySessions = getSessionsForDay(day);
                      const isToday = dateStr === todayStr;
                      const isSelected = dateStr === selectedDay;

                      return (
                        <td key={di}
                          onClick={() => setSelectedDay(dateStr)}
                          className={`border border-surface-200 h-24 align-top p-1 cursor-pointer transition-colors
                            ${isSelected ? "bg-brand-50 ring-2 ring-brand-400 ring-inset" : isToday ? "bg-blue-50/50" : "hover:bg-surface-50"}`}>
                          <div className={`text-xs font-semibold mb-0.5 px-1
                            ${isToday ? "text-brand-600" : "text-ink-700"}`}>
                            {day}
                          </div>
                          <div className="space-y-0.5">
                            {daySessions.slice(0, 4).map((s) => {
                              const cl = getClient(s.client_id);
                              const th = getTherapist(s.therapist_id);
                              return (
                                <div key={s.id}
                                  className="text-[10px] leading-tight px-1 py-0.5 rounded truncate font-medium"
                                  style={{
                                    backgroundColor: th ? th.color + "18" : "#f3f4f6",
                                    color: th?.color || "#6b7280",
                                    borderLeft: `2px solid ${th?.color || "#d1d5db"}`,
                                  }}>
                                  {cl ? `${cl.first_name} ${cl.last_name[0]}.` : "Unknown"}
                                </div>
                              );
                            })}
                            {daySessions.length > 4 && (
                              <div className="text-[10px] text-ink-400 px-1">+{daySessions.length - 4} more</div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 text-xs text-ink-400 flex-wrap">
            {therapists.map((t) => (
              <div key={t.id} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                {t.name}
              </div>
            ))}
          </div>
        </div>

        {/* Day Detail Sidebar */}
        {selectedDay && (
          <div className="w-80 flex-shrink-0">
            <div className="card p-4 sticky top-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold">
                  {new Date(selectedDay + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                </h3>
                <button onClick={() => setSelectedDay(null)} className="btn-ghost btn-sm text-ink-400">&times;</button>
              </div>

              {selectedSessions.length === 0 ? (
                <div className="text-sm text-ink-400 text-center py-6">No sessions scheduled</div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-ink-500 font-semibold">{selectedSessions.length} session{selectedSessions.length !== 1 ? "s" : ""}</div>
                  {selectedSessions.map((s) => {
                    const cl = getClient(s.client_id);
                    const th = getTherapist(s.therapist_id);
                    const svc = getService(s.service_type_id);
                    return (
                      <div key={s.id} className="border border-surface-200 rounded-lg p-3"
                        style={{ borderLeftWidth: 3, borderLeftColor: th?.color || "#d1d5db" }}>
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-sm">
                            {cl ? `${cl.first_name} ${cl.last_name}` : "Unknown"}
                          </div>
                          <span className={`badge text-[10px] ${STATUS_COLORS[s.status] || "badge-gray"}`}>
                            {s.status.replace("_", " ")}
                          </span>
                        </div>
                        <div className="text-xs text-ink-400 mt-1">
                          {th?.name || "Unassigned"} &middot; {svc?.name || "Unknown"} &middot; {svc?.duration || "?"}min
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
