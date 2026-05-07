"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Therapist { id: string; name: string; color: string; active: boolean; }
interface ServiceType { id: string; name: string; duration: number; rate: number; active: boolean; }
interface Client {
  id: string; first_name: string; last_name: string; phone: string; email: string;
  guardian: string; address: string; therapist_id: string; service_type_id: string;
  session_days: number[]; start_date: string; active: boolean; notes: string;
}

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri"];

export default function ClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [balances, setBalances] = useState<Record<string, number>>({});

  const emptyForm = {
    first_name: "", last_name: "", phone: "", email: "", guardian: "",
    address: "", therapist_id: "", service_type_id: "", session_days: [] as number[],
    start_date: new Date().toISOString().split("T")[0], notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [cRes, tRes, sRes] = await Promise.all([
      supabase.from("clients").select("*").order("last_name, first_name"),
      supabase.from("therapists").select("*").eq("active", true).order("name"),
      supabase.from("service_types").select("*").eq("active", true).order("name"),
    ]);
    setClients(cRes.data || []);
    setTherapists(tRes.data || []);
    setServiceTypes(sRes.data || []);

    // Calculate balances
    const [chRes, pRes] = await Promise.all([
      supabase.from("charges").select("client_id, amount"),
      supabase.from("payments").select("client_id, amount"),
    ]);
    const bals: Record<string, number> = {};
    (chRes.data || []).forEach((c: any) => { bals[c.client_id] = (bals[c.client_id] || 0) + Number(c.amount); });
    (pRes.data || []).forEach((p: any) => { bals[p.client_id] = (bals[p.client_id] || 0) - Number(p.amount); });
    setBalances(bals);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return `${c.first_name} ${c.last_name} ${c.guardian}`.toLowerCase().includes(q);
  });

  const openNew = () => {
    setForm({ ...emptyForm, therapist_id: therapists[0]?.id || "", service_type_id: serviceTypes[0]?.id || "" });
    setEditId(null);
    setShowForm(true);
    setShowImport(false);
  };

  const openEdit = (c: Client) => {
    setForm({
      first_name: c.first_name, last_name: c.last_name, phone: c.phone || "",
      email: c.email || "", guardian: c.guardian || "", address: c.address || "",
      therapist_id: c.therapist_id || "", service_type_id: c.service_type_id || "",
      session_days: c.session_days || [], start_date: c.start_date || "",
      notes: c.notes || "",
    });
    setEditId(c.id);
    setShowForm(true);
    setShowImport(false);
  };

  const toggleDay = (d: number) => {
    setForm((prev) => ({
      ...prev,
      session_days: prev.session_days.includes(d)
        ? prev.session_days.filter((x) => x !== d)
        : [...prev.session_days, d].sort(),
    }));
  };

  const save = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) return;
    setSaving(true);
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      guardian: form.guardian.trim() || null,
      address: form.address.trim() || null,
      therapist_id: form.therapist_id || null,
      service_type_id: form.service_type_id || null,
      session_days: form.session_days,
      start_date: form.start_date || null,
      notes: form.notes.trim() || null,
    };

    if (editId) {
      await supabase.from("clients").update(payload).eq("id", editId);
    } else {
      await supabase.from("clients").insert(payload);
    }
    setSaving(false);
    setShowForm(false);
    load();
  };

  const toggleActive = async (c: Client) => {
    await supabase.from("clients").update({ active: !c.active }).eq("id", c.id);
    load();
  };

  const getTherapist = (id: string) => therapists.find((t) => t.id === id);
  const getService = (id: string) => serviceTypes.find((s) => s.id === id);
  const fmt = (n: number) => "$" + Math.abs(n).toFixed(2);

  if (loading) return <div className="text-ink-400 py-12 text-center">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Clients</h1>
        <div className="flex gap-2">
          <button onClick={() => { setShowImport(true); setShowForm(false); }} className="btn-outline btn-sm">Import CSV</button>
          <button onClick={openNew} className="btn-primary btn-sm">+ Add Client</button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input className="input-field max-w-xs" placeholder="Search clients..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Import Panel */}
      {showImport && (
        <ImportPanel
          therapists={therapists}
          serviceTypes={serviceTypes}
          onDone={() => { setShowImport(false); load(); }}
          onCancel={() => setShowImport(false)}
        />
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="card p-5 mb-4">
          <h3 className="font-semibold mb-4">{editId ? "Edit" : "Add"} Client</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="label">First Name *</label>
              <input className="input-field" placeholder="Yaakov" value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input className="input-field" placeholder="Cohen" value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Guardian / Parent</label>
              <input className="input-field" placeholder="Miriam Cohen" value={form.guardian}
                onChange={(e) => setForm({ ...form, guardian: e.target.value })} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input-field" placeholder="732-555-0101" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input-field" placeholder="email@example.com" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input-field" placeholder="123 Main St, Lakewood NJ" value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label className="label">Therapist</label>
              <select className="input-field" value={form.therapist_id}
                onChange={(e) => setForm({ ...form, therapist_id: e.target.value })}>
                <option value="">Select...</option>
                {therapists.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Service Type</label>
              <select className="input-field" value={form.service_type_id}
                onChange={(e) => setForm({ ...form, service_type_id: e.target.value })}>
                <option value="">Select...</option>
                {serviceTypes.map((s) => <option key={s.id} value={s.id}>{s.name} — ${Number(s.rate).toFixed(2)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Start Date</label>
              <input className="input-field" type="date" value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
          </div>

          {/* Session Days */}
          <div className="mb-4">
            <label className="label">Session Days</label>
            <div className="flex gap-2">
              {DAYS.map((day, i) => (
                <button key={i} onClick={() => toggleDay(i)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                    form.session_days.includes(i)
                      ? "bg-brand-600 text-white border-brand-600"
                      : "bg-white text-ink-500 border-surface-300 hover:border-brand-300"
                  }`}>
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label className="label">Notes</label>
            <textarea className="input-field" rows={2} placeholder="Any additional notes..." value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <div className="flex gap-2">
            <button onClick={save} disabled={saving || !form.first_name.trim() || !form.last_name.trim()}
              className="btn-primary btn-sm">
              {saving ? "Saving..." : editId ? "Update Client" : "Add Client"}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-ghost btn-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Client List */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-ink-400">
          {clients.length === 0 ? "No clients yet. Add your first one or import a CSV." : "No clients match your search."}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-200">
                <th className="table-header">Client</th>
                <th className="table-header">Guardian</th>
                <th className="table-header">Therapist</th>
                <th className="table-header">Service</th>
                <th className="table-header">Schedule</th>
                <th className="table-header text-right">Balance</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const th = getTherapist(c.therapist_id);
                const svc = getService(c.service_type_id);
                const bal = balances[c.id] || 0;
                return (
                  <tr key={c.id} className="table-row cursor-pointer" onClick={() => router.push(`/clients/${c.id}`)}>
                    <td className="table-cell">
                      <div className="font-semibold text-brand-600 hover:text-brand-800">{c.first_name} {c.last_name}</div>
                      {!c.active && <span className="badge badge-gray text-[10px] ml-1">Inactive</span>}
                    </td>
                    <td className="table-cell text-ink-500">{c.guardian || "\u2014"}</td>
                    <td className="table-cell">
                      {th ? (
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: th.color }} />
                          <span className="text-sm">{th.name}</span>
                        </div>
                      ) : <span className="text-ink-400">\u2014</span>}
                    </td>
                    <td className="table-cell text-ink-500 text-sm">{svc?.name || "\u2014"}</td>
                    <td className="table-cell text-sm">
                      {c.session_days?.length > 0
                        ? c.session_days.map((d) => DAYS[d]).join(", ")
                        : <span className="text-ink-400">\u2014</span>}
                    </td>
                    <td className="table-cell text-right">
                      <span className={`font-bold ${bal > 0 ? "text-red-600" : bal < 0 ? "text-emerald-600" : "text-ink-500"}`}>
                        {bal > 0 ? fmt(bal) : bal < 0 ? `-${fmt(bal)}` : "$0.00"}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      <button onClick={(e) => { e.stopPropagation(); router.push(`/clients/${c.id}`); }} className="btn-ghost btn-sm">View</button>
                      <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} className="btn-ghost btn-sm">Edit</button>
                      <button onClick={(e) => { e.stopPropagation(); toggleActive(c); }} className="btn-ghost btn-sm">
                        {c.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 text-xs text-ink-400">
        {clients.filter((c) => c.active).length} active / {clients.length} total clients
      </div>
    </div>
  );
}


/* ── CSV Import Panel ── */
function ImportPanel({
  therapists,
  serviceTypes,
  onDone,
  onCancel,
}: {
  therapists: Therapist[];
  serviceTypes: ServiceType[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [parsed, setParsed] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importCount, setImportCount] = useState(0);

  const dayMap: Record<string, number> = {
    sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2,
    wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5,
  };

  const parseDays = (val: string): number[] => {
    if (!val) return [];
    return val.split(/[,;\/]+/).map((s) => s.trim().toLowerCase())
      .map((s) => dayMap[s] ?? -1).filter((d) => d >= 0).sort();
  };

  const matchTherapist = (val: string): string | null => {
    if (!val) return null;
    const lower = val.toLowerCase().trim();
    const match = therapists.find((t) => t.name.toLowerCase() === lower || t.name.toLowerCase().includes(lower));
    return match?.id || null;
  };

  const matchService = (val: string): string | null => {
    if (!val) return null;
    const lower = val.toLowerCase().trim();
    const match = serviceTypes.find((s) => s.name.toLowerCase() === lower || s.name.toLowerCase().includes(lower));
    return match?.id || null;
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) { setErrors(["File must have a header row and at least one data row."]); return; }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/[^a-z_\s]/g, ""));
      const errs: string[] = [];
      const rows: any[] = [];

      // Map headers
      const colMap: Record<string, number> = {};
      const aliases: Record<string, string[]> = {
        first_name: ["first name", "first", "firstname"],
        last_name: ["last name", "last", "lastname"],
        phone: ["phone", "telephone", "tel"],
        email: ["email", "e-mail"],
        guardian: ["guardian", "parent", "parent name", "guardian name"],
        address: ["address"],
        therapist: ["therapist", "therapist name"],
        service: ["service", "service type", "service_type"],
        days: ["days", "session days", "schedule"],
        start_date: ["start date", "start", "startdate", "start_date"],
        notes: ["notes", "note"],
      };

      for (const [key, names] of Object.entries(aliases)) {
        const idx = headers.findIndex((h) => names.includes(h));
        if (idx >= 0) colMap[key] = idx;
      }

      if (colMap.first_name === undefined && colMap.last_name === undefined) {
        // Try "name" column and split
        const nameIdx = headers.findIndex((h) => h === "name" || h === "client" || h === "client name");
        if (nameIdx >= 0) colMap["full_name"] = nameIdx;
        else { setErrors(["Could not find First Name / Last Name columns. Expected headers: First Name, Last Name"]); return; }
      }

      for (let i = 1; i < lines.length; i++) {
        // Simple CSV parse (handles quoted commas)
        const vals: string[] = [];
        let current = "";
        let inQuotes = false;
        for (const ch of lines[i]) {
          if (ch === '"') { inQuotes = !inQuotes; }
          else if (ch === ',' && !inQuotes) { vals.push(current.trim()); current = ""; }
          else { current += ch; }
        }
        vals.push(current.trim());

        let firstName = "", lastName = "";
        if (colMap.full_name !== undefined) {
          const parts = (vals[colMap.full_name] || "").split(/\s+/);
          firstName = parts[0] || "";
          lastName = parts.slice(1).join(" ") || "";
        } else {
          firstName = vals[colMap.first_name] || "";
          lastName = vals[colMap.last_name] || "";
        }

        if (!firstName && !lastName) { errs.push(`Row ${i + 1}: Missing name, skipped`); continue; }

        const therapistId = colMap.therapist !== undefined ? matchTherapist(vals[colMap.therapist]) : null;
        const serviceId = colMap.service !== undefined ? matchService(vals[colMap.service]) : null;
        const days = colMap.days !== undefined ? parseDays(vals[colMap.days]) : [];

        if (colMap.therapist !== undefined && vals[colMap.therapist] && !therapistId) {
          errs.push(`Row ${i + 1}: Therapist "${vals[colMap.therapist]}" not found`);
        }
        if (colMap.service !== undefined && vals[colMap.service] && !serviceId) {
          errs.push(`Row ${i + 1}: Service "${vals[colMap.service]}" not found`);
        }

        rows.push({
          first_name: firstName,
          last_name: lastName,
          phone: colMap.phone !== undefined ? vals[colMap.phone] || null : null,
          email: colMap.email !== undefined ? vals[colMap.email] || null : null,
          guardian: colMap.guardian !== undefined ? vals[colMap.guardian] || null : null,
          address: colMap.address !== undefined ? vals[colMap.address] || null : null,
          therapist_id: therapistId,
          service_type_id: serviceId,
          session_days: days,
          start_date: colMap.start_date !== undefined ? vals[colMap.start_date] || null : null,
          notes: colMap.notes !== undefined ? vals[colMap.notes] || null : null,
        });
      }

      setParsed(rows);
      setErrors(errs);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const doImport = async () => {
    setImporting(true);
    const { data, error } = await supabase.from("clients").insert(parsed);
    if (error) { setErrors((prev) => [...prev, `Import error: ${error.message}`]); }
    setImportCount(parsed.length);
    setImporting(false);
    setStep("done");
  };

  return (
    <div className="card p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Import Clients from CSV</h3>
        <button onClick={onCancel} className="btn-ghost btn-sm">Cancel</button>
      </div>

      {step === "upload" && (
        <div>
          <div className="border-2 border-dashed border-surface-300 rounded-xl p-8 text-center mb-4 bg-surface-50">
            <div className="text-3xl mb-2">📄</div>
            <div className="font-semibold mb-1">Choose a CSV file</div>
            <div className="text-sm text-ink-400 mb-4">
              Expected columns: First Name, Last Name, Phone, Email, Guardian, Therapist, Service, Days, Start Date
            </div>
            <input type="file" accept=".csv,.txt" onChange={handleFile}
              className="text-sm text-ink-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
          </div>
          <div className="text-xs text-ink-400">
            <strong>Days format:</strong> Comma-separated day names like <code>Mon, Thu</code> or <code>Monday, Wednesday, Friday</code>
            <br />
            <strong>Therapist & Service:</strong> Must match names you set up in Setup. Partial matches work (e.g. &quot;Sarah&quot; matches &quot;Sarah Miller&quot;).
          </div>
        </div>
      )}

      {step === "preview" && (
        <div>
          {errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm">
              <div className="font-semibold text-amber-700 mb-1">Warnings ({errors.length})</div>
              {errors.map((e, i) => <div key={i} className="text-amber-600 text-xs">{e}</div>)}
            </div>
          )}
          <div className="text-sm mb-3">
            <span className="font-semibold text-brand-600">{parsed.length}</span> clients ready to import:
          </div>
          <div className="max-h-64 overflow-auto border border-surface-200 rounded-lg mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50">
                  <th className="table-header">Name</th>
                  <th className="table-header">Guardian</th>
                  <th className="table-header">Phone</th>
                  <th className="table-header">Days</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((r, i) => (
                  <tr key={i} className="table-row">
                    <td className="table-cell font-semibold">{r.first_name} {r.last_name}</td>
                    <td className="table-cell text-ink-500">{r.guardian || "\u2014"}</td>
                    <td className="table-cell text-ink-500">{r.phone || "\u2014"}</td>
                    <td className="table-cell text-sm">{r.session_days?.length > 0 ? r.session_days.map((d: number) => DAYS[d]).join(", ") : "\u2014"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button onClick={doImport} disabled={importing || parsed.length === 0} className="btn-primary btn-sm">
              {importing ? "Importing..." : `Import ${parsed.length} Clients`}
            </button>
            <button onClick={() => { setStep("upload"); setParsed([]); setErrors([]); }} className="btn-ghost btn-sm">Back</button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="text-center py-6">
          <div className="text-3xl mb-2">✅</div>
          <div className="font-semibold text-lg mb-1">Import Complete</div>
          <div className="text-sm text-ink-500 mb-4">{importCount} clients added successfully.</div>
          <button onClick={onDone} className="btn-primary btn-sm">Done</button>
        </div>
      )}
    </div>
  );
}
