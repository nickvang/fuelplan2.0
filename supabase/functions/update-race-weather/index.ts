// update-race-weather: Runs daily (cron). For races 3 days away with lat/lng:
// 1. Fetches weather forecast from Open-Meteo (free, no API key)
// 2. Compares with plan's trainingTempRange
// 3. If delta > 5°C: regenerates plan with updated temp, saves new plan, links to race
// 4. Emails athlete about the weather update
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

function escapeHtml(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface ForecastResult {
  tempMin: number;
  tempMax: number;
  humidity: number;
}

async function fetchForecast(lat: number, lng: number, date: string): Promise<ForecastResult | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean&start_date=${date}&end_date=${date}&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const daily = data?.daily;
    if (!daily?.temperature_2m_max?.[0] || !daily?.temperature_2m_min?.[0]) return null;
    return {
      tempMin: daily.temperature_2m_min[0],
      tempMax: daily.temperature_2m_max[0],
      humidity: daily.relative_humidity_2m_mean?.[0] ?? 50,
    };
  } catch {
    return null;
  }
}

function buildWeatherEmail(
  raceName: string,
  forecastMax: number,
  oldMax: number,
  locationCity: string | null
): { subject: string; html: string } {
  const name = escapeHtml(raceName);
  const loc = locationCity ? ` in ${escapeHtml(locationCity)}` : "";
  const delta = forecastMax - oldMax;
  const direction = delta > 0 ? "warmer" : "cooler";

  return {
    subject: `Weather update for ${raceName} — ${Math.round(forecastMax)}°C forecast`,
    html: `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#1a1a1a;max-width:480px;margin:0 auto;padding:24px;">
  <p style="font-weight:700;font-size:18px;margin-bottom:4px;">Weather update</p>
  <p style="color:#666;margin-top:0;">${name}${loc} is now forecast at <strong>${Math.round(forecastMax)}°C</strong>.</p>
  <p>Your plan assumed ${Math.round(oldMax)}°C — it's ${Math.abs(Math.round(delta))}°C ${direction} than expected.</p>
  <p style="padding:12px;background:#f5f5f5;border-radius:8px;font-size:14px;font-weight:600;">We've automatically updated your hydration plan with the new conditions.</p>
  <p><a href="https://fuelplan.supplme.dk" style="display:inline-block;padding:10px 20px;background:#0a0a0a;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">View updated plan</a></p>
  <p style="font-size:11px;color:#999;margin-top:24px;border-top:1px solid #eee;padding-top:12px;">You're receiving this because you added ${name} to your race calendar on Supplme. To stop, remove the race from your calendar at fuelplan.supplme.dk.</p>
  <p style="font-size:10px;color:#ccc;">© ${new Date().getFullYear()} Supplme</p>
</body></html>`,
  };
}

serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find races 3 days from now with lat/lng
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    const dateStr = targetDate.toISOString().split("T")[0];

    const { data: races, error: racesError } = await supabase
      .from("athlete_races")
      .select("*")
      .eq("race_date", dateStr)
      .eq("status", "upcoming")
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (racesError || !races?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "No races 3 days out with coordinates", updated: 0 }),
        { headers: { "Content-Type": "application/json" }, status: 200 }
      );
    }

    const fromAddress = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
    const from = fromAddress.includes("<") || fromAddress === "onboarding@resend.dev"
      ? fromAddress
      : `Supplme <${fromAddress}>`;

    let updated = 0;

    for (const race of races) {
      const lat = Number(race.latitude);
      const lng = Number(race.longitude);
      if (isNaN(lat) || isNaN(lng)) continue;

      // Fetch forecast
      const forecast = await fetchForecast(lat, lng, dateStr);
      if (!forecast) {
        console.log(`[Weather] No forecast for race ${race.id}`);
        continue;
      }

      // Get existing plan's temp range
      let oldTempMax = 20; // default assumption
      if (race.plan_id) {
        const { data: planData } = await supabase
          .from("hydration_profiles")
          .select("profile_data")
          .eq("id", race.plan_id)
          .single();

        if (planData?.profile_data) {
          const pd = planData.profile_data as any;
          if (pd.trainingTempRange?.max != null) {
            oldTempMax = pd.trainingTempRange.max;
          }
        }
      }

      // Check if delta > 5°C
      const delta = Math.abs(forecast.tempMax - oldTempMax);
      if (delta <= 5) {
        console.log(`[Weather] Race ${race.id}: delta ${delta.toFixed(1)}°C, skipping`);
        continue;
      }

      console.log(`[Weather] Race ${race.id}: forecast ${forecast.tempMax}°C vs plan ${oldTempMax}°C (delta ${delta.toFixed(1)}°C) — updating`);

      // Build updated profile data from existing plan
      let updatedProfileData: any = {};
      if (race.plan_id) {
        const { data: existingPlan } = await supabase
          .from("hydration_profiles")
          .select("profile_data, plan_data")
          .eq("id", race.plan_id)
          .single();

        if (existingPlan?.profile_data) {
          updatedProfileData = { ...existingPlan.profile_data as any };
        }
      }

      // Update temp range with forecast
      updatedProfileData.trainingTempRange = {
        min: Math.round(forecast.tempMin),
        max: Math.round(forecast.tempMax),
      };
      updatedProfileData.humidity = Math.round(forecast.humidity);

      // Save new hydration profile with updated conditions
      // NOTE: The actual plan recalculation happens client-side when the user views it.
      // We save the updated profile_data so the next view recalculates correctly.
      const { data: newPlan, error: insertError } = await supabase
        .from("hydration_profiles")
        .insert({
          profile_data: updatedProfileData,
          plan_data: {}, // Will be recalculated client-side
          consent_given: true,
          consent_timestamp: new Date().toISOString(),
          user_id: race.user_id,
        })
        .select("id")
        .single();

      if (insertError || !newPlan) {
        console.error(`[Weather] Failed to save updated plan for race ${race.id}:`, insertError);
        continue;
      }

      // Link new plan to race
      await supabase
        .from("athlete_races")
        .update({ plan_id: newPlan.id })
        .eq("id", race.id);

      updated++;

      // Email the athlete
      if (resendKey) {
        const { data: userData } = await supabase.auth.admin.getUserById(race.user_id);
        const email = userData?.user?.email;
        if (email) {
          const { subject, html } = buildWeatherEmail(
            race.race_name,
            forecast.tempMax,
            oldTempMax,
            race.location_city
          );

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendKey}`,
            },
            body: JSON.stringify({ from, to: [email], subject, html }),
          });

          console.log(`[Weather] Sent weather update email for race ${race.id} to ${email}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, updated }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("[update-race-weather] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});
