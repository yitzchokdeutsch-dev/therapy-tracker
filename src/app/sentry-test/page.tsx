"use client";

import * as Sentry from "@sentry/nextjs";

export default function SentryTestPage() {
  return (
    <div className="max-w-sm mx-auto mt-20 card p-8 text-center space-y-4">
      <h1 className="text-xl font-bold">Sentry Test</h1>
      <p className="text-sm text-ink-400">
        Click a button, then check your Sentry dashboard for the event.
      </p>

      <button
        className="btn-primary w-full"
        onClick={() => {
          throw new Error("Sentry test — frontend crash");
        }}
      >
        Throw frontend error
      </button>

      <button
        className="btn-outline w-full"
        onClick={() => {
          Sentry.captureMessage("Sentry test — manual message", "info");
          alert("Message sent to Sentry. Check your dashboard.");
        }}
      >
        Send manual message
      </button>
    </div>
  );
}
