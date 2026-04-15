import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getClientIP, checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

// Rate limit: 5 profile saves per minute per IP
const RATE_LIMIT_CONFIG = { windowMs: 60 * 1000, maxRequests: 5 };

// Max body size: 512KB
const MAX_CONTENT_LENGTH = 512 * 1024;

// Validation schemas
const profileSchema = z.object({
  age: z.number().min(13).max(120),
  weight: z.number().min(30).max(300),
  height: z.number().min(100).max(250).optional(),
  sex: z.enum(['male', 'female', 'other']),
  disciplines: z.array(z.string().max(100)).max(10).optional(),
  sessionDuration: z.number().min(0.5).max(24).optional(),
  trainingTempRange: z.object({
    min: z.number().min(-20).max(50),
    max: z.number().min(-20).max(50)
  }).optional(),
  humidity: z.number().min(0).max(100).optional(),
  altitude: z.string().max(50).optional(),
  sweatRate: z.string().max(50).optional(),
  sweatSaltiness: z.string().max(50).optional(),
  dailySaltIntake: z.string().max(50).optional(),
  crampTiming: z.string().max(100).optional(),
  elevationGain: z.number().min(0).max(10000).optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  sleepQuality: z.number().min(0).max(10).optional(),
  restingHeartRate: z.number().min(30).max(200).optional(),
  primaryGoal: z.string().max(200).optional(),
}).strip();

const planSchema = z.object({
  preActivity: z.object({
    water: z.number().min(0).max(5000),
    electrolytes: z.union([z.number().min(0).max(100), z.string().max(100)])
  }),
  duringActivity: z.object({
    waterPerHour: z.number().min(0).max(5000),
    electrolytesPerHour: z.union([z.number().min(0).max(100), z.string().max(100)]).nullable(),
    totalElectrolytes: z.number().min(0).max(100).optional()
  }),
  postActivity: z.object({
    water: z.number().min(0).max(5000).nullable(),
    electrolytes: z.union([z.number().min(0).max(100), z.string().max(100)]).nullable()
  }),
  totalFluidLoss: z.number().min(0).max(20000).nullable(),
  recommendations: z.array(z.string().max(500)).max(20).optional(),
  scientificReferences: z.array(z.any()).optional()
}).strip();

const requestSchema = z.object({
  profile: profileSchema,
  plan: planSchema,
  hasSmartWatchData: z.boolean().optional(),
  consentGiven: z.boolean(),
  healthConsentGiven: z.boolean(),
  algorithmConsentGiven: z.boolean().optional().default(false),
  userEmail: z.string().email().max(255).optional().nullable(),
  authUserId: z.string().uuid().optional().nullable(),
});

async function pseudonymiseIP(ip: string): Promise<string> {
  const salt = Deno.env.get('IP_HASH_SALT') || 'supplme-fuelplan-salt-v1';
  const data = new TextEncoder().encode(ip + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

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
    console.warn(`[RateLimit] IP ${clientIP} exceeded rate limit`);
    return rateLimitResponse(rateLimit.resetIn, corsHeaders);
  }

  try {
    // Content-Length check before parsing
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_CONTENT_LENGTH) {
      return new Response(
        JSON.stringify({
          error: 'Request body too large',
          code: 'PAYLOAD_TOO_LARGE'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 413,
        }
      );
    }

    const body = await req.json();

    // Validate input
    const validationResult = requestSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('[Validation] Invalid request data:', validationResult.error);
      return new Response(
        JSON.stringify({
          error: 'Invalid request data',
          code: 'VALIDATION_ERROR'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const { profile, plan, hasSmartWatchData, consentGiven, healthConsentGiven, algorithmConsentGiven, userEmail, authUserId } = validationResult.data;

    if (!consentGiven || !healthConsentGiven) {
      return new Response(
        JSON.stringify({
          error: 'Both general and health data consent are required',
          code: 'CONSENT_REQUIRED'
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

    // Get user agent for audit trail (IP is intentionally not stored — GDPR)
    const userAgent = req.headers.get('user-agent') || '';

    // Extract user_id from auth header if present
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user: authUser } } = await supabase.auth.getUser(token);
        if (authUser) userId = authUser.id;
      } catch {
        // Ignore auth errors — save anonymously
      }
    }

    // Get client IP for pseudonymisation
    const ipAddress = getClientIP(req);

    // Save profile to database with GDPR compliance
    const { data, error } = await supabase
      .from('hydration_profiles')
      .insert({
        profile_data: profile,
        plan_data: plan,
        consent_given: consentGiven,
        consent_timestamp: new Date().toISOString(),
        health_consent_given: healthConsentGiven,
        algorithm_consent_given: algorithmConsentGiven || false,
        consent_version: 'v2-2026-04',
        has_smartwatch_data: hasSmartWatchData || false,
        user_email: userEmail || null,
        user_agent: userAgent,
        user_id: userId,
        auth_user_id: authUserId || userId || null,
        ip_address: ipAddress !== 'unknown' ? await pseudonymiseIP(ipAddress) : null,
      })
      .select()
      .single();

    if (error) {
      console.error('[Internal] Database error saving profile:', error);
      return new Response(
        JSON.stringify({
          error: 'Unable to save profile. Please try again later.',
          code: 'SAVE_FAILED',
          success: false
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    console.log('[Success] Profile saved:', data.id);

    return new Response(
      JSON.stringify({
        success: true,
        profileId: data.id,
        deletionToken: data.deletion_token,
        message: 'Profile saved with GDPR compliance'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[Internal] Error in save-hydration-profile function:', error);

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
