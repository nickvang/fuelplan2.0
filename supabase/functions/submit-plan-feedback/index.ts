import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getClientIP, checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

const RATE_LIMIT_CONFIG = { windowMs: 60 * 1000, maxRequests: 10 };
const ALPHA = 0.08; // Bayesian learning rate
const MIN_COEFF = 0.65;
const MAX_COEFF = 1.35;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Bayesian update: coefficient = old * (1 - alpha) + target * alpha
 * Target is derived from feedback direction:
 *   "too_much"  -> reduce (target = old * 0.85)
 *   "just_right" -> maintain (target = old)
 *   "too_little" -> increase (target = old * 1.15)
 */
function updateCoefficient(current: number, feedback: string): number {
  let target = current;
  if (feedback === "too_much") target = current * 0.85;
  else if (feedback === "too_little") target = current * 1.15;
  const updated = current * (1 - ALPHA) + target * ALPHA;
  return clamp(Math.round(updated * 1000) / 1000, MIN_COEFF, MAX_COEFF);
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

    // Extract feedback fields
    const {
      user_id,
      sweat_feedback,    // "too_much" | "just_right" | "too_little"
      sodium_feedback,   // "too_much" | "just_right" | "too_little"
      water_feedback,    // "too_much" | "just_right" | "too_little"
      pre_water_feedback, // "too_much" | "just_right" | "too_little"
      condition,         // optional: e.g. "cramping"
      condition_outcome, // optional: "better" | "same" | "worse"
    } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "Missing user_id" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const validFeedback = ["too_much", "just_right", "too_little"];
    for (const [key, val] of Object.entries({ sweat_feedback, sodium_feedback, water_feedback, pre_water_feedback })) {
      if (val && !validFeedback.includes(val as string)) {
        return new Response(
          JSON.stringify({ error: `Invalid ${key}: ${val}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get or create calibration record
    const { data: existing } = await supabase
      .from("athlete_calibration")
      .select("*")
      .eq("user_id", user_id)
      .single();

    let sweat_coefficient = existing?.sweat_coefficient ?? 1.0;
    let sodium_coefficient = existing?.sodium_coefficient ?? 1.0;
    let water_coefficient = existing?.water_coefficient ?? 1.0;
    let pre_water_coefficient = existing?.pre_water_coefficient ?? 1.0;
    let total_feedback_count = existing?.total_feedback_count ?? 0;
    const condition_outcomes = existing?.condition_outcomes ?? {};

    // Apply Bayesian updates
    if (sweat_feedback) sweat_coefficient = updateCoefficient(sweat_coefficient, sweat_feedback);
    if (sodium_feedback) sodium_coefficient = updateCoefficient(sodium_coefficient, sodium_feedback);
    if (water_feedback) water_coefficient = updateCoefficient(water_coefficient, water_feedback);
    if (pre_water_feedback) pre_water_coefficient = updateCoefficient(pre_water_coefficient, pre_water_feedback);

    total_feedback_count += 1;

    // Track condition-specific outcomes
    if (condition && condition_outcome) {
      if (!condition_outcomes[condition]) {
        condition_outcomes[condition] = { better: 0, same: 0, worse: 0 };
      }
      if (condition_outcome in condition_outcomes[condition]) {
        condition_outcomes[condition][condition_outcome] += 1;
      }
    }

    // Upsert calibration record
    const { error: upsertError } = await supabase
      .from("athlete_calibration")
      .upsert({
        user_id,
        sweat_coefficient,
        sodium_coefficient,
        water_coefficient,
        pre_water_coefficient,
        total_feedback_count,
        condition_outcomes,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertError) {
      console.error("[Feedback] Upsert failed:", upsertError);
      return new Response(
        JSON.stringify({ error: "Failed to save feedback" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        calibration: {
          sweat_coefficient,
          sodium_coefficient,
          water_coefficient,
          pre_water_coefficient,
          total_feedback_count,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    console.error("[Feedback] Error:", e);
    return new Response(
      JSON.stringify({ error: "Something went wrong" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
