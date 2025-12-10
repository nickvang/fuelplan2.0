import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getClientIP, checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Delete user's data using secure deletion token
    const { error, data } = await supabase
      .from('hydration_profiles')
      .delete()
      .eq('deletion_token', deletionToken)
      .select();

    if (error) {
      console.error('[Internal] Database error deleting data:', error);
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

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No data found with the provided deletion token.',
          code: 'NOT_FOUND',
          success: false
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    console.log(`[Success] Deleted ${data.length} record(s) using deletion token`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Your data has been deleted in compliance with GDPR Article 17 (Right to erasure)'
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