"use client";

import { useState } from "react";
import { signIn, verifyMfaCode } from "@/app/actions/auth";
import { useRouter } from "next/navigation";

type Step = "credentials" | "mfa";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn(email, password);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    // Check if MFA is required
    const res = await fetch("/api/auth/mfa-status");
    const status = await res.json();

    if (status.nextLevel === "aal2" && status.hasMfaEnrolled) {
      setStep("mfa");
    } else {
      router.push("/");
      router.refresh();
    }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await verifyMfaCode(mfaCode);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      setMfaCode("");
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
          <h1 className="text-2xl font-bold text-ink-900">Therapy Tracker</h1>
          <p className="text-sm text-ink-400 mt-1">OT Clinic Manager</p>
        </div>

        <div className="card p-6">
          {step === "credentials" ? (
            <>
              <h2 className="font-semibold text-ink-900 mb-5">Sign in to your account</h2>
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="label">Email</label>
                  <input
                    className="input-field"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@clinic.com"
                  />
                </div>
                <div>
                  <label className="label">Password</label>
                  <input
                    className="input-field"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="font-semibold text-ink-900 mb-1">Two-factor verification</h2>
              <p className="text-sm text-ink-400 mb-5">
                Enter the 6-digit code from your authenticator app.
              </p>
              <form onSubmit={handleMfa} className="space-y-4">
                <div>
                  <label className="label">Verification Code</label>
                  <input
                    className="input-field text-center text-2xl tracking-widest font-mono"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    autoComplete="one-time-code"
                    required
                    autoFocus
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || mfaCode.length !== 6}
                  className="btn-primary w-full"
                >
                  {loading ? "Verifying..." : "Verify"}
                </button>

                <button
                  type="button"
                  onClick={() => { setStep("credentials"); setError(""); setMfaCode(""); }}
                  className="btn-ghost w-full text-sm"
                >
                  Back to sign in
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
