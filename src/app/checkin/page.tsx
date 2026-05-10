"use client";

import { useState } from "react";
import { useClients, useTherapists, useServiceTypes, useFees, useSessions } from "@/hooks";
import { useUpdateSessionStatus, useCreateSession, useUpdateSession, useDeleteSession } from "@/hooks/mutations";
import { getSessionRate, getLateCancelFee, getNoShowFee } from "@/lib/fees";
import { fmt, todayStr, toDateStr } from "@/lib/utils";
import Modal from "@/components/Modal";
import { SkeletonCheckinCard } from "@/components/Skeleton";
import { useUser } from "@/lib/user-context";
import type { Session } from "@/lib/types";
import type { SessionStatusInput } from "@/lib/schemas";

const STATUS_OPTIONS = [
  { value: "attended", label: "Attended", icon: "✓", btnClass: "bg-emerald-600 text-white border-emerald-600", badgeClass: "badge-green" },
  { value: "late_cancel", label: "Late Cancel", icon: "⏰", btnClass: "bg-amber-500 text-white border-amber-500", badgeClass: "badge-amber" },
  { value: "no_show", label: "No-Show", icon: "✗", btnClass: "bg-red-600 text-white border-red-600", badgeClass: "badge-red" },
  { value: "cancelled", label: "Cancelled", icon: "—", btnClass: "bg-surface-200 text-ink-500 border-surface-300", badgeClass: "badge-gray" },
];

export default function CheckInPage() {
  const today = todayStr();
  const { role, therapistId } = useUser();
  const isTherapist = role === "therapist" && !!therapistId;

  const [date, setDate] = useState(today);
  const [filterTherapist, setFilterTherapist] = useState(isTherapist ? therapistId! : "all");
  const [editSession, setEditSession] = useState<Session | null>(null);
  const [editForm, setEditForm] = useState({ therapist_id: "", service_type_id: "", session_time: "", session_date: "", notes: "" });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ client_id: "", therapist_id: "", service_type_id: "", session_time: "10:00", notes: "" });

  const { data: sessions = [], isLoading: loadingSessions } = useSessions(date);
  const { data: clients = [], isLoading: loadingClients } = useClients(true);
  const { data: therapists = [] } = useTherapists();
  const { data: serviceTypes = [] } = useServiceTypes();
  const { data: fees = [] } = useFees();

  const statusMutation = useUpdateSessionStatus(date);
  const createMutation = useCreateSession();
  const editMutation = useUpdateSession();
  const deleteMutation = useDeleteSession();

  const loading = loadingSessions || loadingClients;

  const getClient = (id: string) => clients.find((c) => c.id === id);
  const getTherapist = (id: string) => therapists.find((t) => t.id === id);
  const getService = (id: string) => serviceTypes.find((s) => s.id === id);

  const handleStatusUpdate = (session: Session, newStatus: string) => {
    const targetStatus = session.status === newStatus ? "scheduled" : newStatus;
    const client = getClient(session.client_id);

    let charge: SessionStatusInput["charge"];
    if (targetStatus === "attended") {
      const amount = getSessionRate(client, serviceTypes);
      if (amount > 0) charge = { client_id: session.client_id, amount, description: getService(session.service_type_id)?.name || "Session", session_date: session.session_date };
    } else if (targetStatus === "late_cancel") {
      const amount = getLateCancelFee(client, fees);
      if (amount > 0) charge = { client_id: session.client_id, amount, description: "Late Cancellation Fee", session_date: session.session_date };
    } else if (targetStatus === "no_show") {
      const amount = getNoShowFee(client, fees);
      if (amount > 0) charge = { client_id: session.client_id, amount, description: "No-Show Fee", session_date: session.session_date };
    }

    statusMutation.mutate({ sessionId: session.id, status: targetStatus as SessionStatusInput["status"], charge });
  };

  const handleSaveEdit = async () => {
    if (!editSession) return;
    await editMutation.mutateAsync({
      id: editSession.id,
      data: {
        therapist_id: editForm.therapist_id,
        service_type_id: editForm.service_type_id,
        session_time: editForm.session_time,
        session_date: editForm.session_date,
        notes: editForm.notes.trim() || null,
      },
    });
    setEditSession(null);
  };

  const handleDeleteSession = async () => {
    if (!editSession || !confirm("Delete this session? Any associated charge will also be removed.")) return;
    await deleteMutation.mutateAsync(editSession.id);
    setEditSession(null);
  };

  const handleAddSession = async () => {
    if (!addForm.client_id) return;
    await createMutation.mutateAsync({
      client_id: addForm.client_id,
      therapist_id: addForm.therapist_id,
      service_type_id: addForm.service_type_id,
      session_date: date,
      session_time: addForm.session_time,
      notes: addForm.notes.trim() || null,
    });
    setShowAdd(false);
  };

  const changeDate = (offset: number) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + offset);
    setDate(toDateStr(d));
  };

  const filtered = filterTherapist === "all" ? sessions : sessions.filter((s) => s.therapist_id === filterTherapist);
  const grouped: Record<string, Session[]> = {};
  filtered.forEach((s) => {
    if (!grouped[s.therapist_id]) grouped[s.therapist_id] = [];
    grouped[s.therapist_id].push(s);
  });

  const checkedIn = filtered.filter((s) => s.status !== "scheduled").length;
  const total = filtered.length;
  const displayDate = new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const isToday = date === today;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Daily Check-In</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setAddForm({ client_id: "", therapist_id: therapists[0]?.id || "", service_type_id: serviceTypes[0]?.id || "", session_time: "10:00", notes: "" });
              setShowAdd(true);
            }}
            className="btn-outline btn-sm"
          >
            + Add Session
          </button>
          {!isTherapist && (
            <select className="input-field w-44 py-1.5 text-sm" value={filterTherapist} onChange={(e) => setFilterTherapist(e.target.value)}>
              <option value="all">All Therapists</option>
              {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button onClick={() => changeDate(-1)} className="btn-ghost btn-sm">&larr;</button>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" className="input-field w-36 py-1.5 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
          <span className="font-semibold text-sm">{displayDate}</span>
          {isToday && <span className="badge badge-blue">Today</span>}
        </div>
        <button onClick={() => changeDate(1)} className="btn-ghost btn-sm">&rarr;</button>
        {!isToday && <button onClick={() => setDate(today)} className="btn-outline btn-sm">Go to Today</button>}
      </div>

      {loading ? (
        <>
          <SkeletonCheckinCard />
          <SkeletonCheckinCard />
        </>
      ) : (
        <>
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

          {Object.keys(grouped).length === 0 ? (
            <div className="card p-12 text-center text-ink-400">
              No sessions scheduled for {displayDate}.
              <br />
              <span className="text-sm">Go to Calendar to generate sessions, or click &quot;+ Add Session&quot; above.</span>
            </div>
          ) : (
            Object.entries(grouped).map(([therapistId, therapistSessions]) => {
              const th = getTherapist(therapistId);
              const done = therapistSessions.filter((s) => s.status !== "scheduled").length;
              return (
                <div key={therapistId} className="card mb-4 overflow-hidden">
                  <div className="px-5 py-3 bg-surface-50 border-b border-surface-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: th?.color || "#999" }} />
                      <span className="font-bold">{th?.name || "Unknown"}</span>
                      <span className="badge badge-gray">{therapistSessions.length} client{therapistSessions.length !== 1 ? "s" : ""}</span>
                    </div>
                    <span className="text-sm text-ink-500">{done}/{therapistSessions.length} done</span>
                  </div>

                  {therapistSessions.map((s) => {
                    const cl = getClient(s.client_id);
                    const svc = getService(s.service_type_id);
                    const isProcessing = statusMutation.isPending && (statusMutation.variables as SessionStatusInput)?.sessionId === s.id;
                    const sessionRate = getSessionRate(cl, serviceTypes);
                    const lcFee = getLateCancelFee(cl, fees);
                    const nsFee = getNoShowFee(cl, fees);

                    return (
                      <div
                        key={s.id}
                        className={`px-5 py-3 border-b border-surface-200 last:border-0 flex items-center justify-between flex-wrap gap-3 transition-colors ${s.status !== "scheduled" ? "bg-surface-50/50" : ""} ${isProcessing ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-center gap-4 min-w-[200px]">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{cl ? `${cl.first_name} ${cl.last_name}` : "Unknown"}</span>
                              {s.session_time && <span className="text-xs text-ink-400">{s.session_time}</span>}
                              <button
                                onClick={() => {
                                  setEditForm({ therapist_id: s.therapist_id, service_type_id: s.service_type_id, session_time: s.session_time || "10:00", session_date: s.session_date, notes: s.notes || "" });
                                  setEditSession(s);
                                }}
                                className="text-xs text-brand-500 hover:text-brand-700"
                              >
                                edit
                              </button>
                            </div>
                            <div className="text-xs text-ink-400">
                              {svc?.name || "Unknown"} &middot; {svc?.duration || "?"}min
                              {s.status === "attended" && <span className="text-emerald-600 font-semibold ml-2">{fmt(sessionRate)}</span>}
                              {s.status === "late_cancel" && <span className="text-amber-600 font-semibold ml-2">{fmt(lcFee)} fee</span>}
                              {s.status === "no_show" && <span className="text-red-600 font-semibold ml-2">{fmt(nsFee)} fee</span>}
                            </div>
                            {s.notes && <div className="text-xs text-ink-400 italic mt-0.5">{s.notes}</div>}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {STATUS_OPTIONS.map((opt) => {
                            const isActive = s.status === opt.value;
                            return (
                              <button
                                key={opt.value}
                                onClick={() => handleStatusUpdate(s, opt.value)}
                                disabled={isProcessing}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${isActive ? opt.btnClass : "bg-white text-ink-500 border-surface-300 hover:border-ink-300"}`}
                              >
                                <span className="mr-1">{opt.icon}</span>{opt.label}
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

          {total > 0 && (
            <div className="card p-4 mt-4">
              <h3 className="font-semibold text-sm mb-2">Summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                {[
                  { status: "attended", label: "Attended", color: "text-emerald-600" },
                  { status: "late_cancel", label: "Late Cancel", color: "text-amber-500" },
                  { status: "no_show", label: "No-Show", color: "text-red-600" },
                  { status: "scheduled", label: "Pending", color: "text-ink-400" },
                ].map(({ status, label, color }) => (
                  <div key={status}>
                    <div className={`text-2xl font-bold ${color}`}>{filtered.filter((s) => s.status === status).length}</div>
                    <div className="text-xs text-ink-500">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {editSession && (
        <Modal
          title="Edit Session"
          subtitle={`${getClient(editSession.client_id)?.first_name} ${getClient(editSession.client_id)?.last_name}`}
          onClose={() => setEditSession(null)}
          footer={
            <div className="flex items-center justify-between">
              <button onClick={handleDeleteSession} disabled={deleteMutation.isPending} className="btn-ghost btn-sm text-red-500">
                Delete Session
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditSession(null)} className="btn-ghost btn-sm">Cancel</button>
                <button onClick={handleSaveEdit} disabled={editMutation.isPending} className="btn-primary btn-sm">
                  {editMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="label">Therapist</label>
              <select className="input-field" value={editForm.therapist_id} onChange={(e) => setEditForm({ ...editForm, therapist_id: e.target.value })}>
                {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Service Type</label>
              <select className="input-field" value={editForm.service_type_id} onChange={(e) => setEditForm({ ...editForm, service_type_id: e.target.value })}>
                {serviceTypes.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration}min)</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Date</label>
                <input className="input-field" type="date" value={editForm.session_date} onChange={(e) => setEditForm({ ...editForm, session_date: e.target.value })} />
              </div>
              <div>
                <label className="label">Time</label>
                <input className="input-field" type="time" value={editForm.session_time} onChange={(e) => setEditForm({ ...editForm, session_time: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input-field" placeholder="e.g. Rescheduled from Monday" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}

      {showAdd && (
        <Modal
          title={`Add Session — ${displayDate}`}
          onClose={() => setShowAdd(false)}
          footer={
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="btn-ghost btn-sm">Cancel</button>
              <button onClick={handleAddSession} disabled={!addForm.client_id || createMutation.isPending} className="btn-primary btn-sm">
                {createMutation.isPending ? "Adding..." : "Add Session"}
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div>
              <label className="label">Client *</label>
              <select
                className="input-field"
                value={addForm.client_id}
                onChange={(e) => {
                  const cl = clients.find((c) => c.id === e.target.value);
                  setAddForm({ ...addForm, client_id: e.target.value, therapist_id: cl?.therapist_id || addForm.therapist_id, service_type_id: cl?.service_type_id || addForm.service_type_id });
                }}
              >
                <option value="">Select client...</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Therapist</label>
              <select className="input-field" value={addForm.therapist_id} onChange={(e) => setAddForm({ ...addForm, therapist_id: e.target.value })}>
                {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Service Type</label>
              <select className="input-field" value={addForm.service_type_id} onChange={(e) => setAddForm({ ...addForm, service_type_id: e.target.value })}>
                {serviceTypes.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration}min)</option>)}
              </select>
            </div>
            <div>
              <label className="label">Time</label>
              <input className="input-field" type="time" value={addForm.session_time} onChange={(e) => setAddForm({ ...addForm, session_time: e.target.value })} />
            </div>
            <div>
              <label className="label">Notes</label>
              <input className="input-field" placeholder="e.g. Walk-in, makeup session" value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
