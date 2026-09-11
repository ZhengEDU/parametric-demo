# Parametric Demo

**DEVELOPMENT DEMO — NOT VALIDATED FOR PRODUCTION CALIBRATION USE.**

A demo calibration/PM workflow app: technicians fill in digital calibration
data, managers review/approve, the system generates a Word certificate from
Parametric's real template shell, and a fake "Calibration Control" sync
simulates handoff to the legacy system. See `docs/ASSUMPTIONS.md` for what's
real vs. fictional/demo-only, and `docs/DOCUMENT_ANALYSIS.md` /
`docs/WORD_TEMPLATE_ENGINE.md` for how the Word rendering was built.

## Stack

- **Backend:** Node.js + TypeScript + Express 5 + Prisma, PostgreSQL 16 (Docker Compose).
- **Frontend:** React + TypeScript + Vite, plain CSS.
- **Documents:** `docxtemplater` + `pizzip` rendering into copies of the real template shell.

## Running it locally

```bash
# 1. Database
docker compose up -d postgres

# 2. Backend
cd server
cp .env.example .env   # if you haven't already
npm install
npm run prisma:migrate   # or: npx prisma migrate deploy
npm run seed              # loads demo customers/assets/users/jobs
npm run dev                # http://localhost:4000

# 3. Frontend (separate terminal)
cd web
npm install
npm run dev                # http://localhost:5173, proxies /api to :4000
```

Open http://localhost:5173 and log in with one of the seeded demo accounts.

## Demo accounts

All seeded users share the password `Parametric123!`.

| Email | Role | Notes |
|---|---|---|
| `jordan.kim@parametric.demo` | Technician | Has a DRAFT job to finish live, a SUBMITTED job, and a RETURNED_FOR_CORRECTION job |
| `taylor.brooks@parametric.demo` | Technician | Has an APPROVED job (demo "Generate Document"), a READY_FOR_RELEASE job (demo "Release"), and one fully RELEASED job |
| `manager@parametric.demo` | Manager | Review queue, approve/return, generate/sync/release actions |
| `admin@parametric.demo` | Admin | Everything a manager can do, plus Templates and Admin (read-only) screens |
| `casey.nguyen@parametric.demo` | Documentation | Legacy scan upload / transcription role |
| `sam.patel@parametric.demo` | Auditor | Read-only access to every record, review, and the audit trail |

Re-running `npm run seed` is a no-op once the database already has users —
reset first with `npx prisma migrate reset --force --skip-seed` if you want
fresh demo data.

## Known limitations (demo scope)

- Admin's Users/Customers/Assets screens are read-only — no create/edit
  endpoints exist yet server-side.
- Calculation and decision rules are intentionally simple, labeled
  `DEMO-CALC-*` / `DEMO-DECISION-*` — not Parametric's real production
  formulas (never supplied). See `docs/ASSUMPTIONS.md`.
- Only one real source Word document was supplied (Weight Set /
  `CALIBRATION_CERTIFICATE`); the Temp/RH, Weathering Tester, and
  Preventative Maintenance templates are demo-authored from the brief's
  written description, not scanned from a real file.
