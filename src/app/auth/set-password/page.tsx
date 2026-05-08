"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateErr) {
      setError(updateErr.message);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-surface-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-bold text-xl mx-auto mb-4">
            TT
          </div>
          <h1 className="text-2xl font-bold text-ink-900">Set Your Password</h1>
          <p className="text-sm text-ink-400 mt-1">Choose a strong password to secure your account.</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">New Password</label>
              <input
                className="input-field"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 12 characters"
                autoFocus
              />
              <div className="mt-1.5 flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      password.length === 0
                        ? "bg-surface-200"
                        : password.length < 8
                        ? i === 1 ? "bg-red-400" : "bg-surface-200"
                        : password.length < 12
                        ? i <= 2 ? "bg-amber-400" : "bg-surface-200"
                        : password.length < 16
                        ? i <= 3 ? "bg-emerald-400" : "bg-surface-200"
                        : "bg-emerald-500"
                    }`}
                  />
                ))}
              </div>
              <div className="text-xs text-ink-400 mt-1">
                {password.length === 0 ? "Minimum 12 characters"
                  : password.length < 8 ? "Too short"
                  : password.length < 12 ? "Almost there"
                  : password.length < 16 ? "Good"
                  : "Strong"}
              </div>
            </div>

            <div>
              <label className="label">Confirm Password</label>
              <input
                className="input-field"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat your password"
              />
              {confirm.length > 0 && (
                <div className={`text-xs mt-1 ${password === confirm ? "text-emerald-600" : "text-red-500"}`}>
                  {password === confirm ? "✓ Passwords match" : "✗ Passwords do not match"}
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || password.length < 12 || password !== confirm}
              className="btn-primary w-full"
            >
              {loading ? "Saving..." : "Set Password & Continue"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
