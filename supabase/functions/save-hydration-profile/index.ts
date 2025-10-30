import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
}).passthrough(); // Allow additional fields

const planSchema = z.object({
  preActivity: z.object({
    water: z.number().min(0).max(5000),
    electrolytes: z.union([z.number().min(0).max(100), z.string().max(100)])
  }),
  duringActivity: z.object({
    waterPerHour: z.number().min(0).max(5000),
    electrolytesPerHour: z.union([z.number().min(0).max(100), z.string().max(100)])
  }),
  postActivity: z.object({
    water: z.number().min(0).max(5000),
    electrolytes: z.union([z.number().min(0).max(100), z.string().max(100)])
  }),
  totalFluidLoss: z.number().min(0).max(20000),
  recommendations: z.array(z.string().max(500)).max(20).optional(),
  scientificReferences: z.array(z.any()).optional()
}).passthrough();

const requestSchema = z.object({
  profile: profileSchema,
  plan: planSchema,
  hasSmartWatchData: z.boolean().optional(),
  consentGiven: z.boolean(),
  userEmail: z.string().email().max(255).optional().nullable()
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
          code: 'VALIDATION_ERROR'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const { profile, plan, hasSmartWatchData, consentGiven, userEmail } = validationResult.data;

    if (!consentGiven) {
      return new Response(
        JSON.stringify({ 
          error: 'User consent is required to save data',
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

    // Get user agent and IP from headers
    const userAgent = req.headers.get('user-agent') || '';
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 
                     req.headers.get('x-real-ip') || '';

    // Save profile to database with GDPR compliance
    const { data, error } = await supabase
      .from('hydration_profiles')
      .insert({
        profile_data: profile,
        plan_data: plan,
        consent_given: consentGiven,
        consent_timestamp: new Date().toISOString(),
        has_smartwatch_data: hasSmartWatchData || false,
        user_email: userEmail || null,
        ip_address: ipAddress || null,
        user_agent: userAgent,
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