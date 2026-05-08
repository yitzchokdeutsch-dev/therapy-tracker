# HIPAA Compliance Guide

*What this app needs to become HIPAA compliant — technical changes, vendor requirements, and clinic policies.*

---

## The Most Important Thing to Understand First

HIPAA does not certify software. It certifies **organizations**. The clinic itself must be compliant — the software is one part of that, but it's not the whole picture. A perfectly built app running inside a clinic that has no written policies and no staff training is still not HIPAA compliant.

This guide covers both sides: what needs to change in the app, and what the clinic needs to do as an organization.

---

## What Is PHI? (Protected Health Information)

Under HIPAA, any information that can identify a patient and relates to their health, treatment, or payment is considered PHI. This app currently stores:

- Client names and contact information ✦ PHI
- Dates of service ✦ PHI
- Type of therapy received ✦ PHI
- Clinical notes ✦ PHI
- Billing and payment records ✦ PHI
- Uploaded documents (evaluations, insurance forms) ✦ PHI

All of this is PHI. Every system that touches it — the database, the file storage, the hosting, the error monitoring — must meet HIPAA standards.

---

## Part 1 — Vendor Agreements (Do This First)

Before any code changes, you need signed **Business Associate Agreements (BAAs)** from every vendor that handles PHI. A BAA is a legal contract where the vendor agrees to protect the data according to HIPAA standards.

Without a BAA, using that vendor for PHI is a HIPAA violation — no matter how secure the code is.

### Vendors That Need BAAs

| Vendor | What It Does | BAA Available? | Notes |
|---|---|---|---|
| **Supabase** | Database + file storage | Yes — Enterprise plan only | Free and Pro plans are NOT HIPAA eligible. Must upgrade. |
| **Vercel** | Hosting | Yes — Pro plan ($20/mo) or Enterprise | Free plan is NOT HIPAA eligible. Must upgrade. |
| **Sentry** | Error monitoring (planned) | Yes — Business plan | Only needed once Sentry is added |
| **Resend / SendGrid** | Email (planned) | Yes — both offer BAAs | Only needed once email is added |

### Action: Upgrade Supabase to HIPAA-Eligible Plan
This is the single most important step. Go to supabase.com → Contact Sales → request HIPAA plan. They will:
- Provide a signed BAA
- Enable encryption at rest on your database
- Enable HIPAA-grade audit logging

Without this, storing patient data in Supabase is not legally permissible under HIPAA regardless of anything else you do.

---

## Part 2 — Technical Changes to the App

### Critical (Blocking — Required for Compliance)

**1. Authentication with MFA**
Passwords alone are not enough for PHI. HIPAA requires strong authentication.
- Add Supabase Auth (email + password login) — already planned as Step 1
- Add **multi-factor authentication (MFA)** — a second code sent to a phone or authenticator app after the password
- Supabase Auth supports MFA natively; it takes about 30 minutes to enable

**2. Automatic Session Timeout**
HIPAA requires that unattended workstations automatically lock. For a web app, this means:
- Log out users automatically after 15–30 minutes of inactivity
- Show a warning ("You'll be logged out in 2 minutes") before it happens
- This is a small amount of code — a timer that watches for mouse/keyboard activity

**3. Audit Log (Every Access, Not Just Changes)**
HIPAA requires logging who accessed PHI, not just who changed it. The current plan logs changes (Step 6 in the roadmap). For HIPAA, it must also log:
- Who viewed a client profile and when
- Who ran a billing report and when
- Who downloaded a file and when
- Failed login attempts

This becomes a database table: `audit_log` with columns for user, action, record accessed, timestamp, and IP address.

**4. Encryption at Rest**
PHI stored in the database and in file storage must be encrypted at rest (meaning: even if someone physically accessed the server drives, they couldn't read the data). Supabase's HIPAA plan enables this automatically for the database. For file storage, the `client-files` bucket must also have encryption at rest enabled and must be switched from public to private (already planned).

**5. Private File Storage + Expiring Links**
Clinical documents must never be publicly accessible. Switching from `getPublicUrl()` to `createSignedUrl(path, 60)` means any file link expires after 60 seconds — already planned in the roadmap. This is a requirement, not optional.

**6. Row Level Security (RLS)**
Already planned as Step 2. Under HIPAA this is required: the database must enforce that users can only access the records they are authorized to see. A therapist should not be able to query another therapist's client records even if they tried.

---

### Important (Required, Less Urgent)

**7. Data Backup and Recovery Plan**
HIPAA requires a documented backup and disaster recovery plan. Supabase provides automatic daily backups on paid plans. You need to:
- Confirm backups are enabled and document the retention period
- Test a restore at least once a year and document that you did it
- Know the answer to: "If the database was completely lost today, how long to restore it and how much data would be lost?"

**8. Minimum Necessary Access**
HIPAA's "minimum necessary" rule means users should only see the PHI they need for their job. The role-based access system already planned (Admin / Therapist / Billing / Read-only) directly satisfies this requirement. Once roles are wired to real user accounts, this is covered.

**9. Soft Deletes + Data Retention**
HIPAA requires that PHI be retained for 6 years from creation or last use. Hard-deleting records violates this. The soft-delete system planned in Step 6 of the roadmap directly addresses this — deleted records are kept but marked inactive, not permanently removed.

**10. Secure Password Policy**
When login is added, enforce:
- Minimum 12 characters
- Cannot reuse last 5 passwords
- Must change every 90 days (or use MFA, which reduces this requirement)
Supabase Auth has password policy settings in the dashboard.

**11. HTTPS Only**
All communication must be encrypted in transit. Vercel enforces HTTPS automatically — this is already covered.

---

## Part 3 — Clinic Policies (The Organizational Side)

These are not code changes. These are written documents the clinic must have.

### Required Policies

**Privacy Policy**
A document explaining how patient information is used, who can access it, and patients' rights regarding their data (right to access their records, right to request corrections, etc.). Must be given to every patient.

**Security Policy**
A written document stating how the clinic protects electronic PHI. Covers things like: who has login access, how passwords are managed, what happens if a device is lost, how the software is kept up to date.

**Workforce Training Records**
Every staff member who touches PHI must receive HIPAA training and sign a document confirming they completed it. This must be repeated annually. Training records must be kept for 6 years.

**Incident Response Plan**
A written procedure for what happens if there is a data breach. Under HIPAA, a breach affecting more than 500 individuals must be reported to the Department of Health and Human Services within 60 days and notice must be given to affected individuals. Smaller breaches must be logged and reported annually.

**Risk Assessment**
A written analysis of potential threats to PHI and what the clinic does to address each one. This does not have to be elaborate — a clear honest document identifying risks (lost laptop, unauthorized access, etc.) and the safeguards in place is sufficient. Must be updated whenever the system changes significantly.

**Sanction Policy**
A written statement of consequences for staff who violate HIPAA rules — intentionally or by accident. Even accidental violations must have a defined response.

### Physical Security

Even though this is a web app, physical security matters under HIPAA:
- Computers used to access the app should lock automatically when unattended (Windows: set screen lock to 5 minutes)
- No one should be able to see the screen from a waiting room or public area
- Staff should lock their screen whenever they walk away
- Printed billing statements are PHI — they must be shredded, not thrown in a trash can

---

## Part 4 — What Is Already Compliant

| Requirement | Status |
|---|---|
| HTTPS / encryption in transit | ✅ Vercel enforces this |
| Server-side input validation | ✅ Zod validation on all mutations |
| Error handling (no raw errors exposed) | ✅ ErrorBoundary catches and hides stack traces |
| Role definitions built | ✅ Admin / Therapist / Billing / Readonly defined in code |
| Closed on Shabbos (reduced attack surface) | ✅ Scheduling intentionally excludes Saturday |

---

## Part 5 — Prioritized Action List

Do these in order. The first two are legal requirements that cannot wait.

| Priority | Action | Who |
|---|---|---|
| 🔴 **1** | Upgrade Supabase to HIPAA plan, get signed BAA | Clinic owner |
| 🔴 **2** | Upgrade Vercel to Pro plan, get signed BAA | Clinic owner |
| 🔴 **3** | Add authentication + MFA (Step 1 of roadmap) | Developer |
| 🔴 **4** | Enable Row Level Security (Step 2 of roadmap) | Developer |
| 🟠 **5** | Add session auto-timeout (15–30 min inactivity) | Developer |
| 🟠 **6** | Add full audit log (access + changes) | Developer |
| 🟠 **7** | Switch file storage to private + expiring links | Developer |
| 🟠 **8** | Write and distribute Privacy Policy | Clinic owner |
| 🟠 **9** | Write Security Policy and Risk Assessment | Clinic owner |
| 🟡 **10** | Complete staff HIPAA training + signed records | Clinic owner |
| 🟡 **11** | Implement soft deletes + 6-year retention | Developer |
| 🟡 **12** | Wire role-based access to real user accounts (Step 3) | Developer |
| 🟡 **13** | Write Incident Response Plan | Clinic owner |
| 🟡 **14** | Document backup policy and test a restore | Clinic owner + Developer |

---

## Realistic Cost Estimate

| Item | Estimated Monthly Cost |
|---|---|
| Supabase HIPAA plan | ~$599/mo (Enterprise — contact sales for exact pricing) |
| Vercel Pro | $20/mo |
| **Total infrastructure** | **~$620/mo** |

There are lower-cost alternatives:
- **Supabase Pro** ($25/mo) is not HIPAA eligible — you would need to self-host Supabase on AWS or use a HIPAA-eligible managed Postgres provider like **Neon** (which does offer BAAs on paid plans, starting around $19/mo)
- **Railway** or **Render** with a managed Postgres database also offer BAAs at lower cost

For a small clinic just starting out, the most practical path is:
1. Start with Neon or another HIPAA-eligible Postgres provider (lower cost, BAA available)
2. Continue using Vercel Pro for hosting ($20/mo)
3. Total: ~$40–80/mo while building out the compliance features

---

## One More Thing: You Don't Need to Be Perfect Immediately

HIPAA compliance is a process, not a single moment. The HHS Office of Civil Rights (the agency that enforces HIPAA) looks at whether an organization is making **good faith efforts** to implement safeguards and has documented those efforts.

A clinic that has:
- A signed BAA with their database provider
- A login system
- Written policies (even simple ones)
- Staff training records

...is in a much better position than a clinic that has none of those things, even if the technical implementation isn't perfect yet.

The worst violations — the ones that result in large fines — are cases where organizations had no policies, no training, no awareness, and clearly made no effort. Good faith, documented progress, and the right vendor agreements go a long way.

---

*This document is for planning purposes. Consult a HIPAA compliance consultant or healthcare attorney before storing real patient data.*
