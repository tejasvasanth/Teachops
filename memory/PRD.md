# TeachOps — Product Requirements & Status

## Original problem statement
Build **TeachOps**, a teacher management & operations app for a multi-centre
education organisation so teachers, coordinators and administrators do all
internal work in one app (no email/WhatsApp/spreadsheets). A rich HTML
prototype was provided as the visual reference; the user asked for a premium,
sellable experience in a light-blue / white / black theme with a good font.

## Stack (as built on this platform)
- **Frontend:** Expo / React Native (expo-router), react-query, Geist font, Phosphor icons.
- **Backend:** FastAPI (single `server.py`) + MongoDB (Motor), JWT auth (bcrypt).
- **Design:** `design_guidelines.json` → tokens in `src/theme.ts` (light + dark).
- Note: original brief named React web PWA + Supabase + AWS EC2; user agreed to
  build a native Expo app on this platform's FastAPI + MongoDB stack instead.

## User personas
- **Teacher** (Anjali Pillai) — own classes, attendance, pay, leave, messages.
- **Centre Coordinator** (Suresh Kannan, Adyar) — manages their centre, approvals.
- **Administrator** (Meenakshi Sundaram) — organisation-wide metrics & approvals.

## Core requirements (static)
- Role-scoped data enforced in the API (teacher/coordinator/administrator).
- One connected demo dataset: 1 org, 3 centres, 12 teachers, 6 programmes,
  15 batches, 120 students, a week of sessions, approvals, chat, pay, leave.
- No fake payments/deliveries — payment status only; messages stay in-app.

## Implemented (2026-06-10)
- Email/password JWT auth + demo role switcher (`/api/auth/demo-login`).
- **My Day:** teacher (next class, timeline rail, pending, pay/leave shortcuts);
  coordinator/administrator (operational metric tiles + today timeline).
- **Schedule:** week day chips, timeline rail, travel-conflict warnings.
- **Attendance/Session workspace:** roster, P/A/L/E segmented controls, autosave,
  mark-all, submit lifecycle (blocks until all marked), locked after submit.
- **Inbox (unified approvals):** role-scoped; approve / reject-with-required-reason;
  duplicate-processing (409) and unauthorised (403) blocked; notifies requester.
- **Chat:** conversation list, official threads, thread view with reply, compose
  with To/Subject/Message + Official toggle; unread counts & tab badges.
- **Pay:** statement list + detail with line-item calculation, Paid status,
  salary-credited notification. Records status only (clearly labelled demo).
- **Notifications:** centre with unread bell dot, read-all, deep-links.
- **Me:** profile, leave balances, pay list, expense placeholder, sign out.
- **Leave request** flow with date validation → pending approval.
- Light + dark theme, premium Geist typography, tabular numerals, status pills.
- 25/25 backend pytest pass (`/app/backend/tests/test_teachops_api.py`).

## Prioritised backlog
- **P1:** Add `enabled: !!token` to protected queries to remove transient 401
  flashes on first mount after role switch.
- **P1:** Teachers directory & profile tabs; Centres/Batches/Students CRUD + CSV import.
- **P1:** Lesson plans (Draft→Submitted→Approved) and attendance-correction requests UI.
- **P2:** Assessments & rubrics, Resources (object storage), Reports with CSV/PDF export.
- **P2:** Settings (org profile, holidays, policies, memberships), audit history.
- **P2:** Substitution assign + handover pack UI; real-time chat updates.
- **P2:** AI assistance adapter (drafting lesson plans / session notes).

## Next tasks
Harden the token-ready gate on queries, then build the Teachers directory and
Students/Batches with CSV import as the next connected workflow.
