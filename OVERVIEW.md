# Therapy Tracker — What We're Building

*A plain-English overview of the app, what it does today, how it's protected, and where it's going.*

---

## What Is This App?

Therapy Tracker is a custom-built software system for running an occupational therapy clinic. It replaces paper logs, spreadsheets, and manual billing.

The goal is simple: every part of running the clinic — scheduling, attendance, charges, payments, and client records — lives in one place, accessible from any computer, with everything automatically connected. When a session is marked attended, the charge is created. When a payment comes in, the balance updates. When it's billing time, statements are ready to print or send.

It was built from scratch specifically for this clinic, so it works exactly the way the clinic works — including being closed on Shabbos.

---

## What the App Does Right Now

### Client Records
Every client has a full profile in the system. You can store:
- Name, guardian name, phone, email, and home address
- Which therapist they see and what type of service they receive
- Which days of the week they come in
- Their start date and any general notes
- Custom pricing if their rate is different from the standard rate
- Uploaded documents — evaluations, insurance forms, consent paperwork — all stored securely in the cloud
- Clinical notes organized by category (Session notes, Evaluations, Billing, Insurance, etc.)

You can add clients one by one, or import a whole list from a spreadsheet at once.

---

### Scheduling
The system can automatically generate a client's full schedule — for example, every Monday and Wednesday at 10am from September through June — in one click. It's smart enough to:
- Skip days that are already booked
- Skip days the therapist isn't working
- Warn you if there's a conflict
- Tell you exactly which dates it skipped and why

You can also book individual one-off sessions with a live view of what times are available.

---

### Daily Check-In
Every morning, you open the check-in page and see the full schedule for the day, grouped by therapist. As sessions happen, you mark each one:

- **Attended** — session happened, charge is created automatically
- **Late Cancel** — client cancelled late, cancellation fee is applied automatically
- **No-Show** — client didn't come, no-show fee is applied automatically
- **Cancelled** — no charge

The status buttons update instantly — you don't have to wait or refresh. If you make a mistake and change a status, the charge updates automatically too.

---

### Payments
When a family pays — by cash, check, card, or insurance — you record it in the system. The balance for that client updates immediately. You can see:
- Every payment made, searchable by client and filtered by month
- Which clients currently owe money, sorted from highest balance to lowest
- A running balance on every client's profile

---

### Monthly Billing Statements
At the end of every month, you can pull up a billing statement for any client (or all clients at once) that shows:
- Their previous balance
- Every charge from the month, itemized by date and service
- Every payment received
- Their final balance due

These statements are formatted cleanly and ready to print and mail, or (coming soon) email directly to families.

---

### Calendar View
A full month-view calendar showing every session, color-coded by therapist. You can click any day to see the sessions for that day and mark attendance directly from the calendar — useful for reviewing a past week or planning ahead.

---

### Setup & Configuration
The clinic owner can manage:
- **Therapists** — names, contact info, calendar colors, and individual work schedules (which days they work and what hours)
- **Service types** — the different kinds of sessions offered, with durations and standard rates
- **Default fees** — the standard late-cancel and no-show fee amounts, which can be overridden per client

---

## How Is the Data Protected?

Here's where things stand today and where they're going:

### What's Already in Place
- All data is stored in **Supabase**, a professional cloud database used by thousands of businesses. It's not stored on a personal computer or a shared drive — it lives in a secure, managed cloud environment with automatic backups.
- The app is built on **Next.js**, a framework used by major companies including TikTok, Twitch, and Hulu.
- Every time data is saved — a payment recorded, a session updated, a client edited — it goes through a **validation layer** that checks the data is complete and correct before it touches the database. Bad or incomplete data gets rejected automatically.
- If any part of the app runs into an error, it catches it gracefully and shows a "Try again" message instead of crashing.
- The app is closed on Shabbos — no data is being accessed or changed during that time.

### What We're Adding Next (Security)

**Login system** — Right now, anyone who knows the web address can access the app. The very next step is adding a full login system — username and password required to enter. Once this is in, the app is locked to authorized staff only.

**Database-level access rules** — After login is set up, we'll add rules directly inside the database that say: even if someone somehow got the technical credentials, they still can't read or change anything unless they're a logged-in user. This is a second lock on top of the password.

**Role-based access** — Not everyone needs to see everything. We're building a permission system with different roles:
- **Admin** — full access to everything
- **Therapist** — can see and manage their own clients and sessions
- **Billing staff** — can handle payments and statements but not clinical records
- **Read-only** — can view but not change anything

**Private file storage** — Client documents are currently stored in a way that generates a shareable link. We're switching this so documents require a logged-in session to access, and links expire after 60 seconds.

**Change history** — We're adding a log of every change made in the system — who changed what and when. If a charge gets deleted or a record gets edited, there will be a full history. Nothing will be permanently lost.

---

## Features Coming Soon

These are planned and partially built — they're next in line after the security layer is complete.

**Email billing statements** — Instead of printing and mailing, click one button to email the monthly statement directly to the family. The statement arrives formatted exactly like the printed version.

**Payment receipts** — When a payment is recorded, generate and email a receipt to the family instantly.

**Account ledger per client** — A full running transaction history for each client — every charge and every payment in date order, with a running balance — like a bank statement. This will live on the client's profile page.

**Attendance reports** — Summary reports showing attendance rates per client, no-show trends, and monthly revenue comparisons. All the data already exists — this just surfaces it in a useful format.

**"Edit all future sessions"** — Right now, if a client's schedule changes, you have to update each session one by one. We're adding a way to change a client's recurring schedule and have all future sessions update automatically.

**Undo / recovery** — Currently, if something is deleted it's gone. We're adding soft deletes — deleted items go to a "recently deleted" state for 30 days before being permanently removed, so mistakes can be undone.

**Insurance billing** — Tracking insurance claims, expected reimbursements, and copay splits. Useful for clients whose sessions are partially or fully covered by insurance.

---

## The Big Picture

When everything is complete, this system will handle the full lifecycle of a client at the clinic:

> **Intake → Scheduling → Attendance → Billing → Payment → Statements → Discharge**

All in one place, accessible from any computer, with proper security, backup, and a complete history of every interaction with every client.

The foundation is built. The hard engineering work — shared data layer, server-side validation, optimistic UI, error handling — is already done. What's left is adding the security layer and building out the remaining features on top of a solid base.

---

*Built for a real OT clinic. Designed to last.*
