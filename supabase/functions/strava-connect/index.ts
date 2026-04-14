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

// Strip activity to safe, needed fields (expanded for intelligence signals)
function stripActivity(a: any): Record<string, unknown> {
  return {
    id: a.id,
    sport_type: a.sport_type,
    type: a.type,
    moving_time: a.moving_time,
    elapsed_time: a.elapsed_time,
    distance: a.distance,
    total_elevation_gain: a.total_elevation_gain,
    average_heartrate: a.average_heartrate,
    max_heartrate: a.max_heartrate,
    average_speed: a.average_speed,
    max_speed: a.max_speed,
    start_date: a.start_date,
    start_date_local: a.start_date_local,
    name: a.name,
    average_watts: a.average_watts,
    weighted_average_watts: a.weighted_average_watts,
    kilojoules: a.kilojoules,
    average_cadence: a.average_cadence,
    suffer_score: a.suffer_score,
    perceived_exertion: a.perceived_exertion,
    workout_type: a.workout_type,
    pr_count: a.pr_count,
    calories: a.calories,
    start_latlng: a.start_latlng,
    average_temp: a.average_temp,
    has_heartrate: a.has_heartrate,
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

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

interface StravaIntelligence {
  hrIntensityPct?: number;
  vo2maxEstimate?: number;
  cardiacDriftScore?: number;
  raceRatio?: number;
  terrainIntensity?: number;
  heatActivityRatio?: number;
  trainingLoadTrend?: "building" | "maintaining" | "recovering";
  cyclingWPerKg?: number;
  runFitnessTier?: "beginner" | "intermediate" | "advanced" | "elite";
  avgSufferScore?: number;
  climateZone?: "cold" | "temperate" | "hot" | "tropical";
  longestActivityHours?: number;
}

function analyseStravaData(
  athlete: Record<string, unknown> | null,
  activities: Record<string, unknown>[]
): StravaIntelligence {
  const intel: StravaIntelligence = {};
  if (!activities.length) return intel;

  const weight = typeof athlete?.weight === "number" ? athlete.weight : null;

  // Collect metrics
  const avgHRs: number[] = [];
  const maxHRs: number[] = [];
  const sufferScores: number[] = [];
  const temps: number[] = [];
  const elevGains: number[] = [];
  const distances: number[] = [];
  const durations: number[] = [];
  const watts: number[] = [];
  const runSpeeds: number[] = [];
  let longestHours = 0;

  for (const a of activities) {
    const avgHR = a.average_heartrate as number;
    const maxHR = a.max_heartrate as number;
    if (typeof avgHR === "number" && avgHR > 60 && avgHR < 220) avgHRs.push(avgHR);
    if (typeof maxHR === "number" && maxHR > 100 && maxHR < 230) maxHRs.push(maxHR);

    const suffer = a.suffer_score as number;
    if (typeof suffer === "number" && suffer > 0) sufferScores.push(suffer);

    const temp = a.average_temp as number;
    if (typeof temp === "number" && temp > -20 && temp < 55) temps.push(temp);

    const elev = a.total_elevation_gain as number;
    const dist = a.distance as number;
    if (typeof elev === "number" && elev >= 0) elevGains.push(elev);
    if (typeof dist === "number" && dist > 0) distances.push(dist);

    const moving = a.moving_time as number;
    if (typeof moving === "number" && moving > 0) {
      const hours = moving / 3600;
      durations.push(hours);
      if (hours > longestHours) longestHours = hours;
    }

    const avgW = a.weighted_average_watts || a.average_watts;
    if (typeof avgW === "number" && avgW > 0) watts.push(avgW as number);

    const sport = (a.sport_type || a.type || "") as string;
    const mapped = SPORT_TO_DISCIPLINE[sport];
    if (mapped === "Running" && typeof (a.average_speed as number) === "number") {
      runSpeeds.push(a.average_speed as number);
    }
  }

  // 1. HR intensity as %HRmax
  if (avgHRs.length && maxHRs.length) {
    const estHRmax = Math.max(...maxHRs);
    const medianAvgHR = median(avgHRs);
    if (estHRmax > 100) {
      intel.hrIntensityPct = Math.round((medianAvgHR / estHRmax) * 100);
    }
  }

  // 2. VO2max estimation (Jack Daniels method for running)
  if (runSpeeds.length) {
    // average speed in m/s -> VO2 cost
    const avgRunSpeed = median(runSpeeds);
    const metersPerMin = avgRunSpeed * 60;
    // Simplified ACSM running VO2 equation: VO2 = 0.2 * speed(m/min) + 3.5
    const vo2 = 0.2 * metersPerMin + 3.5;
    if (vo2 > 20 && vo2 < 90) {
      intel.vo2maxEstimate = Math.round(vo2);
    }
  }

  // 3. Cardiac drift score (ratio of elapsed to moving time as proxy)
  const elapsedTimes = activities
    .map(a => a.elapsed_time as number)
    .filter(t => typeof t === "number" && t > 0);
  const movingTimes = activities
    .map(a => a.moving_time as number)
    .filter(t => typeof t === "number" && t > 0);
  if (elapsedTimes.length && movingTimes.length) {
    const avgElapsed = elapsedTimes.reduce((s, v) => s + v, 0) / elapsedTimes.length;
    const avgMoving = movingTimes.reduce((s, v) => s + v, 0) / movingTimes.length;
    if (avgMoving > 0) {
      intel.cardiacDriftScore = Math.round(((avgElapsed / avgMoving) - 1) * 100);
    }
  }

  // 4. Terrain intensity (elevation gain per distance)
  if (elevGains.length && distances.length) {
    const totalElev = elevGains.reduce((s, v) => s + v, 0);
    const totalDist = distances.reduce((s, v) => s + v, 0);
    if (totalDist > 0) {
      intel.terrainIntensity = Math.round((totalElev / (totalDist / 1000)) * 10) / 10; // m/km
    }
  }

  // 5. Heat activity ratio
  if (temps.length) {
    const hotActivities = temps.filter(t => t > 25).length;
    intel.heatActivityRatio = Math.round((hotActivities / temps.length) * 100) / 100;
  }

  // 6. Training load trend (compare first half vs second half of activities by duration)
  if (durations.length >= 4) {
    const mid = Math.floor(durations.length / 2);
    const firstHalf = durations.slice(0, mid).reduce((s, v) => s + v, 0) / mid;
    const secondHalf = durations.slice(mid).reduce((s, v) => s + v, 0) / (durations.length - mid);
    const ratio = secondHalf / firstHalf;
    if (ratio > 1.1) intel.trainingLoadTrend = "building";
    else if (ratio < 0.9) intel.trainingLoadTrend = "recovering";
    else intel.trainingLoadTrend = "maintaining";
  }

  // 7. Cycling W/kg
  if (watts.length && weight && weight > 0) {
    intel.cyclingWPerKg = Math.round((median(watts) / weight) * 100) / 100;
  }

  // 8. Run fitness tier
  if (runSpeeds.length) {
    const avgPaceMinPerKm = 1000 / (median(runSpeeds) * 60);
    if (avgPaceMinPerKm < 4) intel.runFitnessTier = "elite";
    else if (avgPaceMinPerKm < 5) intel.runFitnessTier = "advanced";
    else if (avgPaceMinPerKm < 6) intel.runFitnessTier = "intermediate";
    else intel.runFitnessTier = "beginner";
  }

  // 9. Suffer scores
  if (sufferScores.length) {
    intel.avgSufferScore = Math.round(median(sufferScores));
  }

  // 10. Climate zone inference
  if (temps.length) {
    const avgTemp = temps.reduce((s, v) => s + v, 0) / temps.length;
    if (avgTemp < 10) intel.climateZone = "cold";
    else if (avgTemp < 22) intel.climateZone = "temperate";
    else if (avgTemp < 30) intel.climateZone = "hot";
    else intel.climateZone = "tropical";
  }

  // 11. Longest activity
  if (longestHours > 0) {
    intel.longestActivityHours = Math.round(longestHours * 10) / 10;
  }

  return intel;
}

function mapStravaToPrefill(athlete: any, activities: any[]): {
  prefill: Record<string, unknown>;
  stravaIntelligence: StravaIntelligence;
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
  const hrByDiscipline: Record<string, { avg: number[]; max: number[]; speed: number[] }> = {};

  for (const a of strippedActivities) {
    const sport = (a.sport_type || a.type || "") as string;
    const mapped = SPORT_TO_DISCIPLINE[sport];
    if (mapped) disciplinesSet.add(mapped);

    const moving = a.moving_time as number;
    if (moving && moving > 0) durations.push(moving / 3600);

    if (mapped) {
      if (!hrByDiscipline[mapped]) hrByDiscipline[mapped] = { avg: [], max: [], speed: [] };

      const avgHR = typeof a.average_heartrate === "number" ? a.average_heartrate : null;
      if (avgHR && avgHR > 60 && avgHR < 220) hrByDiscipline[mapped].avg.push(avgHR);

      const maxHR = typeof a.max_heartrate === "number" ? a.max_heartrate : null;
      if (maxHR && maxHR > 100 && maxHR < 230) hrByDiscipline[mapped].max.push(maxHR);

      const speed = typeof a.average_speed === "number" ? a.average_speed : null;
      if (speed && speed > 0) hrByDiscipline[mapped].speed.push(speed);
    }
  }

  if (disciplinesSet.size > 0) {
    prefill.disciplines = Array.from(disciplinesSet);
  }
  if (durations.length > 0) {
    durations.sort((a, b) => a - b);
    const med = durations[Math.floor(durations.length / 2)];
    prefill.sessionDuration = Math.round(med * 10) / 10;
  }
  prefill.indoorOutdoor = "outdoor";

  // Build a compact HR profile per discipline (median avg HR, 90th-pct max HR, median speed)
  const hrProfile: Record<string, { average: number; max?: number; avgPaceMinPerKm?: number; avgSpeedKmh?: number }> = {};
  for (const [discipline, values] of Object.entries(hrByDiscipline)) {
    const entry: { average: number; max?: number; avgPaceMinPerKm?: number; avgSpeedKmh?: number } = { average: 0 };

    if (values.avg.length > 0) {
      values.avg.sort((a, b) => a - b);
      const medAvg = values.avg[Math.floor(values.avg.length / 2)];
      if (medAvg && isFinite(medAvg)) entry.average = Math.round(medAvg);
    }
    if (values.max.length > 0) {
      values.max.sort((a, b) => a - b);
      const p90idx = Math.floor(values.max.length * 0.90);
      const p90 = values.max[Math.min(p90idx, values.max.length - 1)];
      if (p90 && isFinite(p90)) entry.max = Math.round(p90);
    }
    if (values.speed.length > 0) {
      values.speed.sort((a, b) => a - b);
      const medianSpeed = values.speed[Math.floor(values.speed.length / 2)];
      if (medianSpeed && isFinite(medianSpeed) && medianSpeed > 0) {
        const speedKmh = medianSpeed * 3.6;
        entry.avgSpeedKmh = Math.round(speedKmh * 10) / 10;
        if (discipline === "Running") {
          const minPerKm = 60 / speedKmh;
          const mins = Math.floor(minPerKm);
          const secs = Math.round((minPerKm - mins) * 60);
          entry.avgPaceMinPerKm = Math.round(minPerKm * 100) / 100;
          (entry as any).avgPaceFormatted = `${mins}:${secs.toString().padStart(2, "0")}`;
        }
      }
    }

    if (entry.average > 0 || entry.max || entry.avgSpeedKmh) {
      hrProfile[discipline] = entry;
    }
  }
  if (Object.keys(hrProfile).length > 0) {
    prefill.hrProfile = hrProfile;
  }

  // Pipe pace/speed into top-level prefill fields for the calculator
  if ((hrProfile["Running"] as any)?.avgPaceFormatted) {
    prefill.avgPace = (hrProfile["Running"] as any).avgPaceFormatted;
    prefill.runPace = (hrProfile["Running"] as any).avgPaceFormatted;
  }
  if (hrProfile["Cycling"]?.avgSpeedKmh) {
    prefill.bikeSpeed = String(hrProfile["Cycling"].avgSpeedKmh);
  }

  // Compute Strava intelligence signals
  const stravaIntelligence = analyseStravaData(strippedAthlete, strippedActivities);

  return {
    prefill,
    stravaIntelligence,
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

    const { prefill, stravaIntelligence, strava_snapshot } = mapStravaToPrefill(athlete, activities);

    return new Response(
      JSON.stringify({ prefill, stravaIntelligence, strava_snapshot }),
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
