# Developer Guide — CLAUDE.md

> This document provides technical implementation details for developers working on the Shooting Sign-Up System. For project specification, see [PROJECT_SPEC.md](PROJECT_SPEC.md). For database schema, see [DATABASE.md](DATABASE.md). For project roadmap, see [ROADMAP.md](ROADMAP.md).

---

## Tech Stack

| Layer        | Technology                     |
|--------------|--------------------------------|
| Framework    | Next.js 16 (App Router)       |
| Language     | TypeScript                     |
| Database     | Supabase (hosted PostgreSQL)   |
| Auth         | Supabase Auth (email/password) |
| ORM / Client | Supabase JS SDK (`@supabase/supabase-js`) |
| Styling      | Tailwind CSS v4 + shadcn/ui v4 (Base UI) |
| Deployment   | Vercel                         |
| Notifications| Supabase Edge Functions + email (Resend or Supabase built-in) |

### Important Version Notes
- **Next.js 16** — Uses App Router (not Pages Router)
- **Tailwind v4** — CSS-based config (`@import "tailwindcss"` in globals.css), not `tailwind.config.js`
- **shadcn/ui v4** — Uses Base UI, NOT Radix. No `asChild` prop. Use `render={<Component />}` instead.
- **shadcn `toast`** — Deprecated. Use `sonner` component instead.

---

## Project Structure

```
shooting-sign-up-web/
├── CLAUDE.md                      # This file — developer guide
├── PROJECT_SPEC.md                # Product specification
├── DATABASE.md                    # Database schema & RLS policies
├── ROADMAP.md                     # Phased execution plan
├── FEATURES.md                    # User guide (what each page does)
├── src/
│   ├── app/                       # Next.js App Router pages
│   │   ├── (auth)/                # Login / invite / password reset
│   │   │   ├── login/
│   │   │   └── set-password/
│   │   ├── (dashboard)/           # Authenticated routes (members)
│   │   │   ├── schedule/          # View weekly schedule
│   │   │   ├── preferences/       # Submit slot preferences
│   │   │   ├── profile/           # View attendance & score
│   │   │   └── cancel/            # Cancel a slot
│   │   ├── (admin)/               # EXCO & President routes
│   │   │   ├── attendance/        # Mark attendance
│   │   │   │   └── compliance/    # End-of-week compliance report
│   │   │   ├── guns/              # Manage gun assignments
│   │   │   ├── sessions/          # Manage sessions, templates, draft
│   │   │   │   └── draft-review/  # Review draft results
│   │   │   ├── semesters/         # Manage semesters
│   │   │   ├── members/           # Manage members, bulk upload
│   │   │   ├── competition/       # Set competition flags
│   │   │   ├── requirements/      # Set training requirements
│   │   │   └── handover/          # Promote to EXCO, transfer presidency
│   │   ├── layout.tsx
│   │   └── page.tsx               # Landing / redirect to login or dashboard
│   ├── components/
│   │   ├── ui/                    # shadcn/ui primitives
│   │   └── nav/                   # Navigation components
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          # Browser Supabase client
│   │   │   ├── server.ts          # Server-side Supabase client
│   │   │   └── admin.ts           # Service-role client (for bulk ops)
│   │   ├── algorithm/
│   │   │   ├── priority-score.ts  # Score calculation
│   │   │   ├── draft-engine.ts    # Slot allocation logic
│   │   │   ├── gun-clash.ts       # Gun clash resolution
│   │   │   └── exco-duty.ts       # Random EXCO duty assignment
│   │   ├── auth.ts                # getCurrentUser(), requireRole()
│   │   ├── utils.ts               # cn() utility
│   │   ├── utils/
│   │   │   └── datetime.ts        # Date/time formatting (DD/MM/YY, SGT)
│   │   └── constants.ts           # Weights, lane counts, deadlines, timezone
│   ├── types/
│   │   └── database.ts            # TypeScript types for database tables
│   └── middleware.ts              # Auth middleware
├── supabase/
│   ├── migrations/                # SQL migration files
│   └── functions/                 # Supabase Edge Functions
├── public/
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
├── package.json
└── .env.local                     # NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ANON_KEY, etc.
```

---

## Environment Variables

Create a `.env.local` file in the project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

Get these values from your Supabase project settings → API.

---

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Copy your project URL and keys to `.env.local`
3. Run migrations in Supabase SQL Editor:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_add_max_live_per_member.sql`

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

---

## Coding Conventions

### TypeScript
- **Strict mode** — No `any` types allowed
- **Server Components by default** — Only use `"use client"` when interactivity is needed
- **Type safety** — Import types from `@/types/database`

### File Naming
- `kebab-case` for files (e.g., `schedule-client.tsx`, `priority-score.ts`)
- `PascalCase` for React components (e.g., `ScheduleClient`, `PreferencePicker`)
- `camelCase` for functions and variables (e.g., `getCurrentUser`, `formatDate`)

### Supabase Client Usage
- **Browser**: Use `createClient()` from `@/lib/supabase/client`
- **Server**: Use `createClient()` from `@/lib/supabase/server` (cookies support)
- **Admin ops**: Use `createAdminClient()` from `@/lib/supabase/admin` (service role key)

**Rule of thumb**: Prefer server-side queries to keep data fetching secure and fast.

### Component Structure
- **One feature per file** — Keep components focused and small
- **Separate client and server components** — Use `-client.tsx` suffix for client components
- **Server actions in `actions.ts` files** — Colocate server actions with their feature

### Styling
- **Tailwind utility classes** — Use Tailwind for all styling
- **shadcn/ui components** — Use shadcn/ui primitives from `@/components/ui`
- **No custom CSS files** — Keep styles inline with Tailwind classes

### Algorithm Code
- **Pure functions** — Algorithm code in `src/lib/algorithm/` must be pure (no side effects, no database calls)
- **Data is passed in** — Fetch data separately and pass it to algorithm functions
- **Testable** — Pure functions make unit testing easy

---

## Key Design Decisions

### 1. Algorithm Runs Server-Side Only
The draft algorithm never runs in the browser. It's triggered by manual action (President) or Supabase Edge Function.

**Rationale**: Security, performance, and control.

### 2. Weights in `constants.ts`
Priority score weights are hardcoded in `src/lib/constants.ts`.

**Future enhancement**: Allow President to adjust weights via UI.

### 3. 4-Week Rolling Window for L_past
`L_past` is computed at draft time by querying allocations from the last 4 weeks.

**Why**: Ensures long-term rotation without scores inflating over a full semester.

### 4. Soft Gun Clash Rule
Algorithm tries to avoid gun clashes but never blocks a live fire allocation.

**Rationale**: Fairness over logistics.

### 5. No Auto-Assignment
Members who don't submit preferences are excluded from the draft entirely.

**Rationale**: Encourages engagement.

### 6. President Never Handles Passwords
Bulk upload triggers `supabase.auth.admin.inviteUserByEmail()`. Members set their own password.

**Rationale**: Security and privacy.

### 7. Preferences Are for Live Fire Only
Members rank sessions for live fire. If they don't win, they auto-get dry fire.

**Rationale**: Simplifies UI.

### 8. No-Show Count Resets Per Semester
When a new semester is created, all `no_show_count` values reset to 0.

**Rationale**: Fresh start each term.

### 9. Competition Flag (R) is Flexible
President can set it per individual, team, or level.

**Rationale**: Adapts to different competition scopes.

### 10. Template-Based Scheduling
President defines session templates once. Each week auto-generates sessions from templates.

**Rationale**: Reduces repetitive work.

---

## Common Tasks

### Adding a New Page

1. Create route folder: `src/app/(dashboard)/new-page/`
2. Add `page.tsx`: Server component
3. Add `-client.tsx`: Client component
4. Add `actions.ts`: Server actions
5. Update navigation: `src/components/nav/sidebar.tsx`
6. Add auth check: Use `requireRole(['president'])` if admin-only

### Running the Draft Manually

1. Go to **Sessions** → **Draft & Results** tab
2. Click **Run Draft**
3. Review results
4. Click **Publish Schedule**

---

## Troubleshooting

### "Invalid API key" Error
- Check `.env.local` has correct Supabase URL and keys
- Restart dev server after changing env vars

### "ERR_TOO_MANY_REDIRECTS"
- RLS policies may be blocking queries
- Temporarily disable RLS: `ALTER TABLE public.members DISABLE ROW LEVEL SECURITY;`
- Re-enable: `ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;`

### Dates Not Displaying Correctly
- Use `formatDate()` from `@/lib/utils/datetime`
- All dates should be DD/MM/YY format (e.g., "13/01/26")
- All times in Singapore Time (SGT, UTC+8)

### shadcn/ui Component Errors
- **`asChild` prop not working**: Use `render={<Component />}` instead (shadcn v4 uses Base UI)
- **`toast` not working**: Use `sonner` component instead (toast is deprecated)

---

## Documentation

| File | Purpose |
|------|---------|
| **CLAUDE.md** | Developer guide (this file) |
| **PROJECT_SPEC.md** | Product specification & algorithm design |
| **DATABASE.md** | Database schema & RLS policies |
| **ROADMAP.md** | Phased execution plan & project status |
| **FEATURES.md** | User guide (what each page does) |
