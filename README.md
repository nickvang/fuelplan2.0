# Supplme Hydration Plan Generator

A personalized, science-backed hydration strategy generator for optimal athletic performance.

## Technologies

This project is built with:

- **Vite** - Build tool and dev server
- **TypeScript** - Type safety
- **React** - UI framework
- **shadcn-ui** - UI component library
- **Tailwind CSS** - Styling
- **Supabase** - Backend (Database + Edge Functions)
- **Google Gemini AI** - AI-powered hydration insights

## Local Development

### Prerequisites

- Node.js 18+ and npm (install with [nvm](https://github.com/nvm-sh/nvm#installing-and-updating))

### Setup

1. Clone the repository:
```sh
git clone <YOUR_GIT_URL>
cd Hydrationguide
```

2. Install dependencies:
```sh
npm install
```

3. Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=https://ldfpakkhikhaxssqehpu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_clmlUJ0acEPV68ofLDvp_g_A_yHvaNK
```

4. Start the development server:
```sh
npm run dev
```

The app will be available at `http://localhost:8080`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:dev` - Build in development mode
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

## Deployment

### Frontend (Vercel)

#### Option 1: Vercel CLI

1. Install Vercel CLI:
```sh
npm i -g vercel
```

2. Deploy:
```sh
# First deployment (follow prompts)
vercel

# Production deployment
vercel --prod
```

#### Option 2: Vercel Dashboard (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure project:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Add environment variables in Project Settings → Environment Variables:
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase anon/public key
   - `VITE_STRAVA_CLIENT_ID` - Your Strava API Client ID (so "Connect with Strava" works on production)
6. Deploy! After adding or changing any `VITE_*` variable, trigger a new deployment (Redeploy) so the build picks it up.

Vercel will automatically deploy on every push to your main branch.

### Backend Functions (Supabase Edge Functions)

The backend functions are deployed separately to Supabase:

1. Install Supabase CLI:
```sh
npm i -g supabase
```

2. Login to Supabase:
```sh
supabase login
```

3. Link your project:
```sh
supabase link --project-ref ldfpakkhikhaxssqehpu
```

4. Deploy functions:
```sh
# Deploy all functions
supabase functions deploy

# Or deploy specific function
supabase functions deploy enhance-hydration-plan
supabase functions deploy save-hydration-profile
supabase functions deploy delete-user-data
```

5. Set environment secrets for the **Profile Analysis** AI (at least one required):
```sh
# Option A: OpenAI only (recommended if you have an OpenAI account)
supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key-here

# Option B: Gemini only
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here

# Option C: Both (Gemini is tried first, then OpenAI if it fails)
supabase secrets set GEMINI_API_KEY=your_gemini_key
supabase secrets set OPENAI_API_KEY=sk-your-openai-key

# Verify secrets (values are hidden)
supabase secrets list
```

**Where to get keys:**
- **OpenAI:** https://platform.openai.com/api-keys → Create secret key (e.g. for `gpt-4o-mini`).
- **Gemini:** https://aistudio.google.com/apikey

**Using the Dashboard instead of CLI:**  
Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Project Settings** → **Edge Functions** → **Secrets**. Add `OPENAI_API_KEY` and/or `GEMINI_API_KEY`.

### Environment Variables

#### Frontend (Vercel / local)

Set in Vercel Dashboard or in a `.env` file (for local dev):

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Your Supabase anon/public key

#### Backend (Supabase Edge Functions)

Set via **Supabase CLI** (`supabase secrets set ...`) or **Dashboard** → Project Settings → Edge Functions → Secrets. These are not read from a `.env` file.

- `OPENAI_API_KEY` - OpenAI API key (Profile Analysis uses `gpt-4o-mini`). **Set this for OpenAI.**
- `GEMINI_API_KEY` - Google Gemini API key (optional; tried first if set)
- `AI_PROVIDER` - Optional: `gemini` (default) or `openai` (which to try first when both keys exist)

## Custom Domain

To connect a custom domain to your Vercel deployment:

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Click "Add Domain"
3. Enter your domain name
4. Follow DNS configuration instructions
5. Vercel will automatically provision SSL certificates

## Project Structure

```
├── src/
│   ├── components/      # React components
│   ├── pages/          # Route pages
│   ├── utils/          # Business logic
│   ├── contexts/       # React contexts
│   ├── hooks/          # Custom hooks
│   ├── types/          # TypeScript types
│   └── integrations/   # External services (Supabase)
├── supabase/
│   ├── functions/      # Edge Functions (Deno)
│   └── migrations/     # Database migrations
├── public/             # Static assets
└── vercel.json        # Vercel configuration
```

## Features

- **Personalized Hydration Plans** - Science-backed calculations based on athlete profile
- **AI-Powered Insights** - Google Gemini provides personalized recommendations
- **Smartwatch Integration** - Parse Garmin/Whoop data for enhanced accuracy
- **Multi-language Support** - Internationalization support
- **GDPR Compliant** - Data retention and deletion features
- **Triathlon Support** - Specialized calculations for triathlon distances

## Migration from Lovable

If you're migrating this project away from Lovable, here's a checklist to ensure full independence:

### ✅ Completed Steps

- [x] Project uses standard Vite + React + TypeScript (no Lovable-specific build tools)
- [x] All dependencies are standard npm packages (no Lovable platform dependencies)
- [x] Supabase backend is self-hosted and independent
- [x] Deployment configuration for Vercel is included

### 🔧 Required Actions

1. **Environment Variables**
   - Create a `.env` file with your Supabase credentials:
     ```env
     VITE_SUPABASE_URL=https://ldfpakkhikhaxssqehpu.supabase.co
     VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_clmlUJ0acEPV68ofLDvp_g_A_yHvaNK
     ```
   - Get these from your Supabase project dashboard

2. **Supabase Setup**
   - Ensure your Supabase project is set up and linked
   - Deploy Edge Functions using Supabase CLI (see Backend Functions section above)
   - Set `GEMINI_API_KEY` secret in Supabase for AI features

3. **Assets & Images**
   - Replace social media images in `index.html` with your own assets
   - Update favicon if needed (currently uses `/favicon.ico`)
   - Consider hosting social images on your own CDN or Vercel

4. **Deployment**
   - Set up Vercel project (or your preferred hosting)
   - Configure environment variables in deployment platform
   - Set up custom domain if needed

5. **Clean Up (Optional)**
   - Remove `lovable-tagger` from `package-lock.json` if present:
     ```sh
     npm install
     ```
   - This will regenerate the lock file without unused dependencies

### 🚀 You're Ready!

Once you've completed the above steps, your project is fully independent from Lovable. You have:
- Full control over your codebase
- Independent deployment pipeline
- Self-hosted backend (Supabase)
- No platform lock-in

## QA (Quality Assurance)

The app includes internal QA pages to verify the hydration calculator without changing production logic:

| Route | Purpose |
|-------|--------|
| **`/qa-test`** | Runs a full test suite: many scenarios (disciplines, durations, sweat profiles, race day vs training). Auto-runs on load. Use filters by severity (OK / Warnings / Errors) and by activity. Fix any **ERROR** cases first. |
| **`/qa-analysis`** | Root-cause analysis of known algorithm issues with examples and affected scenarios. |
| **`/logic-check`** | Logic verification: sachet timing and totals for Marathon, Half, Ironman, 10K, etc. Green = formula matches expected. |

**How to run QA:** Start the dev server (`npm run dev`), then open:

- http://localhost:8080/qa-test  
- http://localhost:8080/qa-analysis  
- http://localhost:8080/logic-check  

All QA pages are mobile-friendly (responsive layout and touch targets).

## Support

For issues or questions, please open an issue in the repository.
