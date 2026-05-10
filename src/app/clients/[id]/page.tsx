"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fmt, formatDate, formatDateTime, DAYS } from "@/lib/utils";
import { useUser } from "@/lib/user-context";
import type { Client, Therapist, ServiceType, ClientNote, ClientFile } from "@/lib/types";

const NOTE_CATEGORIES = [
  { value: "general", label: "General", color: "badge-blue" },
  { value: "evaluation", label: "Evaluation", color: "badge-amber" },
  { value: "session", label: "Session", color: "badge-green" },
  { value: "billing", label: "Billing", color: "badge-red" },
  { value: "insurance", label: "Insurance", color: "badge-gray" },
  { value: "other", label: "Other", color: "badge-gray" },
];

const FILE_CATEGORIES = [
  { value: "evaluation", label: "Evaluation" },
  { value: "insurance", label: "Insurance" },
  { value: "medical", label: "Medical" },
  { value: "consent", label: "Consent" },
  { value: "report", label: "Report" },
  { value: "other", label: "Other" },
];

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { role } = useUser();
  const isTherapist = role === "therapist";
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [therapist, setTherapist] = useState<Therapist | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [notes, setNotes] = useState<ClientNote[]>([]);
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<"notes" | "files">("notes");
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [noteForm, setNoteForm] = useState({ title: "", content: "", category: "general" });
  const [savingNote, setSavingNote] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileCategory, setFileCategory] = useState("evaluation");
  const [fileNote, setFileNote] = useState("");

  const load = useCallback(async () => {
    const { data: c } = await supabase.from("clients").select("*").eq("id", clientId).single();
    if (!c) { setLoading(false); return; }
    setClient(c);

    const [notesRes, filesRes, chargesRes, paymentsRes] = await Promise.all([
      supabase.from("client_notes").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("client_files").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("charges").select("amount").eq("client_id", clientId),
      supabase.from("payments").select("amount").eq("client_id", clientId),
    ]);

    setNotes(notesRes.data || []);
    setFiles(filesRes.data || []);
    const totalCharges = (chargesRes.data || []).reduce((s: number, r: any) => s + Number(r.amount), 0);
    const totalPayments = (paymentsRes.data || []).reduce((s: number, r: any) => s + Number(r.amount), 0);
    setBalance(totalCharges - totalPayments);

    const [tRes, sRes] = await Promise.all([
      c.therapist_id ? supabase.from("therapists").select("*").eq("id", c.therapist_id).single() : Promise.resolve({ data: null }),
      c.service_type_id ? supabase.from("service_types").select("*").eq("id", c.service_type_id).single() : Promise.resolve({ data: null }),
    ]);
    setTherapist(tRes.data);
    setServiceType(sRes.data);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const saveNote = async () => {
    if (!noteForm.title.trim()) return;
    setSavingNote(true);
    const payload = {
      client_id: clientId,
      title: noteForm.title.trim(),
      content: noteForm.content.trim() || null,
      category: noteForm.category,
      updated_at: new Date().toISOString(),
    };
    if (editNoteId) {
      await supabase.from("client_notes").update(payload).eq("id", editNoteId);
    } else {
      await supabase.from("client_notes").insert(payload);
    }
    setSavingNote(false);
    setShowNoteForm(false);
    load();
  };

  const deleteNote = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    await supabase.from("client_notes").delete().eq("id", id);
    load();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${clientId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("client-files").upload(path, file);
    if (uploadError) {
      alert("Upload failed: " + uploadError.message);
      setUploading(false);
      return;
    }
    await supabase.from("client_files").insert({
      client_id: clientId,
      file_name: file.name,
      file_type: file.type || file.name.split(".").pop(),
      file_size: file.size,
      storage_path: path,
      category: fileCategory,
      notes: fileNote.trim() || null,
    });
    setFileNote("");
    setUploading(false);
    e.target.value = "";
    load();
  };

  const deleteFile = async (f: ClientFile) => {
    if (!confirm(`Delete "${f.file_name}"?`)) return;
    await supabase.storage.from("client-files").remove([f.storage_path]);
    await supabase.from("client_files").delete().eq("id", f.id);
    load();
  };

  const getFileUrl = (path: string) => supabase.storage.from("client-files").getPublicUrl(path).data.publicUrl;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getCatBadge = (cat: string) => NOTE_CATEGORIES.find((c) => c.value === cat) || NOTE_CATEGORIES[5];

  if (loading) return <div className="text-ink-400 py-12 text-center">Loading...</div>;
  if (!client) return <div className="text-ink-400 py-12 text-center">Client not found.</div>;

  return (
    <div>
      <button onClick={() => router.push("/clients")} className="btn-ghost btn-sm mb-4">&larr; Back to Clients</button>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{client.first_name} {client.last_name}</h1>
          <div className="text-sm text-ink-500 mt-1 space-x-3">
            {client.guardian && <span>Guardian: {client.guardian}</span>}
            {client.phone && <span>{client.phone}</span>}
            {client.email && <span>{client.email}</span>}
          </div>
          {client.address && <div className="text-sm text-ink-400 mt-0.5">{client.address}</div>}
        </div>
        {!isTherapist && (
          <div className="text-right">
            <div className="text-xs text-ink-400 uppercase tracking-wide font-semibold">Balance</div>
            <div className={`text-3xl font-bold ${balance > 0 ? "text-red-600" : balance < 0 ? "text-emerald-600" : "text-ink-500"}`}>
              {balance > 0 ? fmt(balance) : balance < 0 ? `-${fmt(balance)}` : "$0.00"}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card p-4">
          <div className="text-xs text-ink-400 uppercase tracking-wide font-semibold mb-1">Therapist</div>
          {therapist ? (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: therapist.color }} />
              <span className="font-semibold text-sm">{therapist.name}</span>
            </div>
          ) : <span className="text-ink-400 text-sm">&mdash;</span>}
        </div>
        <div className="card p-4">
          <div className="text-xs text-ink-400 uppercase tracking-wide font-semibold mb-1">Service</div>
          <div className="font-semibold text-sm">{serviceType?.name || "—"}</div>
          {!isTherapist && serviceType && <div className="text-xs text-ink-400">${Number(serviceType.rate).toFixed(2)} / session</div>}
        </div>
        <div className="card p-4">
          <div className="text-xs text-ink-400 uppercase tracking-wide font-semibold mb-1">Schedule</div>
          <div className="font-semibold text-sm">
            {client.session_days?.length > 0 ? client.session_days.map((d) => DAYS[d]).join(", ") : "—"}
          </div>
          {serviceType && <div className="text-xs text-ink-400">{serviceType.duration} min sessions</div>}
        </div>
        <div className="card p-4">
          <div className="text-xs text-ink-400 uppercase tracking-wide font-semibold mb-1">Since</div>
          <div className="font-semibold text-sm">{client.start_date ? formatDate(client.start_date) : "—"}</div>
          <div className="text-xs text-ink-400">{client.active ? "Active" : "Inactive"}</div>
        </div>
      </div>

      <div className="flex gap-1 bg-surface-100 rounded-lg p-1 w-fit mb-4">
        {(["notes", "files"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-md text-sm font-semibold transition-all ${tab === t ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}>
            {t === "notes" ? `Notes (${notes.length})` : `Files (${files.length})`}
          </button>
        ))}
      </div>

      {tab === "notes" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-ink-500">{notes.length} note{notes.length !== 1 ? "s" : ""}</div>
            {!isTherapist && (
              <button onClick={() => { setNoteForm({ title: "", content: "", category: "general" }); setEditNoteId(null); setShowNoteForm(true); }} className="btn-primary btn-sm">
                + Add Note
              </button>
            )}
          </div>

          {showNoteForm && (
            <div className="card p-5 mb-4">
              <h3 className="font-semibold mb-4">{editNoteId ? "Edit" : "New"} Note</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="label">Title *</label>
                  <input className="input-field" placeholder="e.g. Initial Evaluation Notes" value={noteForm.title}
                    onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })} />
                </div>
                <div>
                  <label className="label">Category</label>
                  <select className="input-field" value={noteForm.category}
                    onChange={(e) => setNoteForm({ ...noteForm, category: e.target.value })}>
                    {NOTE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="label">Content</label>
                <textarea className="input-field" rows={6} placeholder="Type your notes here..."
                  value={noteForm.content} onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })} />
              </div>
              <div className="flex gap-2">
                <button onClick={saveNote} disabled={savingNote || !noteForm.title.trim()} className="btn-primary btn-sm">
                  {savingNote ? "Saving..." : editNoteId ? "Update Note" : "Save Note"}
                </button>
                <button onClick={() => setShowNoteForm(false)} className="btn-ghost btn-sm">Cancel</button>
              </div>
            </div>
          )}

          {notes.length === 0 ? (
            <div className="card p-10 text-center text-ink-400">No notes yet. Add your first note above.</div>
          ) : (
            <div className="space-y-3">
              {notes.map((n) => {
                const cat = getCatBadge(n.category);
                return (
                  <div key={n.id} className="card p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{n.title}</span>
                          <span className={`badge ${cat.color}`}>{cat.label}</span>
                        </div>
                        <div className="text-xs text-ink-400 mt-0.5">{formatDateTime(n.created_at)}</div>
                      </div>
                      {!isTherapist && (
                        <div className="flex gap-1">
                          <button onClick={() => { setNoteForm({ title: n.title, content: n.content || "", category: n.category }); setEditNoteId(n.id); setShowNoteForm(true); }} className="btn-ghost btn-sm">Edit</button>
                          <button onClick={() => deleteNote(n.id)} className="btn-ghost btn-sm text-red-500">Delete</button>
                        </div>
                      )}
                    </div>
                    {n.content && (
                      <div className="text-sm text-ink-700 whitespace-pre-wrap bg-surface-50 rounded-lg p-3 mt-2">{n.content}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "files" && (
        <div>
          <div className="card p-5 mb-4">
            <h3 className="font-semibold mb-3">Upload File</h3>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="label">Category</label>
                <select className="input-field w-40" value={fileCategory} onChange={(e) => setFileCategory(e.target.value)}>
                  {FILE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="label">Note (optional)</label>
                <input className="input-field" placeholder="Brief description..." value={fileNote}
                  onChange={(e) => setFileNote(e.target.value)} />
              </div>
              <div>
                <label className={`btn-primary btn-sm inline-flex items-center gap-2 cursor-pointer ${uploading ? "opacity-50" : ""}`}>
                  {uploading ? "Uploading..." : "Choose File"}
                  <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading}
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.txt,.csv,.xlsx" />
                </label>
              </div>
            </div>
            <div className="text-xs text-ink-400 mt-2">Accepted: PDF, Word, Images, Excel, CSV, Text</div>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-ink-500">{files.length} file{files.length !== 1 ? "s" : ""}</div>
          </div>

          {files.length === 0 ? (
            <div className="card p-10 text-center text-ink-400">No files uploaded yet.</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-200">
                    <th className="table-header">File</th>
                    <th className="table-header">Category</th>
                    <th className="table-header">Size</th>
                    <th className="table-header">Uploaded</th>
                    <th className="table-header">Note</th>
                    <th className="table-header text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => {
                    const icon = f.file_type?.includes("pdf") ? "📄" :
                      f.file_type?.includes("image") || ["png","jpg","jpeg"].some(ext => f.file_type?.includes(ext)) ? "🖼️" :
                      f.file_type?.includes("doc") ? "📝" :
                      ["sheet","csv","xlsx"].some(t => f.file_type?.includes(t)) ? "📊" : "📎";
                    return (
                      <tr key={f.id} className="table-row">
                        <td className="table-cell">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{icon}</span>
                            <span className="font-medium text-sm">{f.file_name}</span>
                          </div>
                        </td>
                        <td className="table-cell">
                          <span className="badge badge-blue">{FILE_CATEGORIES.find((c) => c.value === f.category)?.label || f.category}</span>
                        </td>
                        <td className="table-cell text-ink-500 text-sm">{f.file_size ? formatSize(f.file_size) : "—"}</td>
                        <td className="table-cell text-ink-500 text-sm">{formatDate(f.created_at)}</td>
                        <td className="table-cell text-ink-500 text-sm">{f.notes || "—"}</td>
                        <td className="table-cell text-right">
                          <a href={getFileUrl(f.storage_path)} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm inline-block">View</a>
                          <button onClick={() => deleteFile(f)} className="btn-ghost btn-sm text-red-500">Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
