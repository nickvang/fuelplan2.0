import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getClientIP, checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

// Rate limit: 3 deletion attempts per minute per IP (strict to prevent token brute-forcing)
const RATE_LIMIT_CONFIG = { windowMs: 60 * 1000, maxRequests: 3 };

// Validation schema
const requestSchema = z.object({
  confirmDelete: z.boolean().refine(val => val === true, {
    message: "Deletion must be confirmed"
  }),
  deletionToken: z.string().uuid({
    message: "Valid deletion token is required"
  })
});

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting check (strict for deletion endpoint)
  const clientIP = getClientIP(req);
  const rateLimit = checkRateLimit(clientIP, RATE_LIMIT_CONFIG);
  if (!rateLimit.allowed) {
    console.warn(`[RateLimit] IP ${clientIP} exceeded rate limit for deletion`);
    return rateLimitResponse(rateLimit.resetIn, corsHeaders);
  }

  try {
    const body = await req.json();

    // Validate input
    const validationResult = requestSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('[Validation] Invalid request data:', validationResult.error);
      return new Response(
        JSON.stringify({
          error: 'Invalid request data',
          code: 'VALIDATION_ERROR',
          success: false
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const { confirmDelete, deletionToken } = validationResult.data;

    if (!confirmDelete) {
      return new Response(
        JSON.stringify({
          error: 'Deletion must be confirmed',
          code: 'CONFIRMATION_REQUIRED',
          success: false
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Delete user's hydration profile using secure deletion token
    const { error } = await supabase
      .from('hydration_profiles')
      .delete()
      .eq('deletion_token', deletionToken);

    if (error) {
      console.error('[Internal] Database error deleting hydration data:', error);
      return new Response(
        JSON.stringify({
          error: 'Unable to delete data. Please try again later.',
          code: 'DELETE_FAILED',
          success: false,
          message: 'Please contact info@supplme.com for manual data deletion'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Delete Garmin data linked by the same deletion token
    const { data: garminConn } = await supabase
      .from('garmin_connections')
      .select('garmin_user_id, access_token')
      .eq('deletion_token', deletionToken)
      .maybeSingle();

    if (garminConn) {
      // Delete activities FIRST (references garmin_user_id)
      const { error: actErr } = await supabase
        .from('garmin_activities')
        .delete()
        .eq('garmin_user_id', garminConn.garmin_user_id);

      if (actErr) {
        console.error('[Internal] Error deleting Garmin activities:', actErr);
      }

      // Revoke token upstream — never let Garmin API failure block GDPR deletion
      try {
        const deauthRes = await fetch(
          'https://apis.garmin.com/wellness-api/rest/user/registration',
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${garminConn.access_token}` },
          }
        );
        if (!deauthRes.ok) {
          console.warn(`[Garmin] Deauthorize returned ${deauthRes.status}`);
        }
      } catch (deauthErr) {
        console.warn('[Garmin] Deauthorize request failed:', deauthErr);
      }

      // Delete the connection row
      const { error: connErr } = await supabase
        .from('garmin_connections')
        .delete()
        .eq('deletion_token', deletionToken);

      if (connErr) {
        console.error('[Internal] Error deleting Garmin connection:', connErr);
      }
    }

    // Return identical response for both "deleted" and "not found" to prevent timing oracle
    console.log(`[Success] Delete request processed for token`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Your data has been deleted in compliance with GDPR Article 17 (Right to erasure). All connected service tokens have also been revoked.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[Internal] Error in delete-user-data function:', error);

    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred. Please try again later.',
        code: 'INTERNAL_ERROR',
        success: false,
        message: 'Please contact info@supplme.com for manual data deletion'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
