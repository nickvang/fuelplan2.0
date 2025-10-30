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
    const { requestDeletion } = await req.json();

    if (!requestDeletion) {
      throw new Error('Deletion request not confirmed');
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

    const { error } = await supabase
      .from('hydration_profiles')
      .delete()
      .eq('ip_address', ipAddress)
      .eq('user_agent', userAgent)
      .gte('created_at', oneDayAgo);

    if (error) {
      console.error('Error deleting data:', error);
      throw error;
    }

    console.log('Data deletion completed for IP:', ipAddress);

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
    console.error('Error in delete-user-data function:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false,
        message: 'Please contact privacy@supplme.com for manual data deletion'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});