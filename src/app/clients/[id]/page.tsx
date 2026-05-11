"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fmt, formatDate, formatDateTime, DAYS } from "@/lib/utils";
import { useUser } from "@/lib/user-context";
import Modal from "@/components/Modal";
import type { Client, Therapist, ServiceType, ClientNote, ClientFile, SessionNote, Goal, Task, SoapCptCode } from "@/lib/types";
import { ICD10_CODES } from "@/lib/icd10-codes";
import { CPT_CODES } from "@/lib/cpt-codes";
import { INSURANCE_COMPANIES } from "@/lib/insurance-companies";

const NOTE_CATEGORIES = [
  { value: "general",   label: "General",    color: "badge-blue" },
  { value: "evaluation",label: "Evaluation", color: "badge-amber" },
  { value: "session",   label: "Session",    color: "badge-green" },
  { value: "billing",   label: "Billing",    color: "badge-red" },
  { value: "insurance", label: "Insurance",  color: "badge-gray" },
  { value: "other",     label: "Other",      color: "badge-gray" },
];

const FILE_CATEGORIES = [
  { value: "evaluation", label: "Evaluation" },
  { value: "insurance",  label: "Insurance" },
  { value: "medical",    label: "Medical" },
  { value: "consent",    label: "Consent" },
  { value: "report",     label: "Report" },
  { value: "other",      label: "Other" },
];

const GOAL_CATEGORIES = [
  "Fine Motor", "Gross Motor", "Sensory Processing", "Self-Care / ADL",
  "Cognitive", "Social-Emotional", "Communication", "Other",
];

type Tab = "soap" | "goals" | "insurance" | "forms" | "notes" | "files";

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { role } = useUser();
  const isTherapist = role === "therapist";
  const clientId = params.id as string;

  const [client, setClient]       = useState<Client | null>(null);
  const [therapist, setTherapist] = useState<Therapist | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [notes, setNotes]         = useState<ClientNote[]>([]);
  const [files, setFiles]         = useState<ClientFile[]>([]);
  const [soapNotes, setSoapNotes] = useState<SessionNote[]>([]);
  const [goals, setGoals]         = useState<Goal[]>([]);
  const [balance, setBalance]     = useState(0);
  const [loading, setLoading]     = useState(true);

  const [tab, setTab] = useState<Tab>("soap");

  // ── Edit client modal ─────────────────────────────────────────────────────
  const [showEdit, setShowEdit]     = useState(false);
  const [editForm, setEditForm]     = useState<Partial<Client>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [allTherapists, setAllTherapists]       = useState<Therapist[]>([]);
  const [allServiceTypes, setAllServiceTypes]   = useState<ServiceType[]>([]);

  const openEdit = () => {
    if (!client) return;
    setEditForm({ ...client });
    setShowEdit(true);
    // Load therapists and service types if not loaded
    if (!allTherapists.length) {
      supabase.from("therapists").select("*").eq("active", true).order("name")
        .then(({ data }) => setAllTherapists(data || []));
      supabase.from("service_types").select("*").eq("active", true).order("name")
        .then(({ data }) => setAllServiceTypes(data || []));
    }
  };

  const saveEdit = async () => {
    if (!editForm.first_name?.trim() || !editForm.last_name?.trim()) return;
    setSavingEdit(true);
    await supabase.from("clients").update({
      first_name:      editForm.first_name?.trim(),
      last_name:       editForm.last_name?.trim(),
      guardian:        editForm.guardian?.trim()  || null,
      phone:           editForm.phone?.trim()     || null,
      email:           editForm.email?.trim()     || null,
      address:         editForm.address?.trim()   || null,
      therapist_id:    editForm.therapist_id      || null,
      service_type_id: editForm.service_type_id   || null,
      session_days:    editForm.session_days       ?? [],
      start_date:      editForm.start_date         || null,
      notes:           editForm.notes?.trim()     || null,
      session_rate:    editForm.session_rate       ?? null,
      late_cancel_fee: editForm.late_cancel_fee    ?? null,
      no_show_fee:     editForm.no_show_fee        ?? null,
    }).eq("id", clientId);
    setSavingEdit(false);
    setShowEdit(false);
    load();
  };

  const toggleEditDay = (d: number) => {
    const days = editForm.session_days || [];
    setEditForm({
      ...editForm,
      session_days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b),
    });
  };

  // General note form
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [editNoteId, setEditNoteId]     = useState<string | null>(null);
  const [noteForm, setNoteForm]         = useState({ title: "", content: "", category: "general" });
  const [savingNote, setSavingNote]     = useState(false);

  // SOAP note form
  const [showSoapForm, setShowSoapForm] = useState(false);
  const [editSoapId, setEditSoapId]     = useState<string | null>(null);
  const [soapForm, setSoapForm]         = useState({
    session_date: new Date().toISOString().split("T")[0],
    subjective: "", objective: "", assessment: "", plan: "",
  });
  const [soapCptCodes, setSoapCptCodes] = useState<SoapCptCode[]>([]);
  const [cptSearch, setCptSearch]       = useState("");
  const [savingSoap, setSavingSoap]     = useState(false);
  const [expandedSoap, setExpandedSoap] = useState<string | null>(null);

  // Goal form
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editGoalId, setEditGoalId]     = useState<string | null>(null);
  const [goalForm, setGoalForm]         = useState({
    description: "", category: "Fine Motor", target_date: "", progress: 0, notes: "",
  });
  const [savingGoal, setSavingGoal] = useState(false);

  // File upload
  const [uploading, setUploading]       = useState(false);
  const [fileCategory, setFileCategory] = useState("evaluation");
  const [fileNote, setFileNote]         = useState("");

  // Diagnosis code input
  const [diagInput, setDiagInput] = useState("");
  const [savingDiag, setSavingDiag] = useState(false);

  const load = useCallback(async () => {
    const { data: c } = await supabase.from("clients").select("*").eq("id", clientId).single();
    if (!c) { setLoading(false); return; }
    setClient(c);

    const [notesRes, filesRes, chargesRes, paymentsRes, soapRes, goalsRes] = await Promise.all([
      supabase.from("client_notes").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("client_files").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("charges").select("amount, deleted_at").eq("client_id", clientId),
      supabase.from("payments").select("amount, deleted_at").eq("client_id", clientId),
      supabase.from("session_notes").select("*").eq("client_id", clientId).order("session_date", { ascending: false }),
      supabase.from("goals").select("*").eq("client_id", clientId).order("created_at"),
    ]);

    setNotes(notesRes.data || []);
    setFiles(filesRes.data || []);
    setSoapNotes(soapRes.data || []);
    setGoals(goalsRes.data || []);

    const totalCharges  = (chargesRes.data  || []).filter((r: any) => !r.deleted_at).reduce((s: number, r: any) => s + Number(r.amount), 0);
    const totalPayments = (paymentsRes.data || []).filter((r: any) => !r.deleted_at).reduce((s: number, r: any) => s + Number(r.amount), 0);
    setBalance(totalCharges - totalPayments);

    const [tRes, sRes] = await Promise.all([
      c.therapist_id    ? supabase.from("therapists").select("*").eq("id", c.therapist_id).single()   : Promise.resolve({ data: null }),
      c.service_type_id ? supabase.from("service_types").select("*").eq("id", c.service_type_id).single() : Promise.resolve({ data: null }),
    ]);
    setTherapist(tRes.data);
    setServiceType(sRes.data);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  // ── General notes ──────────────────────────────────────────────────────────
  const saveNote = async () => {
    if (!noteForm.title.trim()) return;
    setSavingNote(true);
    const payload = { client_id: clientId, title: noteForm.title.trim(), content: noteForm.content.trim() || null, category: noteForm.category, updated_at: new Date().toISOString() };
    if (editNoteId) { await supabase.from("client_notes").update(payload).eq("id", editNoteId); }
    else            { await supabase.from("client_notes").insert(payload); }
    setSavingNote(false); setShowNoteForm(false); load();
  };
  const deleteNote = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    await supabase.from("client_notes").delete().eq("id", id); load();
  };

  // ── SOAP notes ─────────────────────────────────────────────────────────────
  const saveSoap = async () => {
    if (!soapForm.session_date) return;
    setSavingSoap(true);
    const payload = {
      client_id: clientId,
      session_date: soapForm.session_date,
      subjective:  soapForm.subjective.trim()  || null,
      objective:   soapForm.objective.trim()   || null,
      assessment:  soapForm.assessment.trim()  || null,
      plan:        soapForm.plan.trim()        || null,
      cpt_codes:   soapCptCodes,
      updated_at:  new Date().toISOString(),
    };
    if (editSoapId) { await supabase.from("session_notes").update(payload).eq("id", editSoapId); }
    else            { await supabase.from("session_notes").insert(payload); }
    if (!editSoapId) {
      await supabase.from("tasks").update({ completed_at: new Date().toISOString() })
        .eq("client_id", clientId).eq("task_type", "soap_note").eq("due_date", soapForm.session_date).is("completed_at", null);
    }
    setSavingSoap(false); setShowSoapForm(false); setSoapCptCodes([]); load();
  };
  const deleteSoap = async (id: string) => {
    if (!confirm("Delete this SOAP note?")) return;
    await supabase.from("session_notes").delete().eq("id", id); load();
  };

  // ── Goals ──────────────────────────────────────────────────────────────────
  const saveGoal = async () => {
    if (!goalForm.description.trim()) return;
    setSavingGoal(true);
    const payload = { client_id: clientId, description: goalForm.description.trim(), category: goalForm.category, target_date: goalForm.target_date || null, progress: goalForm.progress, notes: goalForm.notes.trim() || null, updated_at: new Date().toISOString() };
    if (editGoalId) { await supabase.from("goals").update(payload).eq("id", editGoalId); }
    else            { await supabase.from("goals").insert(payload); }
    setSavingGoal(false); setShowGoalForm(false); load();
  };
  const updateGoalStatus = async (id: string, status: string) => {
    await supabase.from("goals").update({ status, updated_at: new Date().toISOString() }).eq("id", id); load();
  };
  const updateGoalProgress = async (id: string, progress: number) => {
    await supabase.from("goals").update({ progress, updated_at: new Date().toISOString() }).eq("id", id); load();
  };

  // ── Diagnosis codes ────────────────────────────────────────────────────────
  const addDiagCode = async () => {
    const code = diagInput.trim().toUpperCase();
    if (!code || !client) return;
    const existing = client.diagnosis_codes || [];
    if (existing.includes(code)) { setDiagInput(""); return; }
    setSavingDiag(true);
    await supabase.from("clients").update({ diagnosis_codes: [...existing, code] }).eq("id", clientId);
    setDiagInput(""); setSavingDiag(false); load();
  };
  const removeDiagCode = async (code: string) => {
    if (!client) return;
    const updated = (client.diagnosis_codes || []).filter((c) => c !== code);
    await supabase.from("clients").update({ diagnosis_codes: updated }).eq("id", clientId); load();
  };

  // ── Files ──────────────────────────────────────────────────────────────────
  const ALLOWED_TYPES: Record<string, string> = {
    "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png",
    "image/gif": "gif", "image/webp": "webp", "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/plain": "txt",
  };
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_TYPES[file.type]) { alert("File type not allowed."); e.target.value = ""; return; }
    if (file.size > MAX_FILE_SIZE) { alert("File too large — max 10 MB."); e.target.value = ""; return; }
    setUploading(true);
    const ext  = ALLOWED_TYPES[file.type];
    const path = `${clientId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("client-files").upload(path, file);
    if (uploadError) { alert("Upload failed: " + uploadError.message); setUploading(false); return; }
    await supabase.from("client_files").insert({ client_id: clientId, file_name: file.name, file_type: file.type, file_size: file.size, storage_path: path, category: fileCategory, notes: fileNote.trim() || null });
    setFileNote(""); setUploading(false); e.target.value = ""; load();
  };
  const deleteFile = async (f: ClientFile) => {
    if (!confirm(`Delete "${f.file_name}"?`)) return;
    await supabase.storage.from("client-files").remove([f.storage_path]);
    await supabase.from("client_files").delete().eq("id", f.id); load();
  };
  const openFile = async (path: string) => {
    const { data, error } = await supabase.storage.from("client-files").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) { alert("Could not open file."); return; }
    window.open(data.signedUrl, "_blank");
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const getCatBadge = (cat: string) => NOTE_CATEGORIES.find((c) => c.value === cat) || NOTE_CATEGORIES[5];

  const visibleTabs: { id: Tab; label: string; count?: number }[] = [
    { id: "soap",      label: "SOAP Notes",  count: soapNotes.length },
    { id: "goals",     label: "Goals",       count: goals.filter((g) => g.status === "active").length },
    ...(!isTherapist ? [{ id: "insurance" as Tab, label: "Insurance" }] : []),
    { id: "forms",     label: "Intake Forms" },
    { id: "notes",     label: "Notes",       count: notes.length },
    { id: "files",     label: "Files",       count: files.length },
  ];

  if (loading) return <div className="text-ink-400 py-12 text-center">Loading...</div>;
  if (!client) return <div className="text-ink-400 py-12 text-center">Client not found.</div>;

  const authDaysLeft = client.auth_expiration
    ? Math.ceil((new Date(client.auth_expiration).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.push("/clients")} className="btn-ghost btn-sm">&larr; Back to Clients</button>
        {!isTherapist && (
          <button onClick={openEdit} className="btn-outline btn-sm">Edit Client</button>
        )}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">{client.first_name} {client.last_name}</h1>
          <div className="text-sm text-ink-500 mt-1 flex flex-wrap gap-x-3">
            {client.guardian && <span>Guardian: {client.guardian}</span>}
            {client.phone    && <span>{client.phone}</span>}
            {client.email    && <span>{client.email}</span>}
          </div>
          {client.address && <div className="text-sm text-ink-400 mt-0.5">{client.address}</div>}
          {/* Diagnosis codes */}
          {(client.diagnosis_codes?.length > 0) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {client.diagnosis_codes.map((code) => (
                <span key={code} className="flex items-center gap-1 bg-ink-900 text-white text-xs font-mono px-2 py-0.5 rounded-lg">
                  {code}
                  {!isTherapist && (
                    <button onClick={() => removeDiagCode(code)} className="text-white/60 hover:text-white ml-0.5">×</button>
                  )}
                </span>
              ))}
            </div>
          )}
          {!isTherapist && (
            <DiagCodeInput
              value={diagInput}
              onChange={setDiagInput}
              onAdd={addDiagCode}
              saving={savingDiag}
            />
          )}
        </div>
        {!isTherapist && (
          <div className="text-right">
            <div className="text-xs text-ink-400 uppercase tracking-wide font-semibold">Balance</div>
            <div className={`text-3xl font-bold ${balance > 0 ? "text-red-600" : balance < 0 ? "text-emerald-600" : "text-ink-500"}`}>
              {balance > 0 ? fmt(balance) : balance < 0 ? `Credit: ${fmt(balance)}` : "$0.00"}
            </div>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="card p-4">
          <div className="text-xs text-ink-400 uppercase tracking-wide font-semibold mb-1">Therapist</div>
          {therapist ? (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: therapist.color }} />
              <span className="font-semibold text-sm">{therapist.name}</span>
            </div>
          ) : <span className="text-ink-400 text-sm">—</span>}
        </div>
        <div className="card p-4">
          <div className="text-xs text-ink-400 uppercase tracking-wide font-semibold mb-1">Service</div>
          <div className="font-semibold text-sm">{serviceType?.name || "—"}</div>
          {!isTherapist && serviceType && <div className="text-xs text-ink-400">${Number(serviceType.rate).toFixed(2)}/session</div>}
        </div>
        <div className="card p-4">
          <div className="text-xs text-ink-400 uppercase tracking-wide font-semibold mb-1">Schedule</div>
          <div className="font-semibold text-sm">
            {client.session_days?.length > 0 ? client.session_days.map((d) => DAYS[d]).join(", ") : "—"}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-ink-400 uppercase tracking-wide font-semibold mb-1">Since</div>
          <div className="font-semibold text-sm">{client.start_date ? formatDate(client.start_date) : "—"}</div>
          <div className="text-xs text-ink-400">{client.active ? "Active" : "Inactive"}</div>
        </div>
      </div>

      {/* Auth expiry warning */}
      {!isTherapist && authDaysLeft !== null && authDaysLeft <= 30 && (
        <div className={`rounded-xl px-4 py-3 mb-4 text-sm font-semibold border ${authDaysLeft <= 0 ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
          {authDaysLeft <= 0
            ? `⚠ Insurance authorization expired ${Math.abs(authDaysLeft)} days ago`
            : `⚠ Insurance authorization expires in ${authDaysLeft} day${authDaysLeft !== 1 ? "s" : ""}`}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-100 rounded-lg p-1 w-fit mb-5 flex-wrap">
        {visibleTabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${tab === t.id ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-700"}`}>
            {t.label}{t.count !== undefined ? ` (${t.count})` : ""}
          </button>
        ))}
      </div>

      {/* ── SOAP Notes tab ─────────────────────────────────────────────────── */}
      {tab === "soap" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-ink-500">{soapNotes.length} note{soapNotes.length !== 1 ? "s" : ""}</div>
            <button onClick={() => { setSoapForm({ session_date: new Date().toISOString().split("T")[0], subjective: "", objective: "", assessment: "", plan: "" }); setSoapCptCodes([]); setCptSearch(""); setEditSoapId(null); setShowSoapForm(true); }} className="btn-primary btn-sm">
              + New SOAP Note
            </button>
          </div>

          {showSoapForm && (
            <div className="card p-5 mb-4">
              <h3 className="font-semibold mb-4">{editSoapId ? "Edit" : "New"} SOAP Note</h3>
              <div className="mb-4">
                <label className="label">Session Date *</label>
                <input type="date" className="input-field w-44" value={soapForm.session_date} onChange={(e) => setSoapForm({ ...soapForm, session_date: e.target.value })} />
              </div>
              <div className="space-y-4">
                {[
                  { key: "subjective" as const, label: "S — Subjective", hint: "What the client/parent reports: complaints, functional concerns, mood" },
                  { key: "objective"  as const, label: "O — Objective",  hint: "Measurable observations: range of motion, task performance, standardized scores" },
                  { key: "assessment" as const, label: "A — Assessment", hint: "Clinical interpretation: progress toward goals, barriers, clinical reasoning" },
                  { key: "plan"       as const, label: "P — Plan",       hint: "Next session focus, home exercise program, referrals, frequency changes" },
                ].map(({ key, label, hint }) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <div className="text-xs text-ink-400 mb-1">{hint}</div>
                    <textarea className="input-field" rows={3} value={soapForm[key]}
                      onChange={(e) => setSoapForm({ ...soapForm, [key]: e.target.value })} />
                  </div>
                ))}
              </div>
              {/* CPT Code Picker */}
              <div className="bg-surface-50 rounded-xl p-4">
                <div className="font-semibold text-sm mb-3">
                  CPT Codes Billed
                  {soapCptCodes.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-ink-400">
                      {soapCptCodes.reduce((s, c) => s + c.units, 0)} unit{soapCptCodes.reduce((s, c) => s + c.units, 0) !== 1 ? "s" : ""} total
                      {" "}({soapCptCodes.reduce((s, c) => s + c.units, 0) * 15} min)
                    </span>
                  )}
                </div>

                {/* Quick-add common pediatric OT codes */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {["97530","97533","97110","97535","97112","97165","97166","97167","97168","97150"].map((code) => {
                    const cpt = CPT_CODES.find((c) => c.code === code);
                    if (!cpt) return null;
                    const already = soapCptCodes.some((c) => c.code === code);
                    return (
                      <button
                        key={code}
                        onClick={() => {
                          if (already) return;
                          setSoapCptCodes([...soapCptCodes, { code: cpt.code, description: cpt.description, units: 1 }]);
                        }}
                        disabled={already}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${already ? "bg-brand-100 text-brand-600 border-brand-200 cursor-default" : "bg-white text-ink-600 border-surface-300 hover:border-brand-400 hover:text-brand-600"}`}
                        title={cpt.description}
                      >
                        {code}
                      </button>
                    );
                  })}
                </div>

                {/* Search any CPT code */}
                <div className="relative mb-3">
                  <input
                    className="input-field py-1.5 text-sm w-full"
                    placeholder="Search other CPT code..."
                    value={cptSearch}
                    onChange={(e) => setCptSearch(e.target.value)}
                  />
                  {cptSearch.length >= 2 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-surface-200 rounded-xl shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                      {CPT_CODES.filter((c) =>
                        (c.code.includes(cptSearch) || c.description.toLowerCase().includes(cptSearch.toLowerCase())) &&
                        !soapCptCodes.some((s) => s.code === c.code)
                      ).map((c) => (
                        <button key={c.code} className="w-full text-left px-3 py-2 hover:bg-brand-50 flex items-center gap-3 border-b border-surface-100 last:border-0"
                          onMouseDown={(e) => { e.preventDefault(); setSoapCptCodes([...soapCptCodes, { code: c.code, description: c.description, units: 1 }]); setCptSearch(""); }}>
                          <span className="font-mono text-xs font-bold text-brand-600 w-14 flex-shrink-0">{c.code}</span>
                          <span className="text-xs text-ink-600">{c.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected codes with unit counter */}
                {soapCptCodes.length > 0 && (
                  <div className="space-y-2">
                    {soapCptCodes.map((c, i) => (
                      <div key={c.code} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-surface-200">
                        <span className="font-mono text-sm font-bold text-brand-600 w-14 flex-shrink-0">{c.code}</span>
                        <span className="text-xs text-ink-600 flex-1">{c.description}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-xs text-ink-400">Units:</span>
                          <button onClick={() => setSoapCptCodes(soapCptCodes.map((x, j) => j === i ? { ...x, units: Math.max(1, x.units - 1) } : x))} className="w-6 h-6 rounded border border-surface-300 text-sm font-bold hover:bg-surface-100 flex items-center justify-center">−</button>
                          <span className="w-5 text-center text-sm font-bold">{c.units}</span>
                          <button onClick={() => setSoapCptCodes(soapCptCodes.map((x, j) => j === i ? { ...x, units: Math.min(8, x.units + 1) } : x))} className="w-6 h-6 rounded border border-surface-300 text-sm font-bold hover:bg-surface-100 flex items-center justify-center">+</button>
                          <span className="text-xs text-ink-400 w-12">{c.units * 15} min</span>
                          <button onClick={() => setSoapCptCodes(soapCptCodes.filter((_, j) => j !== i))} className="text-ink-300 hover:text-red-400 ml-1">×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {soapCptCodes.length === 0 && (
                  <div className="text-xs text-ink-400 italic">Click codes above or search to add CPT codes for this session.</div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={saveSoap} disabled={savingSoap || !soapForm.session_date} className="btn-primary btn-sm">
                  {savingSoap ? "Saving..." : editSoapId ? "Update Note" : "Save Note"}
                </button>
                <button onClick={() => setShowSoapForm(false)} className="btn-ghost btn-sm">Cancel</button>
              </div>
            </div>
          )}

          {soapNotes.length === 0 && !showSoapForm ? (
            <div className="card p-10 text-center text-ink-400">No SOAP notes yet.</div>
          ) : (
            <div className="space-y-3">
              {soapNotes.map((n) => {
                const isOpen = expandedSoap === n.id;
                return (
                  <div key={n.id} className="card overflow-hidden">
                    <button className="w-full px-5 py-3 flex items-center justify-between hover:bg-surface-50 transition-colors text-left" onClick={() => setExpandedSoap(isOpen ? null : n.id)}>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-sm">{formatDate(n.session_date)}</span>
                        <span className="text-xs text-ink-400">SOAP Note</span>
                        {[n.subjective, n.objective, n.assessment, n.plan].filter(Boolean).length < 4 && (
                          <span className="badge badge-amber text-[10px]">Incomplete</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-ink-400">{formatDateTime(n.created_at)}</span>
                        <span className="text-ink-400">{isOpen ? "▲" : "▼"}</span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-4 border-t border-surface-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                          {[
                            { label: "S — Subjective", value: n.subjective },
                            { label: "O — Objective",  value: n.objective },
                            { label: "A — Assessment", value: n.assessment },
                            { label: "P — Plan",       value: n.plan },
                          ].map(({ label, value }) => (
                            <div key={label}>
                              <div className="text-xs font-bold text-ink-500 uppercase tracking-wide mb-1">{label}</div>
                              <div className="text-sm text-ink-700 bg-surface-50 rounded-lg p-3 min-h-[60px] whitespace-pre-wrap">
                                {value || <span className="text-ink-300 italic">Not recorded</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                        {n.cpt_codes?.length > 0 && (
                          <div className="mt-4">
                            <div className="text-xs font-bold text-ink-500 uppercase tracking-wide mb-2">CPT Codes Billed</div>
                            <div className="flex flex-wrap gap-2">
                              {n.cpt_codes.map((c) => (
                                <div key={c.code} className="flex items-center gap-1.5 bg-brand-50 border border-brand-200 rounded-lg px-2.5 py-1.5">
                                  <span className="font-mono text-xs font-bold text-brand-700">{c.code}</span>
                                  <span className="text-xs text-ink-600">× {c.units} unit{c.units !== 1 ? "s" : ""}</span>
                                  <span className="text-xs text-ink-400">({c.units * 15} min)</span>
                                </div>
                              ))}
                              <div className="text-xs text-ink-400 self-center">
                                = {n.cpt_codes.reduce((s, c) => s + c.units, 0) * 15} min total
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => { setSoapForm({ session_date: n.session_date, subjective: n.subjective || "", objective: n.objective || "", assessment: n.assessment || "", plan: n.plan || "" }); setSoapCptCodes(n.cpt_codes || []); setEditSoapId(n.id); setShowSoapForm(true); }} className="btn-ghost btn-sm">Edit</button>
                          <button onClick={() => deleteSoap(n.id)} className="btn-ghost btn-sm text-red-500">Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Goals tab ──────────────────────────────────────────────────────── */}
      {tab === "goals" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-ink-500">
              {goals.filter((g) => g.status === "active").length} active · {goals.filter((g) => g.status === "mastered").length} mastered
            </div>
            <button onClick={() => { setGoalForm({ description: "", category: "Fine Motor", target_date: "", progress: 0, notes: "" }); setEditGoalId(null); setShowGoalForm(true); }} className="btn-primary btn-sm">
              + Add Goal
            </button>
          </div>

          {showGoalForm && (
            <div className="card p-5 mb-4">
              <h3 className="font-semibold mb-4">{editGoalId ? "Edit" : "Add"} Goal</h3>
              <div className="space-y-3">
                <div>
                  <label className="label">Goal Description *</label>
                  <textarea className="input-field" rows={2} placeholder="e.g. Client will improve bilateral coordination to complete age-appropriate cutting tasks with 80% accuracy" value={goalForm.description} onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Category</label>
                    <select className="input-field" value={goalForm.category} onChange={(e) => setGoalForm({ ...goalForm, category: e.target.value })}>
                      {GOAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Target Date</label>
                    <input type="date" className="input-field" value={goalForm.target_date} onChange={(e) => setGoalForm({ ...goalForm, target_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="label">Initial Progress: {goalForm.progress}%</label>
                  <input type="range" min={0} max={100} step={5} className="w-full" value={goalForm.progress} onChange={(e) => setGoalForm({ ...goalForm, progress: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="label">Notes</label>
                  <input className="input-field" placeholder="Baseline data, measurement criteria..." value={goalForm.notes} onChange={(e) => setGoalForm({ ...goalForm, notes: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={saveGoal} disabled={savingGoal || !goalForm.description.trim()} className="btn-primary btn-sm">
                  {savingGoal ? "Saving..." : editGoalId ? "Update Goal" : "Add Goal"}
                </button>
                <button onClick={() => setShowGoalForm(false)} className="btn-ghost btn-sm">Cancel</button>
              </div>
            </div>
          )}

          {goals.length === 0 && !showGoalForm ? (
            <div className="card p-10 text-center text-ink-400">No goals yet. Add goals to track client progress.</div>
          ) : (
            <div className="space-y-3">
              {(["active", "mastered", "discontinued"] as const).map((status) => {
                const statusGoals = goals.filter((g) => g.status === status);
                if (statusGoals.length === 0) return null;
                return (
                  <div key={status}>
                    <div className="text-xs font-bold text-ink-400 uppercase tracking-wide mb-2 px-1">
                      {status === "active" ? "Active Goals" : status === "mastered" ? "Mastered ✓" : "Discontinued"}
                    </div>
                    {statusGoals.map((g) => (
                      <div key={g.id} className={`card p-4 mb-2 ${status !== "active" ? "opacity-60" : ""}`}>
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1">
                            <div className="font-semibold text-sm">{g.description}</div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="badge badge-blue text-[10px]">{g.category}</span>
                              {g.target_date && <span className="text-xs text-ink-400">Target: {formatDate(g.target_date)}</span>}
                            </div>
                            {g.notes && <div className="text-xs text-ink-400 mt-1 italic">{g.notes}</div>}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            {status === "active" && (
                              <button onClick={() => updateGoalStatus(g.id, "mastered")} className="btn-ghost btn-sm text-emerald-600">✓ Mastered</button>
                            )}
                            <button onClick={() => { setGoalForm({ description: g.description, category: g.category, target_date: g.target_date || "", progress: g.progress, notes: g.notes || "" }); setEditGoalId(g.id); setShowGoalForm(true); }} className="btn-ghost btn-sm">Edit</button>
                            {status === "active" && (
                              <button onClick={() => updateGoalStatus(g.id, "discontinued")} className="btn-ghost btn-sm text-red-400">Drop</button>
                            )}
                          </div>
                        </div>
                        {status === "active" && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-ink-500">Progress</span>
                              <span className="text-xs font-bold text-ink-700">{g.progress}%</span>
                            </div>
                            <input type="range" min={0} max={100} step={5} className="w-full"
                              value={g.progress}
                              onChange={(e) => updateGoalProgress(g.id, Number(e.target.value))}
                            />
                            <div className="w-full bg-surface-200 rounded-full h-1.5 mt-1">
                              <div className="bg-brand-600 h-1.5 rounded-full transition-all" style={{ width: `${g.progress}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Insurance tab ──────────────────────────────────────────────────── */}
      {tab === "insurance" && !isTherapist && (
        <InsuranceTab client={client} clientId={clientId} onSaved={load} />
      )}

      {/* ── Intake forms tab ──────────────────────────────────────────────── */}
      {tab === "forms" && (
        <IntakeFormsTab clientId={clientId} client={client} />
      )}

      {/* ── General notes tab ──────────────────────────────────────────────── */}
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
                <div><label className="label">Title *</label><input className="input-field" value={noteForm.title} onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })} /></div>
                <div><label className="label">Category</label>
                  <select className="input-field" value={noteForm.category} onChange={(e) => setNoteForm({ ...noteForm, category: e.target.value })}>
                    {NOTE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-4"><label className="label">Content</label><textarea className="input-field" rows={5} value={noteForm.content} onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })} /></div>
              <div className="flex gap-2">
                <button onClick={saveNote} disabled={savingNote || !noteForm.title.trim()} className="btn-primary btn-sm">{savingNote ? "Saving..." : editNoteId ? "Update" : "Save"}</button>
                <button onClick={() => setShowNoteForm(false)} className="btn-ghost btn-sm">Cancel</button>
              </div>
            </div>
          )}
          {notes.length === 0 && !showNoteForm ? (
            <div className="card p-10 text-center text-ink-400">No notes yet.</div>
          ) : (
            <div className="space-y-3">
              {notes.map((n) => {
                const cat = getCatBadge(n.category);
                return (
                  <div key={n.id} className="card p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
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
                    {n.content && <div className="text-sm text-ink-700 whitespace-pre-wrap bg-surface-50 rounded-lg p-3 mt-2">{n.content}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Files tab ──────────────────────────────────────────────────────── */}
      {tab === "files" && (
        <div>
          <div className="card p-5 mb-4">
            <h3 className="font-semibold mb-3">Upload File</h3>
            <div className="flex flex-wrap items-end gap-4">
              <div><label className="label">Category</label>
                <select className="input-field w-40" value={fileCategory} onChange={(e) => setFileCategory(e.target.value)}>
                  {FILE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]"><label className="label">Note (optional)</label><input className="input-field" placeholder="Brief description..." value={fileNote} onChange={(e) => setFileNote(e.target.value)} /></div>
              <div>
                <label className={`btn-primary btn-sm inline-flex items-center gap-2 cursor-pointer ${uploading ? "opacity-50" : ""}`}>
                  {uploading ? "Uploading..." : "Choose File"}
                  <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt" onChange={handleFileUpload} disabled={uploading} />
                </label>
              </div>
            </div>
            <div className="text-xs text-ink-400 mt-2">PDF, images, Word, Excel — max 10 MB</div>
          </div>

          {files.length === 0 ? (
            <div className="card p-10 text-center text-ink-400">No files uploaded yet.</div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-surface-200">
                    <th className="table-header">File</th>
                    <th className="table-header">Category</th>
                    <th className="table-header">Size</th>
                    <th className="table-header">Uploaded</th>
                    <th className="table-header text-right">Actions</th>
                  </tr></thead>
                  <tbody>
                    {files.map((f) => (
                      <tr key={f.id} className="table-row">
                        <td className="table-cell">
                          <div className="font-medium">{f.file_name}</div>
                          {f.notes && <div className="text-xs text-ink-400">{f.notes}</div>}
                        </td>
                        <td className="table-cell"><span className="badge badge-gray">{f.category}</span></td>
                        <td className="table-cell text-ink-500">{formatSize(f.file_size)}</td>
                        <td className="table-cell text-ink-500">{formatDateTime(f.created_at)}</td>
                        <td className="table-cell text-right">
                          <button onClick={() => openFile(f.storage_path)} className="btn-ghost btn-sm">View</button>
                          <button onClick={() => deleteFile(f)} className="btn-ghost btn-sm text-red-500">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Edit Client Modal ───────────────────────────────────────────────── */}
      {showEdit && client && (
        <Modal
          title="Edit Client"
          subtitle={`${client.first_name} ${client.last_name}`}
          onClose={() => setShowEdit(false)}
          footer={
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowEdit(false)} className="btn-ghost btn-sm">Cancel</button>
              <button onClick={saveEdit} disabled={savingEdit || !editForm.first_name?.trim() || !editForm.last_name?.trim()} className="btn-primary btn-sm">
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">First Name *</label><input className="input-field" value={editForm.first_name || ""} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} /></div>
              <div><label className="label">Last Name *</label><input className="input-field" value={editForm.last_name || ""} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} /></div>
              <div><label className="label">Guardian / Parent</label><input className="input-field" placeholder="Miriam Cohen" value={editForm.guardian || ""} onChange={(e) => setEditForm({ ...editForm, guardian: e.target.value })} /></div>
              <div><label className="label">Phone</label><input className="input-field" placeholder="732-555-0101" value={editForm.phone || ""} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
              <div><label className="label">Email</label><input className="input-field" type="email" value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
              <div><label className="label">Address</label><input className="input-field" value={editForm.address || ""} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></div>
              <div>
                <label className="label">Therapist</label>
                <select className="input-field" value={editForm.therapist_id || ""} onChange={(e) => setEditForm({ ...editForm, therapist_id: e.target.value })}>
                  <option value="">Select...</option>
                  {allTherapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Service Type</label>
                <select className="input-field" value={editForm.service_type_id || ""} onChange={(e) => setEditForm({ ...editForm, service_type_id: e.target.value })}>
                  <option value="">Select...</option>
                  {allServiceTypes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><label className="label">Start Date</label><input className="input-field" type="date" value={editForm.start_date || ""} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} /></div>
            </div>

            <div className="bg-surface-50 rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-3">Rates & Fees</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: "Session Rate", key: "session_rate" as const },
                  { label: "Late Cancel Fee", key: "late_cancel_fee" as const },
                  { label: "No-Show Fee", key: "no_show_fee" as const },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="label">{label}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-ink-400 text-sm">$</span>
                      <input className="input-field pl-7" type="number" step="0.01" placeholder="0.00"
                        value={editForm[key] ?? ""}
                        onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value ? parseFloat(e.target.value) : null })} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Session Days</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day, i) => (
                  <button key={i} type="button" onClick={() => toggleEditDay(i)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                      (editForm.session_days || []).includes(i)
                        ? "bg-brand-600 text-white border-brand-600"
                        : "bg-white text-ink-500 border-surface-300 hover:border-brand-300"
                    }`}>
                    {day}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Notes</label>
              <textarea className="input-field" rows={2} value={editForm.notes || ""} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Diagnosis Code Autocomplete ───────────────────────────────────────────────
function DiagCodeInput({ value, onChange, onAdd, saving }: {
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const matches = value.trim().length >= 2
    ? ICD10_CODES.filter((c) =>
        c.code.toLowerCase().includes(value.toLowerCase()) ||
        c.description.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 10)
    : [];

  return (
    <div className="relative mt-2" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <div className="flex items-center gap-1.5">
        <input
          className="input-field py-1 text-xs w-64"
          placeholder="Search ICD-10 code or description..."
          value={value}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); setOpen(false); } if (e.key === "Escape") setOpen(false); }}
          onFocus={() => setOpen(true)}
        />
        <button onClick={() => { onAdd(); setOpen(false); }} disabled={saving || !value.trim()} className="btn-outline btn-sm text-xs flex-shrink-0">Add</button>
      </div>
      {open && matches.length > 0 && (
        <div className="absolute z-50 top-full left-0 mt-1 w-96 bg-white border border-surface-200 rounded-xl shadow-lg overflow-hidden">
          {matches.map((c) => (
            <button
              key={c.code}
              tabIndex={0}
              className="w-full text-left px-3 py-2 hover:bg-brand-50 flex items-center gap-3 border-b border-surface-100 last:border-0"
              onMouseDown={(e) => { e.preventDefault(); onChange(c.code); onAdd(); setOpen(false); }}
            >
              <span className="font-mono text-xs font-bold text-brand-600 w-16 flex-shrink-0">{c.code}</span>
              <span className="text-xs text-ink-600">{c.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Intake Forms Tab ──────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: "registration" as const,
    label: "New Client Registration",
    fields: [
      { key: "emergency_contact_name",  label: "Emergency Contact Name" },
      { key: "emergency_contact_phone", label: "Emergency Contact Phone" },
      { key: "emergency_contact_rel",   label: "Relationship to Client" },
      { key: "school_name",             label: "School / Program" },
      { key: "teacher_name",            label: "Teacher / Case Manager" },
      { key: "referral_source",         label: "Referred By" },
      { key: "reason_for_referral",     label: "Reason for Referral", multiline: true },
    ],
  },
  {
    id: "consent" as const,
    label: "Consent to Treat",
    fields: [
      { key: "consent_given_by",        label: "Consent Given By (Name)" },
      { key: "relationship",            label: "Relationship to Client" },
      { key: "consent_date",            label: "Date Signed", type: "date" },
      { key: "hipaa_acknowledged",      label: "HIPAA Notice Acknowledged (yes/no)" },
      { key: "financial_responsibility",label: "Financial Responsibility Acknowledged (yes/no)" },
    ],
  },
  {
    id: "medical_history" as const,
    label: "Medical History",
    fields: [
      { key: "primary_diagnosis",   label: "Primary Diagnosis / Reason for OT" },
      { key: "other_diagnoses",     label: "Other Medical Diagnoses" },
      { key: "medications",         label: "Current Medications" },
      { key: "prior_therapy",       label: "Prior Therapy Services" },
      { key: "allergies",           label: "Allergies / Precautions" },
      { key: "surgical_history",    label: "Surgical / Medical History" },
      { key: "concerns",            label: "Primary Concerns / Goals", multiline: true },
    ],
  },
];

function IntakeFormsTab({ clientId, client }: { clientId: string; client: Client }) {
  const [forms, setForms]       = useState<Record<string, { id: string; form_data: any; completed_at: string | null }>>({});
  const [activeForm, setActive] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    supabase.from("intake_forms").select("*").eq("client_id", clientId)
      .then(({ data }) => {
        const map: Record<string, any> = {};
        (data || []).forEach((r) => { map[r.template] = r; });
        setForms(map);
        setLoading(false);
      });
  }, [clientId]);

  const openForm = (templateId: string) => {
    const existing = forms[templateId];
    setFormData(existing?.form_data || {});
    setActive(templateId);
  };

  const saveForm = async () => {
    if (!activeForm) return;
    setSaving(true);
    const existing = forms[activeForm];
    const payload  = { client_id: clientId, template: activeForm, form_data: formData, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (existing) { await supabase.from("intake_forms").update(payload).eq("id", existing.id); }
    else          { await supabase.from("intake_forms").insert(payload); }
    const { data } = await supabase.from("intake_forms").select("*").eq("client_id", clientId);
    const map: Record<string, any> = {};
    (data || []).forEach((r) => { map[r.template] = r; });
    setForms(map);
    setSaving(false);
    setActive(null);
  };

  if (loading) return <div className="text-ink-400 py-8 text-center">Loading...</div>;

  if (activeForm) {
    const tmpl = TEMPLATES.find((t) => t.id === activeForm)!;
    return (
      <div>
        <button onClick={() => setActive(null)} className="btn-ghost btn-sm mb-4">&larr; Back to Forms</button>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold">{tmpl.label}</h3>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="btn-outline btn-sm print:hidden">Print</button>
              <button onClick={saveForm} disabled={saving} className="btn-primary btn-sm print:hidden">
                {saving ? "Saving..." : "Save & Mark Complete"}
              </button>
            </div>
          </div>
          <div className="print:mb-4 print:text-xl print:font-bold print:border-b print:pb-2 hidden print:block">
            {tmpl.label} — {client.first_name} {client.last_name}
          </div>
          <div className="space-y-4">
            {tmpl.fields.map((f) => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                {(f as any).multiline ? (
                  <textarea className="input-field" rows={3} value={formData[f.key] || ""}
                    onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })} />
                ) : (
                  <input className="input-field" type={(f as any).type || "text"} value={formData[f.key] || ""}
                    onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {TEMPLATES.map((t) => {
        const existing = forms[t.id];
        return (
          <div key={t.id} className="card p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm">{t.label}</div>
              <div className="text-xs text-ink-400 mt-0.5">
                {existing?.completed_at
                  ? `Completed ${new Date(existing.completed_at).toLocaleDateString()}`
                  : "Not yet completed"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {existing?.completed_at && (
                <span className="badge badge-green text-[10px]">✓ Complete</span>
              )}
              <button onClick={() => openForm(t.id)} className="btn-outline btn-sm">
                {existing ? "Edit / View" : "Fill Out"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Insurance Tab component ───────────────────────────────────────────────────
function InsuranceTab({ client, clientId, onSaved }: { client: Client; clientId: string; onSaved: () => void }) {
  const [form, setForm] = useState({
    insurance_company: client.insurance_company || "",
    policy_number:     client.policy_number     || "",
    group_number:      client.group_number      || "",
    subscriber_name:   client.subscriber_name   || "",
    subscriber_dob:    client.subscriber_dob    || "",
    auth_number:       client.auth_number       || "",
    authorized_visits: client.authorized_visits != null ? String(client.authorized_visits) : "",
    auth_expiration:   client.auth_expiration   || "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const save = async () => {
    setSaving(true);
    await supabase.from("clients").update({
      insurance_company: form.insurance_company.trim() || null,
      policy_number:     form.policy_number.trim()     || null,
      group_number:      form.group_number.trim()      || null,
      subscriber_name:   form.subscriber_name.trim()   || null,
      subscriber_dob:    form.subscriber_dob            || null,
      auth_number:       form.auth_number.trim()       || null,
      authorized_visits: form.authorized_visits ? parseInt(form.authorized_visits) : null,
      auth_expiration:   form.auth_expiration           || null,
    }).eq("id", clientId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved();
  };

  const f = (key: keyof typeof form, label: string, type = "text", hint?: string, listId?: string) => (
    <div key={key}>
      <label className="label">{label}</label>
      <input className="input-field" type={type} value={form[key]} list={listId}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      {hint && <div className="text-xs text-ink-400 mt-1">{hint}</div>}
    </div>
  );

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold">Insurance Information</h3>
        <button onClick={save} disabled={saving} className="btn-primary btn-sm">
          {saving ? "Saving..." : saved ? "✓ Saved" : "Save"}
        </button>
      </div>
      <datalist id="insurance-list">
        {INSURANCE_COMPANIES.map((name) => <option key={name} value={name} />)}
      </datalist>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {f("insurance_company", "Insurance Company", "text", undefined, "insurance-list")}
        {f("policy_number",     "Policy Number")}
        {f("group_number",      "Group Number")}
        {f("subscriber_name",   "Subscriber Name", "text", "Name on the insurance card")}
        {f("subscriber_dob",    "Subscriber Date of Birth", "date")}
        {f("auth_number",       "Authorization Number")}
        {f("authorized_visits", "Authorized Visits", "number", "Total visits approved")}
        {f("auth_expiration",   "Auth Expiration Date", "date")}
      </div>
    </div>
  );
}
