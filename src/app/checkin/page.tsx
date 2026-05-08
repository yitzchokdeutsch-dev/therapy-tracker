"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

interface Therapist { id: string; name: string; color: string; }
interface Client { id: string; first_name: string; last_name: string; }
interface ServiceType { id: string; name: string; duration: number; rate: number; }
interface Fee { id: string; name: string; amount: number; }
interface Session {
  id: string; client_id: string; therapist_id: string; service_type_id: string;
  session_date: string; session_time: string; status: string; notes: string;
}

const STATUS_OPTIONS = [
  { value: "attended", label: "Attended", icon: "✓", btnClass: "bg-emerald-600 text-white border-emerald-600", badgeClass: "badge-green" },
  { value: "late_cancel", label: "Late Cancel", icon: "⏰", btnClass: "bg-amber-500 text-white border-amber-500", badgeClass: "badge-amber" },
  { value: "no_show", label: "No-Show", icon: "✗", btnClass: "bg-red-600 text-white border-red-600", badgeClass: "badge-red" },
  { value: "cancelled", label: "Cancelled", icon: "—", btnClass: "bg-surface-200 text-ink-500 border-surface-300", badgeClass: "badge-gray" },
];

export default function CheckInPage() {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [date, setDate] = useState(todayStr);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filterTherapist, setFilterTherapist] = useState("all");

  const load = useCallback(async () => {
    const [sRes, cRes, tRes, stRes, fRes] = await Promise.all([
      supabase.from("sessions").select("*").eq("session_date", date).order("session_time").then(r => r),
      supabase.from("clients").select("id, first_name, last_name").then(r => r),
      supabase.from("therapists").select("*").eq("active", true).order("name").then(r => r),
      supabase.from("service_types").select("*").eq("active", true).then(r => r),
      supabase.from("fees").select("*").then(r => r),
    ]);
    setSessions(sRes.data || []);
    setClients(cRes.data || []);
    setTherapists(tRes.data || []);
    setServiceTypes(stRes.data || []);
    setFees(fRes.data || []);
    setLoading(false);
  }, [date]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const getClient = (id: string) => clients.find((c) => c.id === id);
  const getTherapist = (id: string) => therapists.find((t) => t.id === id);
  const getService = (id: string) => serviceTypes.find((s) => s.id === id);
  const getFee = (name: string) => fees.find((f) => f.name === name);

  const updateStatus = async (session: Session, newStatus: string) => {
    if (updating) return;
    setUpdating(session.id);

    // Update session status
    await supabase.from("sessions").update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq("id", session.id);

    // Remove any existing charge for this session
    await supabase.from("charges").delete().eq("session_id", session.id);

    // Create new charge based on status
    const svc = getService(session.service_type_id);
    let chargeAmount = 0;
    let chargeDesc = "";

    if (newStatus === "attended" && svc) {
      chargeAmount = Number(svc.rate);
      chargeDesc = svc.name;
    } else if (newStatus === "late_cancel") {
      const fee = getFee("late_cancel");
      chargeAmount = fee ? Number(fee.amount) : 0;
      chargeDesc = "Late Cancellation Fee";
    } else if (newStatus === "no_show") {
      const fee = getFee("no_show");
      chargeAmount = fee ? Number(fee.amount) : 0;
      chargeDesc = "No-Show Fee";
    }

    if (chargeAmount > 0) {
      await supabase.from("charges").insert({
        client_id: session.client_id,
        session_id: session.id,
        charge_date: session.session_date,
        description: chargeDesc,
        amount: chargeAmount,
      });
    }

    setUpdating(null);
    load();
  };

  // Group sessions by therapist
  const filtered = filterTherapist === "all"
    ? sessions
    : sessions.filter((s) => s.therapist_id === filterTherapist);

  const grouped: Record<string, Session[]> = {};
  filtered.forEach((s) => {
    if (!grouped[s.therapist_id]) grouped[s.therapist_id] = [];
    grouped[s.therapist_id].push(s);
  });

  const checkedIn = filtered.filter((s) => s.status !== "scheduled").length;
  const total = filtered.length;

  // Date navigation
  const changeDate = (offset: number) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + offset);
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  };

  const displayDate = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  const isToday = date === todayStr;

  if (loading) return <div className="text-ink-400 py-12 text-center">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Daily Check-In</h1>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-ink-500">Filter:</label>
          <select className="input-field w-44 py-1.5 text-sm" value={filterTherapist}
            onChange={(e) => setFilterTherapist(e.target.value)}>
            <option value="all">All Therapists</option>
            {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {/* Date Nav */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => changeDate(-1)} className="btn-ghost btn-sm">&larr;</button>
        <div className="flex items-center gap-3">
          <input type="date" className="input-field w-40 py-1.5 text-sm" value={date}
            onChange={(e) => setDate(e.target.value)} />
          <span className="font-semibold">{displayDate}</span>
          {isToday && <span className="badge badge-blue">Today</span>}
        </div>
        <button onClick={() => changeDate(1)} className="btn-ghost btn-sm">&rarr;</button>
        {!isToday && <button onClick={() => setDate(todayStr)} className="btn-outline btn-sm">Go to Today</button>}
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="card p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">{checkedIn} of {total} checked in</span>
            <span className="text-sm text-ink-500">{total - checkedIn} remaining</span>
          </div>
          <div className="w-full bg-surface-200 rounded-full h-2.5">
            <div className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${total > 0 ? (checkedIn / total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* Sessions by Therapist */}
      {Object.keys(grouped).length === 0 ? (
        <div className="card p-12 text-center text-ink-400">
          No sessions scheduled for {displayDate}.
          <br />
          <span className="text-sm">Go to Calendar to generate sessions for this month.</span>
        </div>
      ) : (
        Object.entries(grouped).map(([therapistId, therapistSessions]) => {
          const th = getTherapist(therapistId);
          const done = therapistSessions.filter((s) => s.status !== "scheduled").length;
          return (
            <div key={therapistId} className="card mb-4 overflow-hidden">
              {/* Therapist Header */}
              <div className="px-5 py-3 bg-surface-50 border-b border-surface-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: th?.color || "#999" }} />
                  <span className="font-bold">{th?.name || "Unknown"}</span>
                  <span className="badge badge-gray">{therapistSessions.length} client{therapistSessions.length !== 1 ? "s" : ""}</span>
                </div>
                <span className="text-sm text-ink-500">{done}/{therapistSessions.length} done</span>
              </div>

              {/* Client Rows */}
              {therapistSessions.map((s) => {
                const cl = getClient(s.client_id);
                const svc = getService(s.service_type_id);
                const currentStatus = STATUS_OPTIONS.find((o) => o.value === s.status);
                const isProcessing = updating === s.id;

                return (
                  <div key={s.id} className={`px-5 py-3 border-b border-surface-200 last:border-0 flex items-center justify-between flex-wrap gap-3 transition-colors ${
                    s.status !== "scheduled" ? "bg-surface-50/50" : ""
                  } ${isProcessing ? "opacity-60" : ""}`}>
                    <div className="flex items-center gap-4 min-w-[200px]">
                      <div>
                        <div className="font-semibold">
                          {cl ? `${cl.first_name} ${cl.last_name}` : "Unknown"}
                        </div>
                        <div className="text-xs text-ink-400">
                          {svc?.name || "Unknown"} &middot; {svc?.duration || "?"}min
                          {s.status === "attended" && svc && (
                            <span className="text-emerald-600 font-semibold ml-2">${Number(svc.rate).toFixed(2)}</span>
                          )}
                          {s.status === "late_cancel" && (
                            <span className="text-amber-600 font-semibold ml-2">${Number(getFee("late_cancel")?.amount || 0).toFixed(2)} fee</span>
                          )}
                          {s.status === "no_show" && (
                            <span className="text-red-600 font-semibold ml-2">${Number(getFee("no_show")?.amount || 0).toFixed(2)} fee</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Buttons */}
                    <div className="flex gap-2">
                      {STATUS_OPTIONS.map((opt) => {
                        const isActive = s.status === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => {
                              if (isActive) {
                                // Click again to undo — set back to scheduled
                                updateStatus(s, "scheduled");
                              } else {
                                updateStatus(s, opt.value);
                              }
                            }}
                            disabled={isProcessing}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                              isActive
                                ? opt.btnClass
                                : "bg-white text-ink-500 border-surface-300 hover:border-ink-300"
                            }`}>
                            <span className="mr-1">{opt.icon}</span>
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })
      )}

      {/* Summary */}
      {total > 0 && (
        <div className="card p-4 mt-4">
          <h3 className="font-semibold text-sm mb-2">Summary for {displayDate}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-2xl font-bold text-emerald-600">{filtered.filter((s) => s.status === "attended").length}</div>
              <div className="text-xs text-ink-500">Attended</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-500">{filtered.filter((s) => s.status === "late_cancel").length}</div>
              <div className="text-xs text-ink-500">Late Cancel</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{filtered.filter((s) => s.status === "no_show").length}</div>
              <div className="text-xs text-ink-500">No-Show</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-ink-400">{filtered.filter((s) => s.status === "scheduled").length}</div>
              <div className="text-xs text-ink-500">Pending</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
