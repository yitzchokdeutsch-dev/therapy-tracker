"use client";

import { useState, useEffect, useCallback } from "react";
import { listUsers, setUserRole, type UserRow } from "@/app/actions/admin";
import { useTherapists } from "@/hooks";
import { ROLE_LABELS, ROLE_COLORS, type Role } from "@/lib/permissions";

const ROLES: Role[] = ["admin", "secretary", "therapist", "billing", "readonly"];

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  const { data: therapists = [] } = useTherapists();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (e: any) {
      setError(e.message ?? "Failed to load users");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRoleChange = async (userId: string, role: Role, therapistId: string | null) => {
    setSaving(userId);
    try {
      await setUserRole(userId, role, role === "therapist" ? therapistId : null);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role, therapistId: role === "therapist" ? therapistId : null } : u));
    } catch (e: any) {
      setError(e.message ?? "Failed to save");
    }
    setSaving(null);
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Admin — User Roles</h1>
          <p className="text-sm text-ink-400 mt-1">Control which pages each user can access.</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-ghost btn-sm">
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      <div className="card overflow-hidden mb-6">
        <div className="px-5 py-3 bg-surface-50 border-b border-surface-200">
          <div className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Role permissions</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200">
                <th className="table-header">Page</th>
                <th className="table-header text-center">Admin</th>
                <th className="table-header text-center">Therapist</th>
                <th className="table-header text-center">Billing</th>
                <th className="table-header text-center">Read Only</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Dashboard",  href: "/" },
                { label: "Clients",    href: "/clients" },
                { label: "Scheduling", href: "/scheduling" },
                { label: "Check-In",   href: "/checkin" },
                { label: "Calendar",   href: "/calendar" },
                { label: "Payments",   href: "/payments" },
                { label: "Billing",    href: "/billing" },
                { label: "Setup",      href: "/setup" },
                { label: "Admin",      href: "/admin" },
              ].map(({ label, href }) => {
                const allowed = ([] as Role[]).concat(
                  href === "/" ? ["admin","therapist","billing","readonly"] :
                  href === "/clients" ? ["admin","therapist","billing","readonly"] :
                  href === "/scheduling" ? ["admin","therapist"] :
                  href === "/checkin" ? ["admin","therapist"] :
                  href === "/calendar" ? ["admin","therapist","billing","readonly"] :
                  href === "/payments" ? ["admin","billing"] :
                  href === "/billing" ? ["admin","billing"] :
                  href === "/setup" ? ["admin"] :
                  ["admin"]
                ) as Role[];
                return (
                  <tr key={href} className="table-row">
                    <td className="table-cell font-medium">{label}</td>
                    {(["admin","therapist","billing","readonly"] as Role[]).map((r) => (
                      <td key={r} className="table-cell text-center">
                        {allowed.includes(r) ? (
                          <span className="text-emerald-500 text-base">✓</span>
                        ) : (
                          <span className="text-surface-300 text-base">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-3 bg-surface-50 border-b border-surface-200 flex items-center justify-between">
          <div className="text-xs font-semibold text-ink-500 uppercase tracking-wide">
            Users ({users.length})
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-ink-400 text-sm">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-ink-400 text-sm">No users found.</div>
        ) : (
          <div className="divide-y divide-surface-200">
            {users.map((u) => (
              <div key={u.id} className="px-5 py-4 flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <div className="font-medium text-sm">{u.email}</div>
                  <div className="text-xs text-ink-400 mt-0.5">
                    {u.lastSignIn
                      ? `Last sign-in: ${new Date(u.lastSignIn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                      : "Never signed in"}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Role selector */}
                  <div className="flex gap-1.5 flex-wrap">
                    {ROLES.map((r) => (
                      <button
                        key={r}
                        onClick={() => handleRoleChange(u.id, r, u.therapistId)}
                        disabled={saving === u.id}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          u.role === r
                            ? ROLE_COLORS[r] + " border-transparent"
                            : "bg-white text-ink-400 border-surface-300 hover:border-ink-300"
                        }`}
                      >
                        {ROLE_LABELS[r]}
                      </button>
                    ))}
                  </div>

                  {/* Therapist selector (only when role = therapist) */}
                  {u.role === "therapist" && (
                    <select
                      className="input-field py-1 text-sm w-40"
                      value={u.therapistId ?? ""}
                      onChange={(e) => handleRoleChange(u.id, "therapist", e.target.value || null)}
                      disabled={saving === u.id}
                    >
                      <option value="">— link therapist —</option>
                      {therapists.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  )}

                  {saving === u.id && (
                    <span className="text-xs text-ink-400">Saving...</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
