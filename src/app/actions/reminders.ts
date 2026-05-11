"use server";

import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.RESEND_FROM_EMAIL ?? "Therapy Tracker <onboarding@resend.dev>";

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function formatTime12(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${((h % 12) || 12)}:${String(m).padStart(2, "0")} ${ampm}`;
}

export type ReminderResult = {
  sent: number;
  skipped: number;
  errors: string[];
};

export async function sendTomorrowReminders(): Promise<ReminderResult> {
  const supabase = createClient();
  const tomorrow = tomorrowStr();

  // Load clinic name for email subject
  const { data: settings } = await supabase.from("settings").select("key, value");
  const getSetting = (key: string) => settings?.find((s) => s.key === key)?.value ?? "";
  const clinicName = getSetting("clinic_name") || "Your Therapy Clinic";

  // All sessions tomorrow
  const { data: sessions } = await supabase
    .from("sessions").select("*")
    .eq("session_date", tomorrow)
    .not("status", "in", '("cancelled","rescheduled")')
    .is("deleted_at", null);

  if (!sessions?.length) return { sent: 0, skipped: 0, errors: [] };

  // Already sent reminders
  const { data: alreadySent } = await supabase
    .from("reminder_log")
    .select("session_id")
    .in("session_id", sessions.map((s) => s.id))
    .eq("method", "email");

  const sentSet = new Set((alreadySent ?? []).map((r) => r.session_id));

  // Load supporting data
  const clientIds    = Array.from(new Set(sessions.map((s) => s.client_id)));
  const therapistIds = Array.from(new Set(sessions.map((s) => s.therapist_id)));

  const [{ data: clients }, { data: therapists }] = await Promise.all([
    supabase.from("clients").select("id, first_name, last_name, guardian, email, phone").in("id", clientIds),
    supabase.from("therapists").select("id, name").in("id", therapistIds),
  ]);

  const clientMap    = Object.fromEntries((clients    ?? []).map((c) => [c.id, c]));
  const therapistMap = Object.fromEntries((therapists ?? []).map((t) => [t.id, t]));

  const tomorrowFormatted = new Date(tomorrow + "T12:00:00")
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  let sent = 0, skipped = 0;
  const errors: string[] = [];

  for (const session of sessions) {
    if (sentSet.has(session.id)) { skipped++; continue; }

    const client    = clientMap[session.client_id];
    const therapist = therapistMap[session.therapist_id];
    if (!client) { skipped++; continue; }

    const recipientEmail = client.email;
    const recipientName  = client.guardian || `${client.first_name} ${client.last_name}`;

    if (!recipientEmail) { skipped++; continue; }

    const html = `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#111">
        <h2 style="color:#2563eb;margin-bottom:4px">${clinicName}</h2>
        <p style="color:#666;margin-top:0">Appointment Reminder</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0"/>
        <p>Hi ${recipientName},</p>
        <p>This is a reminder that <strong>${client.first_name} ${client.last_name}</strong>
           has an appointment tomorrow:</p>
        <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0">
          <div style="margin-bottom:8px">📅 <strong>${tomorrowFormatted}</strong></div>
          ${session.session_time ? `<div style="margin-bottom:8px">🕐 <strong>${formatTime12(session.session_time)}</strong></div>` : ""}
          ${therapist ? `<div>👤 <strong>${therapist.name}</strong></div>` : ""}
        </div>
        <p style="color:#666;font-size:14px">
          Please contact us as soon as possible if you need to cancel or reschedule.
        </p>
        <p style="color:#666;font-size:14px">Thank you!</p>
      </div>
    `;

    try {
      const { error } = await resend.emails.send({
        from:    FROM,
        to:      recipientEmail,
        subject: `Reminder: ${client.first_name}'s appointment tomorrow — ${clinicName}`,
        html,
      });

      if (error) {
        errors.push(`${client.first_name} ${client.last_name}: ${error.message}`);
      } else {
        await supabase.from("reminder_log").insert({ session_id: session.id, method: "email" });
        sent++;
      }
    } catch (e: any) {
      errors.push(`${client.first_name} ${client.last_name}: ${e.message}`);
    }
  }

  return { sent, skipped, errors };
}
