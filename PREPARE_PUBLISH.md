# Prepare for publish

Use this before deploying to production.

## 1. Production build

```bash
npm run build
npm run lint
```

- Build output is in `dist/`. Vercel uses `npm run build` and `outputDirectory: "dist"` (see `vercel.json`).
- **Developer tools (bypass buttons)** are **not shown** in production: they are only rendered when `import.meta.env.DEV` is true (i.e. when you run `npm run dev`). In a production build, that block is excluded.

## 2. Environment variables (production)

Set these in your host (e.g. Vercel → Project → Settings → Environment Variables):

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key (safe for frontend) |

Supabase Edge Function secrets (Profile Analysis, save profile) are set in **Supabase Dashboard → Project Settings → Edge Functions → Secrets** (e.g. `OPENAI_API_KEY`, `GEMINI_API_KEY`). See README and `PROFILE_ANALYSIS_API_SETUP.md`.

## 3. Pre-publish checklist

Run through `TESTING_BEFORE_PUBLISH.md` (QA test, logic check, Quick/Pro flows, mobile). When that checklist passes, you’re ready to publish.

## 4. Deploy

- **Vercel:** Push to your connected repo or run `vercel --prod`.
- **Other hosts:** Build with `npm run build`, then deploy the contents of `dist/`.
