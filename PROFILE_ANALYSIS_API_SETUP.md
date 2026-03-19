# Step-by-step: Fix Profile Analysis API (OpenAI)

Follow these steps in order. You need **either** an OpenAI API key **or** a Gemini API key (OpenAI is recommended).

---

## Part 1: Get an API key

### Option A – OpenAI (recommended)

1. Open: **https://platform.openai.com/api-keys**
2. Log in or create an account.
3. Click **“Create new secret key”**.
4. Name it (e.g. `Hydrationguide`) and create.
5. **Copy the key** (it starts with `sk-`). You won’t see it again.

### Option B – Google Gemini

1. Open: **https://aistudio.google.com/apikey**
2. Sign in with Google.
3. Click **“Create API key”** and copy the key.

---

## Part 2: Terminal – Link project and set secret

Open a terminal in your project folder (e.g. `Hydrationguide`).

### Step 1: Log in to Supabase (if needed)

```bash
supabase login
```

If you’re already logged in, you can skip this.

### Step 2: Link your Supabase project (if not already linked)

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

Replace `YOUR_PROJECT_REF` with your project ref (e.g. `ldfpakkhikhaxssqehpu`).  
You can find it in Supabase Dashboard → Project Settings → General → **Reference ID**.

### Step 3: Set the API key as a secret

**If using OpenAI:**

```bash
supabase secrets set OPENAI_API_KEY=sk-paste-your-key-here
```

**If using Gemini:**

```bash
supabase secrets set GEMINI_API_KEY=paste-your-gemini-key-here
```

**If using both (Gemini first, then OpenAI fallback):**

```bash
supabase secrets set GEMINI_API_KEY=your-gemini-key
supabase secrets set OPENAI_API_KEY=sk-your-openai-key
```

### Step 4: Confirm the secret is set

```bash
supabase secrets list
```

You should see `OPENAI_API_KEY` and/or `GEMINI_API_KEY` (values are hidden).

### Step 5: Deploy the edge function

```bash
supabase functions deploy enhance-hydration-plan
```

Wait until it says the function is deployed.

---

## Part 3: Supabase Dashboard (alternative to terminal)

If you prefer not to use the CLI for secrets:

1. Go to **https://supabase.com/dashboard** and open your project.
2. In the left sidebar, click the **gear** → **Project Settings**.
3. Click **Edge Functions** in the left menu.
4. Open the **Secrets** tab.
5. Click **Add new secret** (or “New secret”).
6. **Name:** `OPENAI_API_KEY`  
   **Value:** your key (e.g. `sk-...`)  
   Then save.
7. (Optional) Redeploy the function: **Edge Functions** in the sidebar → find `enhance-hydration-plan` → **Deploy** or use the CLI command from Step 5 above.

---

## Part 4: Frontend env (for local/dev)

The **app** needs Supabase URL and anon key. If the plan page already loads, this is already set.

If not, in the project root create or edit `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

Get both from: **Supabase Dashboard → Project Settings → API** (Project URL and anon public key).

Restart the dev server after changing `.env`:

```bash
npm run dev
```

---

## Part 5: Test that it works

1. In the app, choose **Pro** and fill the questionnaire until you get a plan.
2. Scroll to **“Your Profile Analysis”** and click to expand.
3. You should see either:
   - A short loading state, then the analysis text and tips, or  
   - In the browser console (F12 → Console), a clear error if something is still wrong (e.g. missing secret).

If you see “Profile analysis is temporarily unavailable”, the function is either not getting the secret or the API call failed. Check:

- **Terminal:** `supabase secrets list` shows the key name.
- **Dashboard:** Project Settings → Edge Functions → Secrets has the same key name and a value.
- **Console:** Any `[Profile Analysis]` or network error for `enhance-hydration-plan`.

---

## Quick reference

| Step | Where | Action |
|------|--------|--------|
| 1 | Browser | Get key: platform.openai.com/api-keys or aistudio.google.com/apikey |
| 2 | Terminal | `supabase login` then `supabase link --project-ref YOUR_REF` |
| 3 | Terminal | `supabase secrets set OPENAI_API_KEY=sk-...` (or GEMINI_API_KEY) |
| 4 | Terminal | `supabase secrets list` to verify |
| 5 | Terminal | `supabase functions deploy enhance-hydration-plan` |
| 6 | Dashboard (optional) | Project Settings → Edge Functions → Secrets to set/edit keys |
| 7 | App | Open plan → expand “Your Profile Analysis” to test |
