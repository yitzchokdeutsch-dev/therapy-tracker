# Therapy Tracker — OT Clinic Manager

A full-featured practice management app for occupational therapy clinics. Handles client records, session scheduling, daily check-in, billing, and payment tracking — all in one place.

---

## Table of Contents

1. [Core Features](#core-features)
2. [Tech Stack](#tech-stack)
3. [Architecture](#architecture)
4. [Steps Going Forward](#steps-going-forward)
5. [Security Checklist](#security-checklist)
6. [Known Bugs](#known-bugs)

---

## Core Features

### Daily Check-In
The primary daily workflow. Open each morning, see every session for the day grouped by therapist, and mark attendance as it happens.

- One-click status: **Attended / Late Cancel / No-Show / Cancelled** — clicking the active status toggles back to Scheduled
- **Optimistic updates** — the UI flips immediately; the server action confirms in the background and rolls back if it fails
- Charges are created automatically on status change (old charge is deleted first, so toggling is always safe)
- Progress bar showing checked-in vs. remaining
- Add walk-in or makeup sessions, edit session details, delete sessions — all from this page
- Date navigation with arrows or a date picker

### Calendar
Month-view grid for planning and quick check-ins without navigating to the daily page.

- Color-coded session dots per therapist
- Click any day to open a detail panel with all sessions for that day
- Quick check-in buttons in the panel — same status buttons as the check-in page
- Edit session modal with full field access
- Navigate months; jump to today

### Scheduling
Generates sessions from a client's recurring schedule, or books one-offs.

- **Recurring**: Pick client, therapist, service, days of week with specific times, and a date range. The scheduler skips dates where the client already has a session, skips dates the therapist does not work, validates that times fall within therapist hours, detects conflicts with existing bookings, and reports every skip with a reason.
- **One-time**: Live available-slot picker based on therapist schedule and existing bookings for that day.

### Clients
Full client directory and profile management.

- Search by name or guardian
- Per-client rate overrides for session rate, late-cancel fee, and no-show fee (falls back to global defaults)
- Active/inactive toggle — inactive clients are hidden from scheduling and check-in
- CSV bulk import with column matching, preview step, and per-row error reporting
- Running balance shown per client in the list

### Client Profile
Everything about one client in one place.

- Balance at a glance with full charge/payment breakdown available
- Therapist, service type, schedule, and start date summary
- **Notes tab** — CRUD notes categorized as General, Evaluation, Session, Billing, Insurance, or Other
- **Files tab** — Upload documents to Supabase Storage; categorize and download; currently using public URLs (see security section)

### Payments
Record and track all incoming payments.

- Client dropdown shows current balance inline
- Balance-due alert when a client with an outstanding balance is selected
- Payment history filtered by month at the database level (no over-fetching)
- Record: amount, date, method (Cash / Check / Card / Insurance / Other), reference number, notes
- Outstanding balances sidebar sorted highest-first; click a client to pre-fill the form
- Server-side Zod validation on every payment before it hits the database
- Inline error message displayed if the save fails

### Billing
Printable monthly statements.

- Previous balance + itemized charges + payments received + final balance due
- Only shows clients with activity for the selected month
- Print-optimized layout: sidebar hides, page breaks between statements
- Summary stats: total clients billed, total charged, total received, total outstanding

### Setup
Clinic configuration.

- **Therapists** — name, email, phone, calendar color; per-day work schedule with start and end times; activate/deactivate
- **Service Types** — name, duration, default rate; activate/deactivate
- **Fees** — global late-cancel and no-show default amounts (saved on blur)

### Dashboard
At-a-glance overview for the day.

- Today's sessions with therapist color coding and status badges
- Active client count
- Total outstanding balance with a ranked list
- Monthly payments received vs. charges billed

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database & Storage | Supabase (Postgres + Storage) |
| Styling | Tailwind CSS + custom component classes |
| Data fetching | @tanstack/react-query (stale-while-revalidate) |
| Validation | Zod (server-side, in every mutation action) |
| Hosting | Deploy to Vercel |

---

## Architecture

### Layer Map

```
Browser
  └─ React components ("use client")
       └─ Query hooks (src/hooks/index.ts)     ← reads, cached by React Query
       └─ Mutation hooks (src/hooks/mutations.ts) ← writes, optimistic updates
            └─ Server Actions (src/app/actions/) ← "use server", Zod validates here
                 └─ Service layer (src/services/) ← plain async DB functions
                      └─ Supabase client
```

### Key Files

```
src/
  lib/
    types.ts        All TypeScript interfaces — single source of truth
    schemas.ts      Zod schemas + inferred types for every mutation
    utils.ts        fmt, formatTime, toDateStr, DAYS, STATUS_BADGE, etc.
    fees.ts         getSessionRate / getLateCancelFee / getNoShowFee
    permissions.ts  Role definitions, can() checker, MOCK_USER stub
    supabase.ts     Supabase browser client
    queryClient.ts  React Query client (30s stale time)

  services/
    sessions.ts     dbCreateSession, dbUpdateSession, dbUpdateSessionStatus, dbDeleteSession
    payments.ts     dbRecordPayment, dbDeletePayment

  app/
    actions/
      sessions.ts   Server actions — parse with Zod, call service functions
      payments.ts   Server actions — parse with Zod, call service functions

  hooks/
    index.ts        useQuery hooks: useClients, useSessions, useBalances, etc.
    mutations.ts    useMutation hooks: useUpdateSessionStatus (optimistic),
                    useCreateSession, useUpdateSession, useDeleteSession,
                    useRecordPayment, useDeletePayment

  components/
    Modal.tsx         Reusable modal overlay
    Skeleton.tsx      SkeletonCard, SkeletonCheckinCard, SkeletonStatCards, etc.
    ErrorBoundary.tsx React class boundary — shows "Try again" on render errors
    Providers.tsx     QueryClientProvider + ErrorBoundary wrapper
    Sidebar.tsx       Navigation

  supabase/
    migrations/
      001_client_balances_view.sql  SQL view: balance per client computed in Postgres
```

### Optimistic Updates

The check-in status buttons use `onMutate` to flip the session status in the React Query cache before the server responds. If the server action throws, `onError` rolls back to the previous cache snapshot. The UI never blocks on the network for a status toggle.

### Balance Calculation

`useBalances` queries the `client_balances` view (a Postgres correlated subquery per client) instead of fetching all charges and payments and reducing them in JavaScript. Run `supabase/migrations/001_client_balances_view.sql` in the Supabase SQL editor to enable this. Without it the hook falls back to the client-side calculation automatically.

---

## Steps Going Forward

These are ordered by impact and dependency. Do them in sequence.

---

### Step 1 — Add Authentication (Required before any real patient data)

Right now anyone with the URL has full access. Add Supabase Auth before this app holds real records.

**1a. Enable Supabase Auth** in the Supabase dashboard → Authentication → Email provider.

**1b. Create a login page** at `src/app/login/page.tsx` using `supabase.auth.signInWithPassword()`.

**1c. Add Next.js middleware** to protect every route:

```ts
// src/middleware.ts
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session && !req.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return res;
}

export const config = { matcher: ["/((?!_next|favicon).*)"] };
```

**1d. Add a sign-out button** in the Sidebar.

**1e. Switch server actions** to use a server-side Supabase client with the service role key instead of the anon key:

```ts
// src/lib/supabase-server.ts
import { createClient } from "@supabase/supabase-js";
export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // never NEXT_PUBLIC_
);
```

---

### Step 2 — Enable Row Level Security

Without RLS, anyone with the anon key (visible in the browser bundle) can query your database directly. Enable it on every table after auth is wired.

```sql
-- Run for each table: clients, therapists, service_types, sessions,
-- charges, payments, fees, therapist_schedules, client_notes, client_files

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read"  ON clients FOR SELECT  USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_write" ON clients FOR INSERT  WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "authenticated_update" ON clients FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "authenticated_delete" ON clients FOR DELETE USING (auth.role() = 'authenticated');
```

Also enable RLS on the `client-files` Storage bucket and switch file URLs from `getPublicUrl()` to `createSignedUrl(path, 60)`.

---

### Step 3 — Wire Up Role-Based Access Control

The RBAC layer is already built in `src/lib/permissions.ts` with roles `admin`, `therapist`, `billing`, and `readonly`. The `MOCK_USER` constant currently grants everyone admin access.

**3a.** Create a `user_roles` table in Supabase:
```sql
create table user_roles (
  user_id uuid references auth.users primary key,
  role text not null default 'readonly',
  therapist_id uuid references therapists
);
```

**3b.** Replace `MOCK_USER` with a real lookup:
```ts
// src/hooks/useCurrentUser.ts
export function useCurrentUser() {
  return useQuery({
    queryKey: ["current_user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: role } = await supabase
        .from("user_roles").select("*").eq("user_id", user!.id).single();
      return role as UserContext;
    },
  });
}
```

**3c.** Gate actions in the UI using `can(user, "canDeleteSessions")` etc., and enforce the same rules in RLS policies server-side.

---

### Step 4 — Run the Balance View Migration

If you haven't already, run this in the Supabase SQL editor. It moves balance calculation from JavaScript into Postgres, which is faster and stays correct as the dataset grows.

```
supabase/migrations/001_client_balances_view.sql
```

---

### Step 5 — Add Monitoring / Error Tracking

The `ErrorBoundary` already has a Sentry drop-in comment. Add it:

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

Then in `ErrorBoundary.tsx`, uncomment:
```ts
Sentry.captureException(error, { extra: info });
```

Add Sentry's `withSentryConfig` wrapper in `next.config.js` and set `SENTRY_DSN` in your environment variables.

---

### Step 6 — Soft Deletes + Audit Log

Currently deleting a session, charge, or payment is permanent. Add recovery:

**6a.** Add `deleted_at timestamptz` to `sessions`, `charges`, `payments`. Filter `where deleted_at is null` in all queries. Update `dbDeleteSession` etc. to set `deleted_at` instead of calling `.delete()`.

**6b.** Add an audit log table:
```sql
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  table_name text,
  record_id uuid,
  action text,  -- 'insert' | 'update' | 'delete'
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz default now()
);
```

Wire it via a Postgres trigger or log writes explicitly in the service functions.

---

### Step 7 — Recurring Session Management

Sessions have no link to the schedule that created them. If a client's days change you have to manually delete and recreate. Fix:

**7a.** Add `schedule_run_id uuid` to the `sessions` table.

**7b.** When generating recurring sessions, assign a shared UUID to the batch.

**7c.** Add "Edit all future" and "Delete all future" options to the edit modal that filter by `schedule_run_id` and `session_date >= today`.

---

### Step 8 — Balance History / Ledger Tab

Add a **Ledger** tab to the client profile showing all charges and payments in date order with a running total — the single most useful billing view that's missing.

```ts
// Query: all charges + all payments for a client, union, sorted by date
const { data } = await supabase.rpc("client_ledger", { p_client_id: clientId });
```

---

### Step 9 — Reports Page

All the data exists. Surface it:

- Attendance rate per client (sessions attended / total sessions)
- No-show and late-cancel trends by month
- Revenue by therapist
- Monthly comparison chart (charged vs. collected)

Use Recharts (already in the React ecosystem) or a simple table-based report view.

---

### Step 10 — Email Delivery (Statements + Receipts)

**Billing emails**: Add a "Send via Email" button on the billing page. Trigger a Supabase Edge Function that renders the statement as HTML and sends it via Resend or SendGrid.

**Payment receipts**: Add a "Generate Receipt" button on the Payments page. Same delivery path.

---

### Deployment Checklist

When ready to go live:

- [ ] Run Step 1 (auth) and Step 2 (RLS) — do not skip these
- [ ] Run `supabase/migrations/001_client_balances_view.sql`
- [ ] Set environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `npm run build` — confirm zero errors
- [ ] Deploy to Vercel: connect repo, add env vars in the Vercel dashboard
- [ ] Set Supabase `Auth > URL Configuration > Site URL` to your Vercel domain
- [ ] Switch the `client-files` Storage bucket from Public to Private
- [ ] Enable rate limiting in Supabase `Auth > Rate Limits`
- [ ] Add Sentry (Step 5) and verify errors are being captured

---

## Security Checklist

| Item | Status |
|---|---|
| Authentication | ❌ Not implemented — Step 1 |
| Row Level Security | ❌ Not enabled — Step 2 |
| Role-based access | 🟡 Layer built, not wired to auth — Step 3 |
| File URLs (private storage) | ❌ Public URLs in use |
| File type / size validation | ❌ Browser-only `accept` attribute |
| Server-side input validation | ✅ Zod on all mutations |
| Error boundary | ✅ App-level ErrorBoundary in Providers |
| Sentry / monitoring | 🟡 Drop-in ready, not configured — Step 5 |
| Audit log | ❌ No change history — Step 6 |
| Soft deletes | ❌ Hard deletes everywhere — Step 6 |
| HTTPS | ✅ Automatic on Vercel |

---

## Known Bugs

| Issue | Location | Fix |
|---|---|---|
| Billing month-end uses `-31` | `billing/page.tsx` | Months with < 31 days may miss charges. Use actual last-day-of-month calculation |
| No end-date validation in scheduler | `scheduling/page.tsx` | End before start runs silently with 0 results and no error message |
| CSV import has no undo | `clients/page.tsx` | A bad import is permanent. Add a rollback or dry-run mode |
| Payments list flashes on month change | `payments/page.tsx` | Previous data clears before new data loads. Add `placeholderData: keepPreviousData` to `usePaymentsForMonth` |
| Credit balances show as negative numbers | Everywhere | If payments exceed charges the number goes negative. Show "Credit: $X" instead |
| No error state on failed queries | All pages | If Supabase returns an error the page silently shows empty data |
| File upload collision within same millisecond | `clients/[id]/page.tsx` | `${clientId}/${Date.now()}-filename` — two uploads in the same ms collide. Use `crypto.randomUUID()` instead |

---

*Next.js 14 · TypeScript · Supabase · React Query · Zod · Tailwind CSS*
