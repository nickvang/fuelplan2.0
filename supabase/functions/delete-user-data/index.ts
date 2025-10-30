import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schema
const requestSchema = z.object({
  confirmDelete: z.boolean().refine(val => val === true, {
    message: "Deletion must be confirmed"
  })
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
          code: 'VALIDATION_ERROR',
          success: false
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const { confirmDelete } = validationResult.data;

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

    // Get IP address and user agent to identify user's data
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : 
                     req.headers.get('x-real-ip') || '';
    const userAgent = req.headers.get('user-agent') || '';

    // Delete user's data based on IP and user agent (last 24 hours)
    // This is a best-effort approach for anonymous users
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { error, data } = await supabase
      .from('hydration_profiles')
      .delete()
      .eq('ip_address', ipAddress)
      .eq('user_agent', userAgent)
      .gte('created_at', oneDayAgo)
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

    console.log(`[Success] Deleted ${data?.length || 0} records for IP:`, ipAddress);

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