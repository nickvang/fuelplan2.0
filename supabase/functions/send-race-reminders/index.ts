// send-race-reminders: Daily cron function that sends pre-race and post-race emails.
// Invoked twice daily — morning (07:00 UTC) and evening (18:00 UTC) — via pg_cron or external scheduler.
// Uses Resend API for delivery and tracks sent reminders in athlete_races.sent_reminders JSONB.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Types ──

type ReminderType = "30day" | "14day" | "7day" | "2day" | "raceday" | "evening" | "postrace";
type Batch = "morning" | "evening";

interface ScheduleEntry {
  type: ReminderType;
  daysOffset: number; // positive = before race, negative = after
  batch: Batch;
  needsStrava: boolean;
}

interface RaceRow {
  id: string;
  user_id: string;
  race_name: string;
  race_date: string;
  distance_km: number | null;
  discipline: string | null;
  location_city: string | null;
  plan_id: string | null;
  sent_reminders: Record<string, string>;
}

interface TemplateVars extends Record<string, any> {
  race_name: string;
  distance: string;
  duration: string;
  planned_duration: string;
  fluid_loss: string;
  race_location: string;
  pre_water: number;
  pre_sachets: number;
  pre_timing: string;
  during_water_per_hr: number;
  during_sachets_per_hr: number;
  during_sachets: number;
  during_total_water: number;
  during_sip_amount: number;
  during_frequency: string;
  post_water: number;
  post_water_half: number;
  post_sachets: number;
  post_timing: string;
  total_sachets: number;
  total_sachets_race_day: number;
  strava_finish_time: string;
  strava_avg_pace: string;
  has_strava: boolean;
  show_comparison: boolean;
}

interface StravaActivity {
  name: string;
  moving_time: number;
  distance: number;
  average_speed: number;
  start_date_local: string;
  type: string;
}

// ── Constants ──

const SCHEDULE: ScheduleEntry[] = [
  { type: "30day", daysOffset: 30, batch: "morning", needsStrava: false },
  { type: "14day", daysOffset: 14, batch: "morning", needsStrava: false },
  { type: "7day", daysOffset: 7, batch: "morning", needsStrava: false },
  { type: "2day", daysOffset: 2, batch: "morning", needsStrava: false },
  { type: "raceday", daysOffset: 0, batch: "morning", needsStrava: false },
  { type: "evening", daysOffset: 0, batch: "evening", needsStrava: true },
  { type: "postrace", daysOffset: -1, batch: "evening", needsStrava: true },
];

const BASE_URL = "https://fuelplan.supplme.dk";

// ── Utilities ──

function escapeHtml(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function determineBatch(body: Record<string, any>, utcHour: number): Batch {
  if (body.evening_run === true) return "evening";
  if (body.batch === "morning" || body.batch === "evening") return body.batch;
  return utcHour < 14 ? "morning" : "evening";
}

function formatSeconds(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatPace(distM: number, timeS: number, discipline: string | null): string {
  if (distM <= 0 || timeS <= 0) return "";
  if (discipline?.toLowerCase() === "cycling") {
    return `${((distM / 1000) / (timeS / 3600)).toFixed(1)} km/h`;
  }
  const minPerKm = (timeS / 60) / (distM / 1000);
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}/km`;
}

// ── Strava integration ──

async function refreshStravaToken(
  supabase: any,
  userId: string,
  refreshToken: string
): Promise<string | null> {
  try {
    const res = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: Deno.env.get("STRAVA_CLIENT_ID"),
        client_secret: Deno.env.get("STRAVA_CLIENT_SECRET"),
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();

    await supabase
      .from("athlete_profiles")
      .update({
        strava_access_token: data.access_token,
        strava_refresh_token: data.refresh_token,
        strava_expires_at: data.expires_at,
      })
      .eq("user_id", userId);

    return data.access_token as string;
  } catch (e) {
    console.warn(`[Strava] Token refresh error for user ${userId}:`, e);
    return null;
  }
}

async function fetchStravaRaceActivity(
  supabase: any,
  userId: string,
  raceDate: string
): Promise<StravaActivity | null> {
  try {
    const { data: profile } = await supabase
      .from("athlete_profiles")
      .select("strava_access_token, strava_refresh_token, strava_expires_at")
      .eq("user_id", userId)
      .single();

    if (!profile?.strava_refresh_token) return null;

    let accessToken = profile.strava_access_token;
    if (Date.now() / 1000 > profile.strava_expires_at) {
      accessToken = await refreshStravaToken(supabase, userId, profile.strava_refresh_token);
      if (!accessToken) return null;
    }

    const after = Math.floor(new Date(raceDate).getTime() / 1000);
    const before = after + 86400;
    const res = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${after}&before=${before}&per_page=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;

    const activities: StravaActivity[] = await res.json();
    const sorted = activities
      .filter((a) => a.distance > 1000)
      .sort((a, b) => b.moving_time - a.moving_time);

    return sorted[0] || null;
  } catch (e) {
    console.warn("[Strava] Activity fetch error:", e);
    return null;
  }
}

// ── Email templates ──
// Each template uses {placeholder} syntax, resolved by replaceVars().
// Computed blocks (plan_card, strava_card, cta, etc.) are injected as vars before rendering.

const EMAIL_SHELL = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#1a1a1a;max-width:480px;margin:0 auto;padding:24px;">
{body}
<p style="font-size:11px;color:#999;margin-top:24px;border-top:1px solid #eee;padding-top:12px;">You're receiving this because you added {race_name} to your race calendar on Supplme. To stop these emails, remove the race at <a href="${BASE_URL}" style="color:#999;">${BASE_URL}</a>.</p>
<p style="font-size:10px;color:#ccc;">&copy; {year} Supplme</p>
</body></html>`;

const PLAN_CARD = `<div style="padding:16px;background:#f5f5f5;border-radius:8px;margin:16px 0;">
  <p style="font-size:11px;text-transform:uppercase;color:#666;margin:0 0 12px;font-weight:600;">Your hydration plan</p>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:8px 0;border-bottom:1px solid #e5e5e5;"><span style="font-size:11px;text-transform:uppercase;color:#666;">Before</span><br><span style="font-size:14px;font-weight:600;">{pre_water}ml + {pre_sachets} sachet(s), {pre_timing}</span></td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #e5e5e5;"><span style="font-size:11px;text-transform:uppercase;color:#666;">During</span><br><span style="font-size:14px;font-weight:600;">{during_water_per_hr}ml/hr, {during_frequency}</span></td></tr>
    <tr><td style="padding:8px 0;"><span style="font-size:11px;text-transform:uppercase;color:#666;">After</span><br><span style="font-size:14px;font-weight:600;">{post_water}ml + {post_sachets} sachet(s), {post_timing}</span></td></tr>
  </table>
</div>`;

const STRAVA_CARD = `<div style="padding:16px;background:#f5f5f5;border-radius:8px;margin:16px 0;">
  <p style="font-size:11px;text-transform:uppercase;color:#666;margin:0 0 8px;font-weight:600;">Your race on Strava</p>
  <p style="font-size:24px;font-weight:800;margin:0 0 4px;">{strava_finish_time}</p>
  <p style="font-size:14px;color:#666;margin:0;">{strava_avg_pace}</p>
</div>`;

const CTA_TEMPLATE = `<p><a href="{cta_href}" style="display:inline-block;padding:12px 24px;background:#0a0a0a;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">{cta_label}</a></p>`;

const TEMPLATE_30DAY = `
<p style="font-weight:700;font-size:18px;margin-bottom:4px;">{race_name}{location_suffix}</p>
<p style="color:#666;margin-top:0;">30 days to go.</p>
<p>Your race is a month away. Now's the time to dial in your hydration strategy. A personalized plan takes 2 minutes.</p>
{plan_card}
{cta}`;

const TEMPLATE_14DAY = `
<p style="font-weight:700;font-size:18px;margin-bottom:4px;">{race_name}{location_suffix}</p>
<p style="color:#666;margin-top:0;">2 weeks out.</p>
<p>Two weeks to go. {plan_message}</p>
{plan_card}
{cta}`;

const TEMPLATE_7DAY = `
<p style="font-weight:700;font-size:18px;margin-bottom:4px;">{race_name}{location_suffix}</p>
<p style="color:#666;margin-top:0;">7 days to go.</p>
<p>Your race is next week. Time to finalize your hydration plan and get your sachets ready.</p>
{plan_card}
{no_plan_nudge}
{cta}`;

const TEMPLATE_2DAY = `
<p style="font-weight:700;font-size:18px;margin-bottom:4px;">{race_name}{location_suffix}</p>
<p style="color:#666;margin-top:0;">2 days out. Time to pre-load.</p>
{plan_or_nudge}
<p>Start increasing water intake today. Aim for 2-3L and include sodium-rich meals.</p>
{cta}`;

const TEMPLATE_RACEDAY = `
<p style="font-weight:800;font-size:20px;margin-bottom:4px;">Race day.</p>
<p style="color:#666;margin-top:0;">{race_name}{location_suffix}</p>
{plan_or_fallback}
<p style="font-size:14px;font-weight:600;">Trust your preparation. Execute your plan. You've got this.</p>`;

const TEMPLATE_EVENING_WITH_COMPARISON = `
<p style="font-weight:700;font-size:18px;margin-bottom:4px;">How did it go?</p>
<p style="color:#666;margin-top:0;">{race_name}{location_suffix}</p>
{strava_card}
{recovery_block}
<p>Your feedback helps us improve your next plan — it takes 10 seconds.</p>
{cta}`;

const TEMPLATE_EVENING_NO_COMPARISON = `
<p style="font-weight:700;font-size:18px;margin-bottom:4px;">How did it go?</p>
<p style="color:#666;margin-top:0;">{race_name}{location_suffix}</p>
{strava_card}
{recovery_block}
<p>Your feedback helps us improve your next plan — it takes 10 seconds.</p>
{cta}`;

const TEMPLATE_EVENING_NO_STRAVA = `
<p style="font-weight:700;font-size:18px;margin-bottom:4px;">How did it go?</p>
<p style="color:#666;margin-top:0;">{race_name}{location_suffix}</p>
{recovery_block}
<p>Your feedback helps us improve your next plan — it takes 10 seconds.</p>
{cta}`;

const TEMPLATE_POSTRACE = `
<p style="font-weight:700;font-size:18px;margin-bottom:4px;">Your race recap</p>
<p style="color:#666;margin-top:0;">{race_name}{location_suffix}</p>
{strava_card}
{recap_message}
{cta}`;

function getEveningEmailHtml(vars: any): string {
  if (!vars.has_strava) {
    return replaceVars(TEMPLATE_EVENING_NO_STRAVA, vars);
  }
  if (vars.show_comparison) {
    return replaceVars(TEMPLATE_EVENING_WITH_COMPARISON, vars);
  }
  return replaceVars(TEMPLATE_EVENING_NO_COMPARISON, vars);
}

// ── Email rendering ──

const SUBJECTS: Record<ReminderType, string> = {
  "30day": "30 days to {race_name} — start planning",
  "14day": "2 weeks to {race_name}",
  "7day": "Your race is next week — {race_name}",
  "2day": "Race in 2 days — {race_name}",
  "raceday": "Race day — {race_name}",
  "evening": "How did it go? — {race_name}",
  "postrace": "Your race recap — {race_name}",
};

function renderEmail(type: ReminderType, v: TemplateVars): { subject: string; html: string } {
  const hasPlan = v.pre_water > 0 || v.during_water_per_hr > 0;
  const year = new Date().getFullYear();
  const locationSuffix = v.race_location ? ` in ${v.race_location}` : "";

  // Pre-render blocks
  const planCardHtml = hasPlan ? replaceVars(PLAN_CARD, v) : "";
  const stravaCardHtml = v.has_strava ? replaceVars(STRAVA_CARD, v) : "";
  const ctaReview = replaceVars(CTA_TEMPLATE, { cta_href: BASE_URL, cta_label: hasPlan ? "Review your plan" : "Generate your plan" });
  const ctaFeedback = replaceVars(CTA_TEMPLATE, { cta_href: `${BASE_URL}/account`, cta_label: "Submit race feedback" });
  const ctaOpen = replaceVars(CTA_TEMPLATE, { cta_href: BASE_URL, cta_label: "Open your plan" });

  const recoveryBlock = hasPlan
    ? `<p>Your recovery protocol:</p><div style="padding:12px;background:#f5f5f5;border-radius:8px;font-size:14px;"><strong>After:</strong> ${escapeHtml(v.post_water)}ml + ${escapeHtml(v.post_sachets)} sachet${v.post_sachets !== 1 ? "s" : ""}, ${escapeHtml(String(v.post_timing).toLowerCase())}</div>`
    : `<p>Drink 500-750ml of water with electrolytes within 30 minutes. Continue hydrating through the evening.</p>`;

  const recapMessage = hasPlan
    ? `<p>You raced with a personalized hydration plan. Tell us how it worked — we'll use your feedback to make the next one even better.</p>`
    : `<p>Now that you have race experience, your next plan will be more accurate. Share your feedback to personalize it.</p>`;

  // Computed vars merged with template vars
  const merged = {
    ...v,
    year,
    location_suffix: locationSuffix,
    plan_card: planCardHtml,
    strava_card: stravaCardHtml,
    recovery_block: recoveryBlock,
    recap_message: recapMessage,
  };

  let template: string;
  let cta: string;

  switch (type) {
    case "30day":
      template = TEMPLATE_30DAY;
      cta = ctaReview;
      break;
    case "14day":
      merged.plan_message = hasPlan
        ? "Review your plan and adjust if conditions have changed."
        : "There's still time to generate a personalized hydration plan.";
      template = TEMPLATE_14DAY;
      cta = ctaReview;
      break;
    case "7day":
      merged.no_plan_nudge = !hasPlan
        ? `<p>You don't have a plan yet — generate one now. It takes 2 minutes.</p>`
        : "";
      template = TEMPLATE_7DAY;
      cta = ctaReview;
      break;
    case "2day":
      merged.plan_or_nudge = hasPlan
        ? planCardHtml
        : `<p>You don't have a plan yet. There's still time — generate one now.</p>`;
      template = TEMPLATE_2DAY;
      cta = ctaOpen;
      break;
    case "raceday":
      merged.plan_or_fallback = hasPlan
        ? planCardHtml
        : `<p style="font-size:14px;">General protocol: 500ml water + electrolytes 2h before. Sip 150ml every 15min during. 600ml + electrolytes within 30min after.</p>`;
      template = TEMPLATE_RACEDAY;
      cta = "";
      break;
    case "evening":
      merged.cta = ctaFeedback;
      const eveningBody = getEveningEmailHtml(merged);
      const eveningSubject = replaceVars(SUBJECTS[type], v);
      return { subject: eveningSubject, html: replaceVars(EMAIL_SHELL, { ...merged, body: eveningBody }) };
    case "postrace":
      template = TEMPLATE_POSTRACE;
      cta = ctaFeedback;
      break;
  }

  merged.cta = cta;
  const body = replaceVars(template, merged);
  const subject = replaceVars(SUBJECTS[type], v);
  const html = replaceVars(EMAIL_SHELL, { ...merged, body });

  return { subject, html };
}

// ── Build template variables ──

function buildTemplateVars(plan: any, profile: any, race: RaceRow): TemplateVars {
  const pre = plan?.preActivity || {};
  const during = plan?.duringActivity || {};
  const post = plan?.postActivity || {};
  const duration = profile?.sessionDuration || 0;

  return {
    race_name: race.race_name,
    distance: race.distance_km ? `${race.distance_km} km` : "—",
    duration: formatSeconds(duration * 3600),
    planned_duration: formatSeconds(duration * 3600),
    fluid_loss: plan?.totalFluidLoss ? (plan.totalFluidLoss / 1000).toFixed(1) : "—",
    race_location: race.location_city || "",

    pre_water: Math.round(pre.water || 0),
    pre_sachets: pre.electrolytes || 1,
    pre_timing: pre.timing || "2-4h before",

    during_water_per_hr: Math.round(during.waterPerHour || 0),
    during_sachets_per_hr: during.electrolytesPerHour || 0,
    during_sachets: during.totalElectrolytes || 0,
    during_total_water: Math.round((during.waterPerHour || 0) * duration),
    during_sip_amount: Math.round((during.waterPerHour || 0) / 4),
    during_frequency: during.frequency || "Every 15 minutes",

    post_water: Math.round(post.water || 0),
    post_water_half: Math.round((post.water || 0) * 0.5),
    post_sachets: post.electrolytes || 0,
    post_timing: post.timing || "Within 30 minutes",

    total_sachets: (pre.electrolytes || 0) + (during.totalElectrolytes || 0) + (post.electrolytes || 0),
    total_sachets_race_day: 2 + (pre.electrolytes || 0) + (during.totalElectrolytes || 0) + (post.electrolytes || 0),

    strava_finish_time: "",
    strava_avg_pace: "",
    has_strava: false,
    show_comparison: false,
  };
}

function replaceVars(html: string, vars: Record<string, any>): string {
  return html.replace(/\{(\w+)\}/g, (_, key) => {
    const val = vars[key];
    return val != null ? escapeHtml(String(val)) : "";
  });
}

// ── Send email via Resend ──

async function sendEmail(
  resendKey: string,
  from: string,
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Resend] ${res.status}: ${errText}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[Resend] Error:", e);
    return false;
  }
}

// ── Main handler ──

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!resendKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 503 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const fromAddress = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
    const from = fromAddress.includes("<") || fromAddress === "onboarding@resend.dev"
      ? fromAddress
      : `Supplme <${fromAddress}>`;

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const body = await req.json().catch(() => ({}));
    const batch = determineBatch(body, now.getUTCHours());
    const activeSchedule = SCHEDULE.filter((s) => s.batch === batch);

    const summary: Record<string, number> = {};
    let errors = 0;

    for (const entry of activeSchedule) {
      const targetDate = addDays(now, entry.daysOffset);

      // Query races for this target date that haven't received this reminder
      const { data: races, error: racesErr } = await supabase
        .from("athlete_races")
        .select("*")
        .eq("race_date", targetDate)
        .not("sent_reminders", "cs", JSON.stringify({ [entry.type]: "" }));

      if (racesErr || !races?.length) continue;

      // Filter out races that already have this reminder type in sent_reminders
      const eligibleRaces = (races as RaceRow[]).filter(
        (r) => !(r.sent_reminders && r.sent_reminders[entry.type])
      );
      if (eligibleRaces.length === 0) continue;

      // Batch-fetch related data
      const userIds = [...new Set(eligibleRaces.map((r) => r.user_id))];
      const planIds = [...new Set(eligibleRaces.map((r) => r.plan_id).filter(Boolean))] as string[];

      // Profiles (email + name)
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      // Hydration profiles (plan data)
      let planMap = new Map<string, any>();
      if (planIds.length > 0) {
        const { data: plans } = await supabase
          .from("hydration_profiles")
          .select("id, plan_data")
          .in("id", planIds);
        planMap = new Map((plans || []).map((p: any) => [p.id, p.plan_data]));
      }

      // Process each race
      let sentCount = 0;
      for (const race of eligibleRaces) {
        try {
          const profile = profileMap.get(race.user_id) as { email: string; full_name: string | null } | undefined;

          // Fall back to auth email if not in profiles table
          let email = profile?.email;
          if (!email) {
            const { data: userData } = await supabase.auth.admin.getUserById(race.user_id);
            email = userData?.user?.email;
          }
          if (!email) continue;

          // Get plan data
          const planData = race.plan_id ? planMap.get(race.plan_id) || null : null;

          // Strava (only for evening/postrace)
          let stravaActivity: StravaActivity | null = null;
          if (entry.needsStrava) {
            stravaActivity = await fetchStravaRaceActivity(supabase, race.user_id, race.race_date);
          }

          // Build and send email
          const vars = buildTemplateVars(planData, profile, race);
          if (stravaActivity) {
            vars.strava_finish_time = formatSeconds(stravaActivity.moving_time);
            vars.strava_avg_pace = formatPace(stravaActivity.distance, stravaActivity.moving_time, race.discipline);
            vars.has_strava = true;
          }
          const { subject, html } = renderEmail(entry.type, vars);
          const sent = await sendEmail(resendKey, from, email, subject, html);

          if (sent) {
            // Mark as sent atomically
            await supabase.rpc("mark_reminder_sent", {
              p_race_id: race.id,
              p_reminder_type: entry.type,
              p_sent_at: new Date().toISOString(),
            });
            sentCount++;
            console.log(`[Reminder] Sent ${entry.type} for race ${race.id} to ${email}`);
          } else {
            errors++;
          }
        } catch (raceErr) {
          console.error(`[Reminder] Error processing race ${race.id} (${entry.type}):`, raceErr);
          errors++;
        }
      }

      if (sentCount > 0) summary[entry.type] = sentCount;
    }

    return new Response(
      JSON.stringify({ success: true, batch, date: today, sent: summary, errors }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[send-race-reminders] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});
