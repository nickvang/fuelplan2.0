import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getClientIP, checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

// Rate limit: 5 export attempts per minute per IP
const RATE_LIMIT_CONFIG = { windowMs: 60 * 1000, maxRequests: 5 };

// Validation schema
const requestSchema = z.object({
  exportToken: z.string().uuid({
    message: "Valid export token is required"
  })
});

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting check
  const clientIP = getClientIP(req);
  const rateLimit = checkRateLimit(clientIP, RATE_LIMIT_CONFIG);
  if (!rateLimit.allowed) {
    console.warn(`[RateLimit] IP ${clientIP} exceeded rate limit for export`);
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

    const { exportToken } = validationResult.data;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Query hydration profile by deletion token (used as export token)
    const { data, error } = await supabase
      .from('hydration_profiles')
      .select('id, created_at, profile_data, plan_data, consent_given, health_consent_given, algorithm_consent_given, consent_timestamp, consent_version, has_smartwatch_data')
      .eq('deletion_token', exportToken)
      .maybeSingle();

    if (error) {
      console.error('[Internal] Database error querying profile:', error);
      return new Response(
        JSON.stringify({
          error: 'Unable to retrieve data. Please try again later.',
          code: 'QUERY_FAILED',
          success: false
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    if (!data) {
      // Return 200 (not 404) to avoid confirming token non-existence
      return new Response(
        JSON.stringify({
          success: true,
          data: null,
          message: 'No data found for this token.'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log('[Success] Export request processed for token');

    return new Response(
      JSON.stringify({
        success: true,
        data,
        exportedAt: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[Internal] Error in export-my-data function:', error);

    return new Response(
      JSON.stringify({
        error: 'An unexpected error occurred. Please try again later.',
        code: 'INTERNAL_ERROR',
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
