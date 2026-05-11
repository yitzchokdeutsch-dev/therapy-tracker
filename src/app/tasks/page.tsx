"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useClients } from "@/hooks";
import type { Task } from "@/lib/types";

const TYPE_LABELS: Record<string, { label: string; badge: string }> = {
  soap_note:     { label: "SOAP Note",     badge: "badge-blue" },
  auth_expiring: { label: "Auth Expiring", badge: "badge-amber" },
  custom:        { label: "Task",          badge: "badge-gray" },
};

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks]     = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<"open" | "all">("open");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ title: "", client_id: "", due_date: "" });
  const [saving, setSaving]     = useState(false);

  const { data: clients = [] } = useClients(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("tasks").select("*").order("due_date", { nullsFirst: false }).order("created_at");
    if (filter === "open") q = (q as any).is("completed_at", null);
    const { data } = await q;
    setTasks(data || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  // Auto-generate auth-expiring tasks for clients with auth expiring in ≤30 days
  useEffect(() => {
    if (!clients.length) return;
    const today = new Date();
    const soon  = new Date(today.getTime() + 30 * 86400000);
    clients.forEach(async (c) => {
      if (!c.auth_expiration) return;
      const exp = new Date(c.auth_expiration);
      if (exp > soon) return;
      const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
      const title = daysLeft <= 0
        ? `Insurance auth expired — ${c.first_name} ${c.last_name}`
        : `Insurance auth expiring in ${daysLeft} day${daysLeft !== 1 ? "s" : ""} — ${c.first_name} ${c.last_name}`;
      const { count } = await supabase.from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("client_id", c.id).eq("task_type", "auth_expiring").is("completed_at", null);
      if (count === 0) {
        await supabase.from("tasks").insert({ client_id: c.id, title, task_type: "auth_expiring", due_date: c.auth_expiration });
        load();
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients]);

  const complete = async (id: string) => {
    await supabase.from("tasks").update({ completed_at: new Date().toISOString() }).eq("id", id);
    load();
  };

  const reopen = async (id: string) => {
    await supabase.from("tasks").update({ completed_at: null }).eq("id", id);
    load();
  };

  const deleteTask = async (id: string) => {
    await supabase.from("tasks").delete().eq("id", id); load();
  };

  const addTask = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    await supabase.from("tasks").insert({ title: form.title.trim(), client_id: form.client_id || null, due_date: form.due_date || null, task_type: "custom" });
    setSaving(false); setShowForm(false); setForm({ title: "", client_id: "", due_date: "" }); load();
  };

  const getClient = (id: string | null) => id ? clients.find((c) => c.id === id) : null;

  const today = new Date().toISOString().split("T")[0];
  const overdue    = tasks.filter((t) => !t.completed_at && t.due_date && t.due_date < today);
  const dueToday   = tasks.filter((t) => !t.completed_at && t.due_date === today);
  const upcoming   = tasks.filter((t) => !t.completed_at && (!t.due_date || t.due_date > today));
  const completed  = tasks.filter((t) => !!t.completed_at);

  const TaskRow = ({ t }: { t: Task }) => {
    const cl = getClient(t.client_id);
    const cfg = TYPE_LABELS[t.task_type] || TYPE_LABELS.custom;
    const isOverdue = !t.completed_at && t.due_date && t.due_date < today;
    return (
      <div className={`px-5 py-3 border-b border-surface-200 last:border-0 flex items-center gap-3 ${t.completed_at ? "opacity-50" : ""}`}>
        <button
          onClick={() => t.completed_at ? reopen(t.id) : complete(t.id)}
          className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${t.completed_at ? "bg-emerald-500 border-emerald-500 text-white" : "border-surface-300 hover:border-brand-400"}`}
        >
          {t.completed_at && <span className="text-xs">✓</span>}
        </button>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${t.completed_at ? "line-through text-ink-400" : ""}`}>{t.title}</div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`badge text-[10px] ${cfg.badge}`}>{cfg.label}</span>
            {cl && (
              <button onClick={() => router.push(`/clients/${cl.id}`)} className="text-xs text-brand-500 hover:text-brand-700">
                {cl.first_name} {cl.last_name}
              </button>
            )}
            {t.due_date && (
              <span className={`text-xs ${isOverdue ? "text-red-500 font-semibold" : "text-ink-400"}`}>
                {isOverdue ? "Overdue · " : ""}{t.due_date}
              </span>
            )}
          </div>
        </div>
        <button onClick={() => deleteTask(t.id)} className="text-ink-300 hover:text-red-400 text-sm flex-shrink-0">×</button>
      </div>
    );
  };

  const Section = ({ title, items, color }: { title: string; items: Task[]; color?: string }) =>
    items.length === 0 ? null : (
      <div className="mb-1">
        <div className={`px-5 py-2 text-xs font-bold uppercase tracking-wide bg-surface-50 border-b border-surface-200 ${color || "text-ink-500"}`}>{title} ({items.length})</div>
        {items.map((t) => <TaskRow key={t.id} t={t} />)}
      </div>
    );

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <div className="text-sm text-ink-400 mt-0.5">{tasks.filter((t) => !t.completed_at).length} open</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-surface-100 rounded-lg p-1">
            {(["open", "all"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filter === f ? "bg-white shadow-sm text-ink-900" : "text-ink-500"}`}>
                {f === "open" ? "Open" : "All"}
              </button>
            ))}
          </div>
          <button onClick={() => setShowForm(true)} className="btn-primary btn-sm">+ Add Task</button>
        </div>
      </div>

      {showForm && (
        <div className="card p-5 mb-4">
          <h3 className="font-semibold mb-3">New Task</h3>
          <div className="space-y-3">
            <div><label className="label">Task *</label><input className="input-field" placeholder="What needs to be done?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Client (optional)</label>
                <select className="input-field" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}>
                  <option value="">—</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
                </select>
              </div>
              <div><label className="label">Due Date</label><input type="date" className="input-field" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={addTask} disabled={saving || !form.title.trim()} className="btn-primary btn-sm">{saving ? "Saving..." : "Add Task"}</button>
            <button onClick={() => setShowForm(false)} className="btn-ghost btn-sm">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card p-10 text-center text-ink-400">Loading...</div>
      ) : tasks.length === 0 ? (
        <div className="card p-10 text-center text-ink-400">
          {filter === "open" ? "No open tasks. You're all caught up!" : "No tasks yet."}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <Section title="Overdue"  items={overdue}  color="text-red-600" />
          <Section title="Due Today" items={dueToday} color="text-amber-600" />
          <Section title="Upcoming" items={upcoming} />
          {filter === "all" && <Section title="Completed" items={completed} />}
        </div>
      )}
    </div>
  );
}
