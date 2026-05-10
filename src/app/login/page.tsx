"use client";

import { useState } from "react";
import { signIn, verifyMfaCode } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/browser";
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
  const [googleLoading, setGoogleLoading] = useState(false);

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

  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
    }
    // On success, browser is redirected — no need to setGoogleLoading(false)
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

              {/* Google OAuth */}
              <button
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-surface-300 bg-white text-sm font-semibold text-ink-700 hover:bg-surface-50 hover:border-ink-300 transition-colors disabled:opacity-50 mb-4"
              >
                {googleLoading ? (
                  <span className="text-ink-400">Redirecting...</span>
                ) : (
                  <>
                    <GoogleIcon />
                    Continue with Google
                  </>
                )}
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-surface-200" />
                <span className="text-xs text-ink-400">or</span>
                <div className="flex-1 h-px bg-surface-200" />
              </div>

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
                  disabled={loading || googleLoading}
                  className="btn-primary w-full"
                >
                  {loading ? "Signing in..." : "Sign In with Email"}
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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
