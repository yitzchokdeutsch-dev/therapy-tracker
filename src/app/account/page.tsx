"use client";

import { useState, useEffect } from "react";
import { enrollMfa, unenrollMfa } from "@/app/actions/auth";
import Image from "next/image";

interface MfaFactor { id: string; friendly_name?: string; }
interface MfaStatus {
  currentLevel: string;
  nextLevel: string;
  hasMfaEnrolled: boolean;
  factors: MfaFactor[];
}

export default function AccountPage() {
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [qrData, setQrData] = useState<{ qrCode: string; secret: string; factorId: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadStatus = async () => {
    const res = await fetch("/api/auth/mfa-status");
    const data = await res.json();
    setMfaStatus(data);
  };

  useEffect(() => { loadStatus(); }, []);

  const startEnroll = async () => {
    setLoading(true);
    const result = await enrollMfa();
    setLoading(false);
    if (result.error || !result.data) { setVerifyError(result.error ?? "Failed to start enrollment"); return; }
    setQrData({
      qrCode: result.data.totp.qr_code,
      secret: result.data.totp.secret,
      factorId: result.data.id,
    });
    setEnrolling(true);
  };

  const confirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrData) return;
    setLoading(true);
    setVerifyError("");

    // Verify the code against the pending factor
    const { createClient } = await import("@/lib/supabase/browser");
    const supabase = createClient();
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: qrData.factorId });
    if (cErr) { setVerifyError(cErr.message); setLoading(false); return; }

    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: qrData.factorId,
      challengeId: challenge.id,
      code: verifyCode,
    });
    setLoading(false);
    if (vErr) { setVerifyError("Invalid code — try again"); setVerifyCode(""); return; }

    setEnrolling(false);
    setQrData(null);
    setVerifyCode("");
    await loadStatus();
  };

  const handleUnenroll = async (factorId: string) => {
    if (!confirm("Remove MFA from your account? You will only need your password to sign in.")) return;
    await unenrollMfa(factorId);
    await loadStatus();
  };

  if (!mfaStatus) return <div className="text-ink-400 py-12 text-center">Loading...</div>;

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Account Security</h1>

      <div className="card p-5">
        <h2 className="font-semibold mb-1">Two-Factor Authentication (MFA)</h2>
        <p className="text-sm text-ink-400 mb-4">
          Adds a second layer of protection. After entering your password, you&apos;ll need a 6-digit code from your authenticator app.
        </p>

        {!mfaStatus.hasMfaEnrolled && !enrolling && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <span>⚠</span> MFA is not enabled on your account.
            </div>
            <button onClick={startEnroll} disabled={loading} className="btn-primary">
              {loading ? "Setting up..." : "Enable MFA"}
            </button>
          </div>
        )}

        {enrolling && qrData && (
          <div className="space-y-4">
            <p className="text-sm text-ink-600">
              Scan this QR code with <strong>Google Authenticator</strong>, <strong>Authy</strong>, or any TOTP app.
            </p>
            <div className="flex justify-center bg-white border border-surface-200 rounded-xl p-4">
              <Image src={qrData.qrCode} alt="MFA QR Code" width={180} height={180} unoptimized />
            </div>
            <div className="bg-surface-50 rounded-lg p-3">
              <div className="text-xs text-ink-400 mb-1">Manual entry key</div>
              <div className="font-mono text-sm break-all">{qrData.secret}</div>
            </div>
            <form onSubmit={confirmEnroll} className="space-y-3">
              <div>
                <label className="label">Enter the 6-digit code to confirm</label>
                <input
                  className="input-field text-center text-2xl tracking-widest font-mono"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoFocus
                  required
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                />
              </div>
              {verifyError && <div className="text-sm text-red-600">{verifyError}</div>}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setEnrolling(false); setQrData(null); }} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={loading || verifyCode.length !== 6} className="btn-primary flex-1">
                  {loading ? "Verifying..." : "Confirm & Enable"}
                </button>
              </div>
            </form>
          </div>
        )}

        {mfaStatus.hasMfaEnrolled && !enrolling && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <span>✓</span> MFA is active on your account.
            </div>
            {mfaStatus.factors.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-2 border-b border-surface-200">
                <div>
                  <div className="text-sm font-medium">{f.friendly_name || "Authenticator App"}</div>
                  <div className="text-xs text-ink-400">TOTP</div>
                </div>
                <button onClick={() => handleUnenroll(f.id)} className="btn-ghost btn-sm text-red-500">Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
