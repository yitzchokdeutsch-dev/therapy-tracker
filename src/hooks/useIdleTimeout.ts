import { useEffect, useRef, useCallback } from "react";

const EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];

export function useIdleTimeout(onTimeout: () => void, onWarning: () => void, {
  timeoutMs = 15 * 60 * 1000,   // 15 minutes
  warningMs = 2 * 60 * 1000,    // warn 2 minutes before timeout
} = {}) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    warningRef.current = setTimeout(onWarning, timeoutMs - warningMs);
    timeoutRef.current = setTimeout(onTimeout, timeoutMs);
  }, [onTimeout, onWarning, timeoutMs, warningMs]);

  useEffect(() => {
    reset();
    EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [reset]);
}
