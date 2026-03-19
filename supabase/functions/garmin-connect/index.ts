import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getClientIP, checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const RATE_LIMIT_CONFIG = { windowMs: 60 * 1000, maxRequests: 20 };

const ALLOWED_REDIRECT_HOSTS = ['supplme.app', 'www.supplme.app'];

function isAllowedRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (ALLOWED_REDIRECT_HOSTS.includes(url.hostname)) return true;
    if (Deno.env.get('ENVIRONMENT') !== 'production') {
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true;
    }
  } catch {
    // invalid URL
  }
  return false;
}

// Map Garmin activity types to our discipline names
const GARMIN_SPORT_TO_DISCIPLINE: Record<string, string> = {
  RUNNING: "Running",
  TRAIL_RUNNING: "Running",
  TREADMILL_RUNNING: "Running",
  CYCLING: "Cycling",
  ROAD_BIKING: "Cycling",
  MOUNTAIN_BIKING: "Cycling",
  INDOOR_CYCLING: "Cycling",
  LAP_SWIMMING: "Swimming",
  OPEN_WATER_SWIMMING: "Swimming",
  POOL_SWIMMING: "Swimming",
  HIKING: "Hiking",
  WALKING: "Walking",
  STRENGTH_TRAINING: "Weight training",
  YOGA: "Yoga",
  TRIATHLON: "Triathlon",
  ROWING: "Rowing",
  INDOOR_ROWING: "Rowing",
  SKIING: "Skiing",
  CROSS_COUNTRY_SKIING: "Skiing",
  SNOWBOARDING: "Snowboarding",
  SURFING: "Surfing",
  GOLF: "Golf",
  ROCK_CLIMBING: "Climbing",
  KAYAKING: "Kayaking",
  STAND_UP_PADDLEBOARDING: "SUP",
};

function mapGarminToPrefill(
  activities: any[],
  bodyComps: any[],
  dailies: any[],
): {
  prefill: Record<string, unknown>;
} {
  const prefill: Record<string, unknown> = {};

  // --- Activities: disciplines, duration, HR ---
  const disciplinesSet = new Set<string>();
  const durations: number[] = [];
  const hrByDiscipline: Record<string, number[]> = {};

  for (const a of activities) {
    const sport = (a.activityType || "") as string;
    const mapped = GARMIN_SPORT_TO_DISCIPLINE[sport] || null;
    if (mapped) disciplinesSet.add(mapped);

    const durationSec = a.durationInSeconds || a.duration || 0;
    if (durationSec > 0) durations.push(durationSec / 3600);

    const avgHR = typeof a.averageHeartRateInBeatsPerMinute === "number"
      ? a.averageHeartRateInBeatsPerMinute
      : null;
    if (avgHR && avgHR > 60 && avgHR < 220 && mapped) {
      if (!hrByDiscipline[mapped]) hrByDiscipline[mapped] = [];
      hrByDiscipline[mapped].push(avgHR);
    }
  }

  if (disciplinesSet.size > 0) {
    prefill.disciplines = Array.from(disciplinesSet);
  }
  if (durations.length > 0) {
    durations.sort((a, b) => a - b);
    const median = durations[Math.floor(durations.length / 2)];
    prefill.sessionDuration = Math.round(median * 10) / 10;
  }
  prefill.indoorOutdoor = "outdoor";

  const hrProfile: Record<string, { average: number }> = {};
  for (const [discipline, values] of Object.entries(hrByDiscipline)) {
    if (!values.length) continue;
    values.sort((a, b) => a - b);
    const median = values[Math.floor(values.length / 2)];
    if (median && isFinite(median)) {
      hrProfile[discipline] = { average: Math.round(median) };
    }
  }
  if (Object.keys(hrProfile).length > 0) {
    prefill.hrProfile = hrProfile;
  }

  // --- Body Compositions: weight, body fat ---
  if (bodyComps.length > 0) {
    // Use most recent body composition
    const latest = bodyComps[0];
    const weightGrams = latest.weightInGrams;
    if (typeof weightGrams === "number" && weightGrams > 0) {
      prefill.weight = Math.round(weightGrams / 10) / 100; // grams → kg, 1 decimal
    }
    const bodyFat = latest.bodyFatPercentage;
    if (typeof bodyFat === "number" && bodyFat > 0 && bodyFat < 60) {
      prefill.bodyFat = Math.round(bodyFat * 10) / 10;
    }
  }

  // --- Dailies: resting HR, sleep ---
  if (dailies.length > 0) {
    const restingHRs: number[] = [];
    const sleepDurations: number[] = [];

    for (const d of dailies) {
      const rhr = d.restingHeartRateInBeatsPerMinute;
      if (typeof rhr === "number" && rhr > 30 && rhr < 120) {
        restingHRs.push(rhr);
      }
      const sleepSec = d.sleepDurationInSeconds;
      if (typeof sleepSec === "number" && sleepSec > 0) {
        sleepDurations.push(sleepSec / 3600);
      }
    }

    if (restingHRs.length > 0) {
      restingHRs.sort((a, b) => a - b);
      prefill.restingHeartRate = Math.round(restingHRs[Math.floor(restingHRs.length / 2)]);
    }

    if (sleepDurations.length > 0) {
      sleepDurations.sort((a, b) => a - b);
      prefill.sleepHours = Math.round(sleepDurations[Math.floor(sleepDurations.length / 2)] * 10) / 10;
    }
  }

  return { prefill };
}

function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey);
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Override to allow GET for polling
  corsHeaders['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIP = getClientIP(req);
  const rateLimit = checkRateLimit(clientIP, RATE_LIMIT_CONFIG);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetIn, corsHeaders);
  }

  // Handle polling for activity data
  if (req.method === "GET") {
    const url = new URL(req.url);
    const poll = url.searchParams.get("poll");
    const connectionId = url.searchParams.get("connectionId");

    if (poll === "true" && connectionId) {
      try {
        const sb = getSupabaseClient();

        // Look up the connection to get garmin_user_id
        const { data: conn, error: connErr } = await sb
          .from("garmin_connections")
          .select("garmin_user_id")
          .eq("id", connectionId)
          .single();

        if (connErr || !conn) {
          return new Response(
            JSON.stringify({ error: "Connection not found" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
          );
        }

        // Query all data types
        const { data: allData, error: dataErr } = await sb
          .from("garmin_activities")
          .select("activity_data, data_type")
          .eq("garmin_user_id", conn.garmin_user_id)
          .order("received_at", { ascending: false })
          .limit(100);

        if (dataErr || !allData || allData.length === 0) {
          return new Response(
            JSON.stringify({ pending: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }

        // Split by data type
        const activityData = allData
          .filter((r: any) => r.data_type === "activity" || r.data_type === "activity_detail")
          .map((r: any) => r.activity_data);
        const bodyCompData = allData
          .filter((r: any) => r.data_type === "body_composition")
          .map((r: any) => r.activity_data);
        const dailyData = allData
          .filter((r: any) => r.data_type === "daily")
          .map((r: any) => r.activity_data);

        const { prefill } = mapGarminToPrefill(activityData, bodyCompData, dailyData);

        return new Response(
          JSON.stringify({ prefill, garmin_snapshot: { activities: activityData, bodyComps: bodyCompData, dailies: dailyData } }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      } catch (e) {
        console.error("[Garmin] Poll error:", e);
        return new Response(
          JSON.stringify({ pending: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Invalid request" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 405 }
    );
  }

  try {
    const body = await req.json();
    const code = body?.code;
    const redirect_uri = body?.redirect_uri;
    const code_verifier = body?.code_verifier;

    if (!code || !redirect_uri || !code_verifier) {
      return new Response(
        JSON.stringify({ error: "Missing code, redirect_uri, or code_verifier" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (!isAllowedRedirectUri(redirect_uri)) {
      console.warn(`[Garmin] Rejected redirect_uri: ${redirect_uri}`);
      return new Response(
        JSON.stringify({ error: "Invalid redirect_uri" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const clientId = Deno.env.get("GARMIN_CLIENT_ID");
    const clientSecret = Deno.env.get("GARMIN_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      console.error("[Garmin] Missing GARMIN_CLIENT_ID or GARMIN_CLIENT_SECRET");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Exchange authorization code for tokens (PKCE flow)
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier,
      redirect_uri,
    });

    const tokenRes = await fetch("https://diauth.garmin.com/di-oauth2-service/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[Garmin] Token exchange failed:", tokenRes.status, errText);
      let userMessage = "Garmin authorization failed. Please try connecting again.";
      try {
        const errJson = JSON.parse(errText);
        const msg = errJson?.error_description ?? errJson?.error;
        if (msg) userMessage = `Garmin: ${msg}`;
      } catch {
        // use default
      }
      return new Response(
        JSON.stringify({ error: userMessage }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const tokens = await tokenRes.json();
    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Invalid response from Garmin" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 }
      );
    }

    // Fetch user ID
    const userIdRes = await fetch("https://apis.garmin.com/wellness-api/rest/user/id", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let garminUserId: string | null = null;
    if (userIdRes.ok) {
      const userData = await userIdRes.json();
      garminUserId = userData?.userId || null;
    }

    if (!garminUserId) {
      console.error("[Garmin] Could not fetch user ID");
      return new Response(
        JSON.stringify({ error: "Could not retrieve Garmin user ID" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 }
      );
    }

    // Fetch permissions
    let permissions: string[] = [];
    try {
      const permRes = await fetch("https://apis.garmin.com/wellness-api/rest/user/permissions", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (permRes.ok) {
        const permData = await permRes.json();
        permissions = Array.isArray(permData) ? permData : [];
      }
    } catch {
      // Non-critical, continue
    }

    // Store connection in database
    const sb = getSupabaseClient();
    const sessionId = crypto.randomUUID();

    const { data: connData, error: connErr } = await sb
      .from("garmin_connections")
      .insert({
        garmin_user_id: garminUserId,
        access_token: accessToken,
        refresh_token: refreshToken || null,
        session_id: sessionId,
      })
      .select("id")
      .single();

    if (connErr) {
      console.error("[Garmin] Failed to store connection:", connErr);
      return new Response(
        JSON.stringify({ error: "Failed to save connection" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Request historical backfill (last 90 days)
    const now = Math.floor(Date.now() / 1000);
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60);
    try {
      const backfillRes = await fetch(
        `https://apis.garmin.com/wellness-api/rest/backfill/activities?summaryStartTimeInSeconds=${ninetyDaysAgo}&summaryEndTimeInSeconds=${now}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (import.meta.env?.DEV || true) {
        console.log("[Garmin] Backfill request status:", backfillRes.status);
      }
    } catch (e) {
      console.warn("[Garmin] Backfill request failed (non-critical):", e);
    }

    return new Response(
      JSON.stringify({
        garmin_snapshot: { userId: garminUserId, permissions },
        connectionId: connData.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    console.error("[Garmin] Error:", e);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
