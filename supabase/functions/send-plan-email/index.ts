// Send hydration plan as HTML email. Requires Resend: set RESEND_API_KEY in Supabase Edge Function secrets.
// Optional: RESEND_FROM_EMAIL (e.g. hydration@yourdomain.com); default is onboarding@resend.dev for testing.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getClientIP, checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const RATE_LIMIT_CONFIG = { windowMs: 60 * 1000, maxRequests: 5 };

// Escape HTML to prevent XSS in email templates
function escapeHtml(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Request validation schema
const requestSchema = z.object({
  toEmail: z.string().email().max(255),
  plan: z.object({
    preActivity: z.object({
      water: z.number().optional(),
      electrolytes: z.union([z.number(), z.string()]).optional(),
      timing: z.string().optional(),
    }).passthrough().optional(),
    duringActivity: z.object({
      waterPerHour: z.number().optional(),
      electrolytesPerHour: z.union([z.number(), z.string()]).nullable().optional(),
      frequency: z.string().optional(),
    }).passthrough().optional(),
    postActivity: z.object({
      water: z.number().nullable().optional(),
      electrolytes: z.union([z.number(), z.string()]).nullable().optional(),
      timing: z.string().optional(),
    }).passthrough().optional(),
    totalFluidLoss: z.number().nullable().optional(),
  }),
  profile: z.object({
    sessionDuration: z.number().optional(),
    disciplines: z.array(z.string()).optional(),
    raceDistance: z.string().optional(),
  }).passthrough().optional(),
});

function raceDistanceToKm(raceDistance: string | undefined): string {
  if (!raceDistance) return "Not specified";
  const raceText = (raceDistance || "").toLowerCase();
  const map: Record<string, number> = {
    "half ironman": 113, "ironman 70.3": 113, "70.3": 113,
    "ironman": 226, "full ironman": 226, "140.6": 226,
    "olympic": 51.5, "sprint": 25.75, "half marathon": 21.1, "marathon": 42.2,
    "ultra": 50, "50k": 50, "100k": 100, "100 mile": 160, "100 miles": 160,
    "10k": 10, "5k": 5, "century": 160,
  };
  for (const [name, dist] of Object.entries(map)) {
    if (raceText.includes(name)) return `${dist} km`;
  }
  const match = raceDistance.match(/(\d+\.?\d*)/);
  return match ? `${match[1]} km` : escapeHtml(raceDistance);
}

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function buildPlanHtml(plan: any, profile: any): string {
  const pre = plan?.preActivity || {};
  const during = plan?.duringActivity || {};
  const post = plan?.postActivity || {};
  const duration = typeof profile?.sessionDuration === "number" ? profile.sessionDuration : 1;
  const disciplines = Array.isArray(profile?.disciplines)
    ? profile.disciplines.map((d: string) => escapeHtml(d)).join(" + ")
    : "—";
  const distance = raceDistanceToKm(profile?.raceDistance);
  const totalWaterDuring = Math.round((during.waterPerHour || 0) * duration);
  const totalDuringSachets = duration >= 2 && during.electrolytesPerHour
    ? Math.round((during.electrolytesPerHour || 0) * Math.max(0, duration - 0.5))
    : 0;
  const fluidLossL = plan?.totalFluidLoss != null
    ? (Math.round(plan.totalFluidLoss / 1000 * 10) / 10).toFixed(1)
    : "—";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your Hydration Plan</title></head>
<body style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 1.5rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0;">Your Elite Plan</h1>
  <p style="color: #666; margin-top: 4px; margin-bottom: 20px;">Your personalized hydration strategy</p>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #f5f5f5; border-radius: 8px; padding: 12px;">
    <tr><td style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #666;">Activity</td><td style="padding: 8px 12px; font-weight: 600;">${disciplines}</td></tr>
    <tr><td style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #666;">Distance</td><td style="padding: 8px 12px; font-weight: 600;">${escapeHtml(distance)}</td></tr>
    <tr><td style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #666;">Duration</td><td style="padding: 8px 12px; font-weight: 600;">${escapeHtml(formatDuration(duration))}</td></tr>
    <tr><td style="padding: 8px 12px; font-size: 11px; text-transform: uppercase; color: #666;">Total fluid loss</td><td style="padding: 8px 12px; font-weight: 700;">${escapeHtml(fluidLossL)} L</td></tr>
  </table>

  <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px;">
    <div style="flex: 1; min-width: 140px; padding: 16px; border-radius: 8px; border-left: 4px solid #22c55e; background: #f0fdf4;">
      <p style="font-size: 11px; text-transform: uppercase; color: #666; margin: 0 0 4px 0;">${escapeHtml(pre.timing || "2–4h before")}</p>
      <p style="font-weight: 700; margin: 0 0 8px 0;">Pre</p>
      <p style="font-size: 14px; margin: 0;">${Math.round(pre.water ?? 0)} ml · ${escapeHtml(pre.electrolytes ?? 0)}× sachet(s)</p>
    </div>
    <div style="flex: 1; min-width: 140px; padding: 16px; border-radius: 8px; background: #f5f5f5;">
      <p style="font-size: 11px; text-transform: uppercase; color: #666; margin: 0 0 4px 0;">${escapeHtml(during.frequency || "Every 12–15 min")}</p>
      <p style="font-weight: 700; margin: 0 0 8px 0;">During</p>
      <p style="font-size: 14px; margin: 0;">${Math.round(during.waterPerHour ?? 0)} ml/hr · ${totalWaterDuring} ml total · ${escapeHtml(during.electrolytesPerHour ?? 0)} sachet/hr (${totalDuringSachets} total)</p>
    </div>
    <div style="flex: 1; min-width: 140px; padding: 16px; border-radius: 8px; border-left: 4px solid #dc2626; background: #fef2f2;">
      <p style="font-size: 11px; text-transform: uppercase; color: #666; margin: 0 0 4px 0;">${escapeHtml(post.timing ?? "Within 30 min")}</p>
      <p style="font-weight: 700; margin: 0 0 8px 0;">Post</p>
      <p style="font-size: 14px; margin: 0;">${Math.round(post.water ?? 0)} ml · ${escapeHtml(post.electrolytes ?? 0)}× sachet(s)</p>
    </div>
  </div>

  <p style="font-size: 12px; color: #666; margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee;">
    This plan was generated by the Supplme Hydration Guide. It is for educational purposes only and not a substitute for professional medical or nutrition advice. Consult a qualified professional before changing your hydration strategy.
  </p>
  <p style="font-size: 11px; color: #999; margin-top: 8px;">© ${new Date().getFullYear()} Supplme. All rights reserved.</p>
</body>
</html>`;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = getClientIP(req);
  const rateLimit = checkRateLimit(clientIP, RATE_LIMIT_CONFIG);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetIn, corsHeaders);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Email service not configured. Set RESEND_API_KEY in Supabase Edge Function secrets.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 503 }
    );
  }

  try {
    const body = await req.json();

    // Validate with Zod
    const validationResult = requestSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing or invalid toEmail or plan." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { toEmail, plan, profile } = validationResult.data;

    const html = buildPlanHtml(plan, profile || {});
    const fromAddress = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
    const from = fromAddress.includes("<") || fromAddress === "onboarding@resend.dev"
      ? fromAddress
      : `Supplme Hydration <${fromAddress}>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [toEmail],
        subject: "Your Supplme Hydration Plan",
        html,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("Resend API error:", res.status, data);
      return new Response(
        JSON.stringify({
          success: false,
          error: data?.message || "Failed to send email.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 }
      );
    }

    return new Response(
      JSON.stringify({ success: true, id: data?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    console.error("send-plan-email error:", e);
    return new Response(
      JSON.stringify({ success: false, error: "Server error." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
