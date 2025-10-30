import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profile, plan, hasSmartWatchData, consentGiven, userEmail } = await req.json();

    if (!consentGiven) {
      throw new Error('User consent is required to save data');
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
      console.error('Error saving profile:', error);
      throw error;
    }

    console.log('Profile saved successfully:', data.id);

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
    console.error('Error in save-hydration-profile function:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});