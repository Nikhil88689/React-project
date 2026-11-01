# RecruitFlow AI

An AI-powered applicant tracking system for managing jobs, candidates, interviews, hiring workflows, and recruitment analytics.

The product is a real multi-tenant SaaS workspace — not a mock UI. Recruiters, interviewers, company admins, candidates, and a platform super-admin each get a role-enforced experience.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind, TanStack Query, Zustand, React Hook Form, Zod, Recharts |
| Backend | Node.js, Express, Prisma, PostgreSQL, Redis, BullMQ, Socket.IO, JWT |
| AI | Optional LLM API with a deterministic heuristic fallback |
| Files | S3 presigned uploads, or local signed URLs in development |
| Billing | Stripe test mode, or in-app mock plans |
| Ops | Docker, GitHub Actions, Playwright, Vitest |

## Demo accounts

Password for every seeded user: `Demo@1234`

| Email | Role |
| --- | --- |
| `admin@demo.recruitflow.com` | Company admin |
| `recruiter@demo.recruitflow.com` | Recruiter |
| `interviewer@demo.recruitflow.com` | Interviewer |
| `candidate@demo.recruitflow.com` | Candidate |
| `superadmin@demo.recruitflow.com` | Platform admin |

Public careers page after seed: [/careers/nimbus-labs](http://localhost:5173/careers/nimbus-labs)

## Local setup

Requires Node 20+.

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run db:local      # embedded PostgreSQL on :5433
npm run db:migrate
npm run db:seed
npm run dev           # API :4010 + Vite :5173
```

Open [http://localhost:5173](http://localhost:5173) and sign in as `admin@demo.recruitflow.com`.

Redis, S3, SMTP, Stripe, and an LLM key are optional. Without them the API uses:

- in-process background jobs
- local disk uploads
- console email
- mock billing
- heuristic AI matching / JD generation / summaries

## Architecture

```text
React (Vite)  --HTTPS/REST + Socket.IO-->  Express API
                                           ├── PostgreSQL / Prisma
                                           ├── Redis / BullMQ workers
                                           ├── S3 (or local uploads)
                                           └── LLM provider (optional)
```

Authorization is enforced on the server (`requirePermission`). Hiding a button in React is never the only gate.

## Product surfaces

- Landing, login, register, onboarding
- Recruiter dashboard with KPIs, funnel, pipeline preview, interviews, activity
- Interviewer dashboard and scorecards
- Jobs (list, multi-step wizard, AI JD, publish, public careers page)
- Candidates (filters, profile, notes, email templates, AI insights)
- Kanban pipeline with optimistic drag-and-drop
- Interviews, calendar, reminders via background jobs
- Talent pools, analytics, team, audit log, billing
- Candidate portal and super-admin console
- Command palette (`Ctrl+K`) and floating RecruitFlow AI assistant

## API

Interactive docs: [http://localhost:4010/api/docs](http://localhost:4010/api/docs)

Core routes live under `/api/auth`, `/api/jobs`, `/api/candidates`, `/api/applications`, `/api/interviews`, `/api/ai`, `/api/billing`, `/api/audit-logs`.

## Tests

```bash
npm test              # Vitest unit tests
npm run test:e2e      # Playwright hiring smoke flow
```

## Docker

```bash
docker compose up --build
```

Postgres is on `:5432` in Compose. Point `DATABASE_URL` at that host if you are not using the embedded local cluster.

## Environment

See `apps/api/.env.example`. Never commit real secrets. The seeded demo password is for local / portfolio use only — rotate it before any public deploy.
