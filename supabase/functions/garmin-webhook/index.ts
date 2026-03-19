import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey);
}

// Map Garmin push payload keys to our data_type labels
const DATA_TYPE_MAP: Record<string, string> = {
  activities: "activity",
  activityDetails: "activity_detail",
  bodyComps: "body_composition",
  dailies: "daily",
  epochs: "epoch",
  deregistrations: "deregistration",
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const expectedClientId = Deno.env.get("GARMIN_CLIENT_ID");
    const headerClientId = req.headers.get("garmin-client-id");

    if (!expectedClientId || headerClientId !== expectedClientId) {
      console.warn("[Garmin Webhook] Invalid or missing garmin-client-id header");
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const sb = getSupabaseClient();

    const inserts: { garmin_user_id: string; activity_data: any; data_type: string }[] = [];
    const checkedUsers = new Map<string, boolean>();

    // Process all known data types from the payload
    for (const [key, dataType] of Object.entries(DATA_TYPE_MAP)) {
      const items = body[key];
      if (!Array.isArray(items) || items.length === 0) continue;

      for (const item of items) {
        const userId = item.userId || item.userAccessToken;
        if (!userId) continue;

        // Cache user lookup to avoid repeated queries
        if (!checkedUsers.has(userId)) {
          const { data: conn } = await sb
            .from("garmin_connections")
            .select("id")
            .eq("garmin_user_id", userId)
            .limit(1)
            .single();
          checkedUsers.set(userId, !!conn);
        }

        if (!checkedUsers.get(userId)) continue;

        inserts.push({
          garmin_user_id: userId,
          activity_data: item,
          data_type: dataType,
        });
      }
    }

    if (inserts.length > 0) {
      const { error } = await sb.from("garmin_activities").insert(inserts);
      if (error) {
        console.error("[Garmin Webhook] Insert error:", error);
      } else {
        const types = [...new Set(inserts.map(i => i.data_type))];
        console.log(`[Garmin Webhook] Stored ${inserts.length} records (${types.join(", ")})`);
      }
    } else {
      console.log("[Garmin Webhook] No matching data in payload, acknowledging");
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("[Garmin Webhook] Error:", e);
    return new Response("OK", { status: 200 });
  }
});
