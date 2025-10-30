import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profile, plan, hasSmartWatchData } = await req.json();
    console.log('Enhancing hydration plan with AI...', hasSmartWatchData ? '(with smartwatch data)' : '');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

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
- Environment: Temperature ${profile.trainingTempRange?.min}-${profile.trainingTempRange?.max}°C, Humidity ${profile.humidity}%, Altitude: ${profile.altitude}
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
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits depleted. Please add credits to continue.' }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error('AI Gateway request failed');
    }

    const data = await response.json();
    const aiContent = data.choices[0].message.content;
    console.log('AI response received:', aiContent);

    let enhancedData;
    try {
      enhancedData = JSON.parse(aiContent);
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      throw new Error('Invalid AI response format');
    }

    return new Response(
      JSON.stringify(enhancedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in enhance-hydration-plan:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
