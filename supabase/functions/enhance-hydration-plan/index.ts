import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schemas
const profileSchema = z.object({
  age: z.number().min(13).max(120),
  weight: z.number().min(30).max(300),
  sex: z.enum(['male', 'female', 'other']),
  disciplines: z.array(z.string().max(100)).max(10).optional(),
  sessionDuration: z.number().min(0.5).max(24).optional(),
}).passthrough();

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
  totalFluidLoss: z.number().min(0).max(20000)
}).passthrough();

const requestSchema = z.object({
  profile: profileSchema,
  plan: planSchema,
  hasSmartWatchData: z.boolean().optional()
});

serve(async (req) => {
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
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { profile, plan, hasSmartWatchData } = validationResult.data;
    console.log('[Info] Enhancing hydration plan with AI...', hasSmartWatchData ? '(with smartwatch data)' : '');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[Internal] LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          error: 'AI service temporarily unavailable',
          code: 'SERVICE_UNAVAILABLE'
        }),
        { 
          status: 503, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Prepare temperature range string
    const tempRange = profile.trainingTempRange && typeof profile.trainingTempRange === 'object' && 'min' in profile.trainingTempRange && 'max' in profile.trainingTempRange
      ? `${profile.trainingTempRange.min}-${profile.trainingTempRange.max}`
      : 'N/A';

    const systemPrompt = `You are a sports science expert specializing in hydration for endurance athletes. 
Your role is to provide personalized, evidence-based explanations for hydration recommendations based on scientific research from PubMed.

Key scientific references:
- PMID 17277604: American College of Sports Medicine position stand on exercise and fluid replacement
- PMID 38732589: Personalized hydration strategy improves fluid balance and exercise performance
- PMID 23320854: Water and sodium intake habits in ultra-endurance athletes

Provide brief, actionable insights (2-3 sentences each) that:
1. Explain WHY specific recommendations were made based on their profile
2. Highlight any concerning factors that increase dehydration risk
3. Give confidence levels based on data completeness
4. Compare their hydration needs to typical athletes in similar disciplines
5. Provide specific optimization tips tailored to their profile
6. Suggest professional testing when appropriate`;

    const userPrompt = `Analyze this athlete's hydration profile and plan${hasSmartWatchData ? ' (ENHANCED WITH SMARTWATCH DATA - mention this in insights)' : ''}:

PROFILE:
- Weight: ${profile.weight}kg, Age: ${profile.age}, Sex: ${profile.sex}
- Activity: ${profile.disciplines?.join(', ')} for ${profile.sessionDuration} hours
- Environment: Temperature ${tempRange}°C, Humidity ${profile.humidity}%, Altitude: ${profile.altitude}
- Sweat rate: ${profile.sweatRate}, Sweat saltiness: ${profile.sweatSaltiness}
- Daily salt intake: ${profile.dailySaltIntake}
${profile.crampTiming && profile.crampTiming !== 'none' ? `- Cramping: ${profile.crampTiming}` : ''}
${profile.elevationGain ? `- Elevation gain: ${profile.elevationGain}m` : ''}
${profile.sleepHours ? `- Sleep: ${profile.sleepHours} hours/night` : ''}
${profile.sleepQuality ? `- Sleep quality: ${profile.sleepQuality}/10` : ''}
${profile.restingHeartRate ? `- Resting HR: ${profile.restingHeartRate} bpm` : ''}

PLAN:
- PRE: ${plan.preActivity.water}ml water + ${plan.preActivity.electrolytes} Supplme sachet
- DURING: ${plan.duringActivity.waterPerHour}ml/hour + ${plan.duringActivity.electrolytesPerHour} sachets/hour
- POST: ${plan.postActivity.water}ml water + ${plan.postActivity.electrolytes} sachets
- Total fluid loss: ${plan.totalFluidLoss}ml

Provide:
1. personalized_insight: Why these numbers make sense for THIS athlete (2-3 sentences)
2. risk_factors: Any concerning factors that increase dehydration risk (1-2 sentences)
3. confidence_level: high/medium/low based on data completeness
4. professional_recommendation: When to seek sweat testing or sports nutritionist (1 sentence)
5. performance_comparison: Compare this athlete's hydration needs to typical ${profile.disciplines?.[0] || 'endurance'} athletes (2 sentences)
6. optimization_tips: Array of 3-4 specific, actionable tips to optimize hydration based on their unique profile (each tip 1 sentence)

Return as JSON: {"personalized_insight": "", "risk_factors": "", "confidence_level": "", "professional_recommendation": "", "performance_comparison": "", "optimization_tips": []}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ 
            error: 'Rate limit exceeded. Please try again in a moment.',
            code: 'RATE_LIMIT'
          }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: 'AI credits depleted. Please add credits to continue.',
            code: 'CREDITS_DEPLETED'
          }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('[Internal] AI Gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'AI service error. Please try again later.',
          code: 'AI_SERVICE_ERROR'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const data = await response.json();
    const aiContent = data.choices[0].message.content;
    console.log('[Success] AI response received');

    let enhancedData;
    try {
      enhancedData = JSON.parse(aiContent);
    } catch (e) {
      console.error('[Internal] Failed to parse AI response:', e);
      return new Response(
        JSON.stringify({ 
          error: 'Unable to process AI response. Please try again.',
          code: 'PARSE_ERROR'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify(enhancedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Internal] Error in enhance-hydration-plan:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An unexpected error occurred. Please try again later.',
        code: 'INTERNAL_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
