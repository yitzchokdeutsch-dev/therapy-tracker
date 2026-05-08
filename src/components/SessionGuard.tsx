"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { signOut } from "@/app/actions/auth";

const WARNING_SECONDS = 120;

export default function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_SECONDS);
  const [, startTransition] = useTransition();
  const countdownRef = { current: null as ReturnType<typeof setInterval> | null };

  const handleTimeout = useCallback(async () => {
    setShowWarning(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
    await signOut();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleWarning = useCallback(() => {
    setShowWarning(true);
    setCountdown(WARNING_SECONDS);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const staySignedIn = useCallback(() => {
    setShowWarning(false);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(WARNING_SECONDS);
    // Ping Supabase to keep session alive
    startTransition(async () => {
      const { createClient } = await import("@/lib/supabase/browser");
      await createClient().auth.getSession();
    });
  }, [startTransition]); // eslint-disable-line react-hooks/exhaustive-deps

  useIdleTimeout(handleTimeout, handleWarning);

  return (
    <>
      {children}

      {showWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
            <div className="text-4xl mb-4">⏱</div>
            <h2 className="text-xl font-bold text-ink-900 mb-2">Still there?</h2>
            <p className="text-ink-500 text-sm mb-2">
              You&apos;ve been inactive for a while. For security, you&apos;ll be signed out automatically.
            </p>
            <p className="text-3xl font-bold text-red-600 mb-6 tabular-nums">
              {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleTimeout()} className="btn-ghost flex-1 text-ink-500">
                Sign Out
              </button>
              <button onClick={staySignedIn} className="btn-primary flex-1">
                Stay Signed In
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
