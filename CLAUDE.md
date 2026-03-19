# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FuelPlan 2.0 is a personalized hydration plan generator for athletes. It's a React SPA with a Supabase backend and AI-powered insights via Google Gemini or OpenAI.

## Commands

```bash
npm run dev        # Start dev server on http://localhost:8080
npm run build      # Production build to dist/
npm run lint       # Run ESLint
npm run preview    # Preview production build locally
```

There is no automated test suite. QA is done via in-app pages:
- `/qa-test` — hydration calculator test suite
- `/qa-analysis` — root-cause analysis of algorithm issues
- `/logic-check` — logic verification for sachet timing

## Architecture

### Data Flow

1. User fills hydration questionnaire on `Index.tsx` → `HydrationProfile` object
2. `hydrationCalculator.ts` runs calculations → `HydrationPlan`
3. Optional AI enhancement via Supabase Edge Function `enhance-hydration-plan` (Gemini/OpenAI)
4. Results rendered in `HydrationPlanDisplay` component

### Key Directories

- `src/pages/` — Route-level pages (`Index`, `Auth`, `Admin`, `QATest`, etc.)
- `src/components/` — Reusable components; `src/components/ui/` contains shadcn-ui primitives
- `src/utils/` — Core business logic (hydration calculator, Garmin parser, triathlon calculator)
- `src/contexts/` — Global state via React Context (`LanguageContext`, `RaceContext`)
- `src/integrations/supabase/` — Typed Supabase client
- `supabase/functions/` — Deno-based Edge Functions (each in its own subdirectory)
- `supabase/migrations/` — Timestamped SQL migration files

### State Management

- **React Context** for global app state (language, race selection)
- **TanStack React Query** for server state / Supabase data fetching
- **React Hook Form + Zod** for form state and validation

### Backend (Supabase)

Edge Functions (Deno runtime, JWT verification disabled):
- `enhance-hydration-plan` — AI-powered plan enhancement, rate-limited to 10 req/min/IP
- `save-hydration-profile` — Persist user profiles
- `delete-user-data` — GDPR data deletion
- `strava-connect` — Strava OAuth integration
- `send-plan-email` — Email delivery
- `_shared/` — Shared CORS headers and rate limiter utilities

Database uses RLS. User roles (`admin`/`user`) are stored in a `user_roles` table with a `app_role` enum.

### Path Aliases

`@/*` maps to `src/*`. Use `@/components/...`, `@/utils/...`, etc.

## Environment Variables

Frontend (`.env` or Vercel dashboard):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Supabase Edge Function secrets (set via Supabase CLI or dashboard):
```
GEMINI_API_KEY=      # Primary AI provider
OPENAI_API_KEY=      # Fallback AI provider
AI_PROVIDER=         # 'gemini' (default) or 'openai'
```

## TypeScript

TypeScript strict mode is **off**. `noImplicitAny`, `noUnusedLocals`, and `strictNullChecks` are all disabled. Avoid enabling these without auditing the entire codebase.

## UI Components

This project uses **shadcn-ui** (Radix UI + Tailwind). Add new components via:
```bash
npx shadcn-ui@latest add <component-name>
```

New components land in `src/components/ui/`. Dark mode is supported via `next-themes` with CSS variable–based theming in `tailwind.config.ts`.
