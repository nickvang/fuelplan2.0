# Strava connection – what to check on your side

When you see **"Strava connection failed"**, follow this list. The exact error message (in the **red toast** after redirect, or in the **browser console**) tells you which step is wrong.

---

## 1. See the real error (do this first)

1. Open your app in the browser.
2. Open **Developer Tools** (F12 or right‑click → Inspect) → **Console** tab.
3. Click **Connect with Strava**, authorize on Strava, and wait until you’re redirected back.
4. In the console, look for **`[Strava]`** – the message after it is the real error.
5. Also check the **red toast** on the home page after redirect – it should show the same message.

Use that message in the sections below.

---

## 2. Strava API settings

**Where:** https://www.strava.com/settings/api

| Check | What to do |
|-------|------------|
| **Authorization Callback Domain** | Must list the **exact domain** of your app, **no** `http://` or path. For local dev use **`localhost`** (one word). For production use e.g. **`your-domain.com`**. |
| **Client ID** | Copy this number; you need it in step 3 and 4. |
| **Client Secret** | Click “Show” and copy; you need it **only** in step 4 (Supabase). |

If the error says **redirect_uri** or **invalid** or **Bad Request**, the callback domain is wrong or doesn’t match the URL you’re actually using.

---

## 3. Frontend `.env`

**Where:** In your project root, file named **`.env`**.

| Check | What to do |
|-------|------------|
| **Line exists** | You must have: `VITE_STRAVA_CLIENT_ID=` followed by your **Strava Client ID** (numbers only). No spaces around `=`, no quotes. |
| **Restart** | After changing `.env`, **stop** the dev server (Ctrl+C) and run `npm run dev` again. |

If the button says **“Strava is not configured for this app”**, this value is missing or the server wasn’t restarted.

---

## 4. Supabase Edge Function secrets

**Where:** Supabase Dashboard → your project → **Project Settings** (gear) → **Edge Functions** → **Secrets** (or “Manage secrets”).

| Check | What to do |
|-------|------------|
| **STRAVA_CLIENT_ID** | Add a secret with this **name** and value = your **Strava Client ID** (same as in `.env`). |
| **STRAVA_CLIENT_SECRET** | Add a secret with this **name** and value = your **Strava Client Secret** from the API page. |

If the error says **“Server configuration error”**, one or both of these secrets are missing or wrong.

---

## 5. Edge Function deployed

**Where:** Same Supabase project.

| Check | What to do |
|-------|------------|
| **Function exists** | In the dashboard, under **Edge Functions**, you should see **strava-connect**. |
| **Deployed** | If you use Supabase CLI: run `supabase functions deploy strava-connect` from your project folder. |

If the error is **“Network or server error”** or **“Failed to fetch”**, the function might not be deployed or the project URL/keys might be wrong.

---

## 6. Callback URL must match

When you click “Connect with Strava”, the app uses:

- **Redirect URI** = `https://your-current-origin/strava-callback`  
  (e.g. `http://localhost:5173/strava-callback` or `https://your-domain.com/strava-callback`)

So:

- **Strava** → Authorization Callback Domain = **only** the host: `localhost` or `your-domain.com`.
- You must be visiting the app at that **exact** origin (same protocol and domain, port doesn’t matter for `localhost`).

---

## Quick reference

| You see this | Fix this |
|--------------|----------|
| “Strava is not configured” | Add `VITE_STRAVA_CLIENT_ID` in `.env` and restart dev server. |
| “Server configuration error” | Add `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` in Supabase Edge Function secrets. |
| “Strava: Bad Request” / redirect_uri / invalid | Fix **Authorization Callback Domain** on Strava (use exact domain, e.g. `localhost` or your domain). |
| “Missing code or state” | You may have opened the callback in another tab or cleared session; try again from the app. |
| “Invalid state” | Session expired; try again (click Connect with Strava and complete in one go). |
| “Network or server error” | Check Supabase URL/keys in `.env` and that `strava-connect` is deployed. |

After each change, try **Connect with Strava** again and check the **console** and **toast** for the exact message.
