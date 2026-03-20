import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getClientIP, checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const RATE_LIMIT_CONFIG = { windowMs: 60 * 1000, maxRequests: 20 };

// Allowed redirect_uri hosts
const ALLOWED_REDIRECT_HOSTS = ['supplme.app', 'www.supplme.app'];

function isAllowedRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (ALLOWED_REDIRECT_HOSTS.includes(url.hostname)) return true;
    // Allow localhost in non-production
    if (Deno.env.get('ENVIRONMENT') !== 'production') {
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true;
    }
  } catch {
    // invalid URL
  }
  return false;
}

// Map Strava sport_type to our discipline names
const SPORT_TO_DISCIPLINE: Record<string, string> = {
  Run: "Running",
  VirtualRun: "Running",
  Ride: "Cycling",
  VirtualRide: "Cycling",
  Swim: "Swimming",
  Hike: "Hiking",
  Walk: "Walking",
  AlpineSki: "Skiing",
  BackcountrySki: "Skiing",
  Canoeing: "Canoeing",
  Crossfit: "Crossfit",
  EBikeRide: "Cycling",
  Elliptical: "Elliptical",
  Golf: "Golf",
  Handcycle: "Cycling",
  IceSkate: "Ice skating",
  InlineSkate: "Inline skating",
  Kayaking: "Kayaking",
  Kitesurf: "Kitesurfing",
  NordicSki: "Skiing",
  RockClimbing: "Climbing",
  RollerSki: "Skiing",
  Rowing: "Rowing",
  Sail: "Sailing",
  Skateboard: "Skateboarding",
  Snowboard: "Snowboarding",
  Snowshoe: "Snowshoeing",
  Soccer: "Football",
  StairStepper: "Stairs",
  StandUpPaddling: "SUP",
  Surfing: "Surfing",
  Velomobile: "Cycling",
  WeightTraining: "Weight training",
  Windsurf: "Windsurfing",
  Workout: "Workout",
  Yoga: "Yoga",
  Triathlon: "Triathlon",
  HighIntensityIntervalTraining: "HIIT",
  MountainBikeRide: "Cycling",
  GravelRide: "Cycling",
  TrailRun: "Running",
  Tennis: "Tennis",
  Pickleball: "Pickleball",
  Badminton: "Badminton",
  TableTennis: "Table tennis",
  Squash: "Squash",
  Padel: "Padel",
};

// Strip activity to only safe, needed fields
function stripActivity(a: any): Record<string, unknown> {
  return {
    id: a.id,
    sport_type: a.sport_type,
    type: a.type,
    moving_time: a.moving_time,
    distance: a.distance,
    total_elevation_gain: a.total_elevation_gain,
    average_heartrate: a.average_heartrate,
    max_heartrate: a.max_heartrate,
    average_speed: a.average_speed,
    start_date: a.start_date,
    start_date_local: a.start_date_local,
    name: a.name,
  };
}

// Strip athlete to only needed fields
function stripAthlete(athlete: any): Record<string, unknown> | null {
  if (!athlete) return null;
  return {
    weight: athlete.weight,
    sex: athlete.sex,
    firstname: athlete.firstname,
    lastname: athlete.lastname,
  };
}

function mapStravaToPrefill(athlete: any, activities: any[]): {
  prefill: Record<string, unknown>;
  strava_snapshot: { athlete: any; activities: any[] };
} {
  const prefill: Record<string, unknown> = {};
  const strippedAthlete = stripAthlete(athlete);

  if (strippedAthlete) {
    if (strippedAthlete.weight != null) prefill.weight = strippedAthlete.weight;
    if (athlete.sex === "M") prefill.sex = "male";
    else if (athlete.sex === "F") prefill.sex = "female";
    const name = [strippedAthlete.firstname, strippedAthlete.lastname].filter(Boolean).join(" ");
    if (name) prefill.fullName = name;
  }

  const strippedActivities = (activities || []).map(stripActivity);

  const disciplinesSet = new Set<string>();
  const durations: number[] = [];
  const hrByDiscipline: Record<string, number[]> = {};

  for (const a of strippedActivities) {
    const sport = (a.sport_type || a.type || "") as string;
    const mapped = SPORT_TO_DISCIPLINE[sport];
    if (mapped) disciplinesSet.add(mapped);

    const moving = a.moving_time as number;
    if (moving && moving > 0) durations.push(moving / 3600);

    const avgHR = typeof a.average_heartrate === "number" ? a.average_heartrate : null;
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

  // Build a compact HR profile per discipline (median average HR)
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

  return {
    prefill,
    strava_snapshot: { athlete: strippedAthlete, activities: strippedActivities },
  };
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
    if (!code || !redirect_uri) {
      return new Response(
        JSON.stringify({ error: "Missing code or redirect_uri" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Validate redirect_uri against whitelist
    if (!isAllowedRedirectUri(redirect_uri)) {
      console.warn(`[Strava] Rejected redirect_uri: ${redirect_uri}`);
      return new Response(
        JSON.stringify({ error: "Invalid redirect_uri" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const clientId = Deno.env.get("STRAVA_CLIENT_ID");
    const clientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      console.error("[Strava] Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const tokenBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    });
    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[Strava] Token exchange failed:", tokenRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Strava authorization failed. Please try connecting again." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const tokens = await tokenRes.json();
    const accessToken = tokens.access_token;
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Invalid response from Strava" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 502 }
      );
    }

    // Use athlete from token response (already included by Strava).
    // With profile:read_all scope, the token response includes weight.
    // Fall back to a separate /athlete call only if missing.
    let athlete = tokens.athlete || null;
    if (!athlete) {
      const athleteRes = await fetch("https://www.strava.com/api/v3/athlete", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      athlete = athleteRes.ok ? await athleteRes.json() : null;
    }

    const activitiesRes = await fetch("https://www.strava.com/api/v3/athlete/activities?per_page=30", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const activitiesRaw = activitiesRes.ok ? await activitiesRes.json() : [];
    const activities = Array.isArray(activitiesRaw) ? activitiesRaw : [];

    const { prefill, strava_snapshot } = mapStravaToPrefill(athlete, activities);

    return new Response(
      JSON.stringify({ prefill, strava_snapshot }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    console.error("[Strava] Error:", e);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
