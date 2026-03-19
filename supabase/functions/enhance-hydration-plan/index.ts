import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getClientIP, checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

// Rate limit: 10 AI enhancement requests per minute per IP
const RATE_LIMIT_CONFIG = { windowMs: 60 * 1000, maxRequests: 10 };

// Sanitize user-provided strings before interpolating into AI prompts
function sanitizeForPrompt(value: unknown): string {
  if (value == null) return '';
  const str = String(value);
  // Remove control characters and limit length
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, 500);
}

// Smartwatch data schema
const physiologicalCycleSchema = z.object({
  recoveryScore: z.number().min(0).max(100),
  hrv: z.number().min(0).max(300),
  sleepDuration: z.number().min(0).max(1440),
  sleepPerformance: z.number().min(0).max(100),
}).strip();

const workoutSchema = z.object({
  strain: z.number().min(0).max(30),
  avgHR: z.number().min(30).max(250),
  maxHR: z.number().min(30).max(250),
}).strip();

const smartWatchDataSchema = z.object({
  physiologicalCycles: z.array(physiologicalCycleSchema).max(30).optional(),
  workouts: z.array(workoutSchema).max(30).optional(),
}).strip();

// Validation schemas
const profileSchema = z.object({
  age: z.number().min(13).max(120),
  weight: z.number().min(30).max(300),
  sex: z.enum(['male', 'female', 'other']),
  disciplines: z.array(z.string().max(100)).max(10).optional(),
  sessionDuration: z.number().min(0.5).max(24).optional(),
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
  trainingTempRange: z.object({
    min: z.number().min(-20).max(60),
    max: z.number().min(-20).max(60),
  }).optional(),
}).strip();

const planSchema = z.object({
  preActivity: z.object({
    water: z.number().min(0).max(5000),
    electrolytes: z.union([z.number().min(0).max(100), z.string().max(100)])
  }),
  duringActivity: z.object({
    waterPerHour: z.number().min(0).max(5000),
    electrolytesPerHour: z.union([z.number().min(0).max(100), z.string().max(100)]).nullable()
  }),
  postActivity: z.object({
    water: z.number().min(0).max(15000).nullable(),
    electrolytes: z.union([z.number().min(0).max(100), z.string().max(100)]).nullable()
  }),
  totalFluidLoss: z.number().min(0).max(50000).nullable()
}).strip();

const requestSchema = z.object({
  profile: profileSchema,
  plan: planSchema,
  hasSmartWatchData: z.boolean().optional(),
  rawSmartWatchData: smartWatchDataSchema.optional()
});

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  const rateLimit = checkRateLimit(clientIP, RATE_LIMIT_CONFIG);
  if (!rateLimit.allowed) {
    console.warn(`[RateLimit] IP ${clientIP} exceeded rate limit`);
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
          code: 'VALIDATION_ERROR'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { profile, plan, hasSmartWatchData, rawSmartWatchData } = validationResult.data;
    console.log('[Info] Enhancing hydration plan with AI...', hasSmartWatchData ? '(with smartwatch data)' : '');

    // Extract smartwatch insights if available
    let smartWatchInsights = '';
    if (rawSmartWatchData && hasSmartWatchData) {
      if (rawSmartWatchData.physiologicalCycles && rawSmartWatchData.physiologicalCycles.length > 0) {
        const recent = rawSmartWatchData.physiologicalCycles.slice(-7);
        const avgRecovery = recent.reduce((sum, c) => sum + c.recoveryScore, 0) / recent.length;
        const avgHRV = recent.reduce((sum, c) => sum + c.hrv, 0) / recent.length;
        const avgSleep = recent.reduce((sum, c) => sum + c.sleepDuration, 0) / recent.length / 60;
        const avgSleepPerf = recent.reduce((sum, c) => sum + c.sleepPerformance, 0) / recent.length;

        smartWatchInsights += `\nSMARTWATCH DATA (Last 7 days):\n`;
        smartWatchInsights += `- Recovery Score: ${avgRecovery.toFixed(0)}% (avg)\n`;
        smartWatchInsights += `- HRV: ${avgHRV.toFixed(0)}ms (avg)\n`;
        smartWatchInsights += `- Sleep: ${avgSleep.toFixed(1)}h/night, ${avgSleepPerf.toFixed(0)}% quality\n`;

        if (rawSmartWatchData.workouts && rawSmartWatchData.workouts.length > 0) {
          const recentWorkouts = rawSmartWatchData.workouts.slice(-5);
          const avgStrain = recentWorkouts.reduce((sum, w) => sum + w.strain, 0) / recentWorkouts.length;
          const avgHR = recentWorkouts.reduce((sum, w) => sum + w.avgHR, 0) / recentWorkouts.length;
          const maxHR = Math.max(...recentWorkouts.map(w => w.maxHR));

          smartWatchInsights += `- Workout Strain: ${avgStrain.toFixed(1)} (avg recent)\n`;
          smartWatchInsights += `- Exercise HR: ${avgHR.toFixed(0)} bpm avg, ${maxHR} bpm max\n`;
        }

        smartWatchInsights += '\nUSE THIS REAL DATA to provide MORE PRECISE insights about their readiness, recovery needs, and hydration optimization based on actual physiological metrics, not just estimates!';
      }
    }

    // AI providers: try Gemini first, then OpenAI (set both keys for fallback when one fails).
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    const AI_PROVIDER = (Deno.env.get('AI_PROVIDER') || 'gemini') as 'gemini' | 'openai';

    const hasGemini = !!GEMINI_API_KEY;
    const hasOpenAI = !!OPENAI_API_KEY;

    // At least one provider must be configured (Gemini and/or OpenAI)
    if (!hasGemini && !hasOpenAI) {
      console.error('[Internal] No AI provider configured. Set GEMINI_API_KEY and/or OPENAI_API_KEY in Supabase Edge Function secrets.');
      return new Response(
        JSON.stringify({
          error: 'AI service not configured. Set OPENAI_API_KEY or GEMINI_API_KEY in Supabase (Project Settings → Edge Functions → Secrets).',
          code: 'SERVICE_UNAVAILABLE'
        }),
        {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Build ordered list of providers to try, based on preference and which keys exist.
    const preferredProvider: 'gemini' | 'openai' = AI_PROVIDER === 'openai' ? 'openai' : 'gemini';
    const providersToTry: ('gemini' | 'openai')[] = [];

    if (preferredProvider === 'gemini') {
      if (hasGemini) providersToTry.push('gemini');
      if (hasOpenAI) providersToTry.push('openai');
    } else {
      if (hasOpenAI) providersToTry.push('openai');
      if (hasGemini) providersToTry.push('gemini');
    }

    // Prepare temperature range string (sanitized)
    const tempRange = profile.trainingTempRange
      ? `${profile.trainingTempRange.min}-${profile.trainingTempRange.max}`
      : 'N/A';

    const systemPrompt = `You are a sports science expert specializing in hydration for endurance and competitive athletes.
Your role is to provide personalized, evidence-based explanations for hydration recommendations based on scientific research from multiple trusted sources.

Key scientific references and guidelines:

PEER-REVIEWED RESEARCH (PubMed):
- PMID 17277604: American College of Sports Medicine position stand on exercise and fluid replacement
- PMID 38732589: Personalized hydration strategy improves fluid balance and exercise performance
- PMID 23320854: Water and sodium intake habits in ultra-endurance athletes
- PMID 27134134: Fluid and electrolyte balance in ultra-endurance sport
- PMID 26732507: Hydration for recreational sport and physical activity

AUTHORITATIVE ORGANIZATIONS:
- ACSM (American College of Sports Medicine): Gold standard position stands on exercise hydration, updated regularly with latest research
- ISSN (International Society of Sports Nutrition): Evidence-based position stands on hydration, electrolytes, and sport-specific nutrition
- NATA (National Athletic Trainers' Association): Practical, field-tested hydration guidelines for athletes
- IOC (International Olympic Committee): Consensus statements on nutrition for elite athletes
- Cochrane Reviews: Systematic reviews and meta-analyses on hydration interventions

SPORT-SPECIFIC CONSIDERATIONS:
- Football/Soccer: FIFA Medical Assessment and Research Centre (F-MARC) guidelines
- Padel Tennis: Racquet sports hydration research from BJSM (British Journal of Sports Medicine)
- Endurance sports: Ultra-endurance hydration protocols from specialized research

Draw from this comprehensive evidence base to provide:
1. Personalized insights explaining WHY specific recommendations were made
2. Risk factors that increase dehydration risk for this specific athlete
3. Confidence levels based on data completeness and research availability
4. Comparisons to typical athletes in their discipline (based on published norms)
5. Specific optimization tips backed by current research consensus
6. Professional testing recommendations when appropriate

Keep responses brief and actionable (2-3 sentences per section).`;

    const userPrompt = `Analyze this athlete's hydration profile and plan${hasSmartWatchData ? ' (ENHANCED WITH SMARTWATCH DATA - this gives you REAL physiological data to work with!)' : ''}:

PROFILE:
- Weight: ${sanitizeForPrompt(profile.weight)}kg, Age: ${sanitizeForPrompt(profile.age)}, Sex: ${sanitizeForPrompt(profile.sex)}
- Activity: ${sanitizeForPrompt(profile.disciplines?.join(', '))} for ${sanitizeForPrompt(profile.sessionDuration)} hours
- Environment: Temperature ${sanitizeForPrompt(tempRange)}°C, Humidity ${sanitizeForPrompt(profile.humidity)}%, Altitude: ${sanitizeForPrompt(profile.altitude)}
- Sweat rate: ${sanitizeForPrompt(profile.sweatRate)}, Sweat saltiness: ${sanitizeForPrompt(profile.sweatSaltiness)}
- Daily salt intake: ${sanitizeForPrompt(profile.dailySaltIntake)}
${profile.crampTiming && profile.crampTiming !== 'none' ? `- Cramping: ${sanitizeForPrompt(profile.crampTiming)}` : ''}
${profile.elevationGain ? `- Elevation gain: ${sanitizeForPrompt(profile.elevationGain)}m` : ''}
${profile.sleepHours ? `- Sleep: ${sanitizeForPrompt(profile.sleepHours)} hours/night` : ''}
${profile.sleepQuality ? `- Sleep quality: ${sanitizeForPrompt(profile.sleepQuality)}/10` : ''}
${profile.restingHeartRate ? `- Resting HR: ${sanitizeForPrompt(profile.restingHeartRate)} bpm` : ''}
${smartWatchInsights}

PLAN:
- PRE: ${sanitizeForPrompt(plan.preActivity.water)}ml water + ${sanitizeForPrompt(plan.preActivity.electrolytes)} Supplme sachet
- DURING: ${sanitizeForPrompt(plan.duringActivity.waterPerHour)}ml/hour + ${sanitizeForPrompt(plan.duringActivity.electrolytesPerHour)} sachets/hour
- POST: ${sanitizeForPrompt(plan.postActivity.water)}ml + ${sanitizeForPrompt(plan.postActivity.electrolytes)} sachet
- Total fluid loss: ${sanitizeForPrompt(plan.totalFluidLoss)}ml

Provide:
1. personalized_insight: Why these numbers make sense for THIS athlete based on their ${hasSmartWatchData ? 'ACTUAL smartwatch data' : 'profile'} (2-3 sentences)
2. risk_factors: Any concerning factors from ${hasSmartWatchData ? 'their smartwatch metrics' : 'their profile'} that increase dehydration risk (1-2 sentences)
3. confidence_level: ${hasSmartWatchData ? '"high" (real data available)' : 'high/medium/low based on data completeness'}
4. professional_recommendation: When to seek sweat testing or sports nutritionist (1 sentence)
5. performance_comparison: Compare this athlete's hydration needs to typical ${sanitizeForPrompt(profile.disciplines?.[0] || 'endurance')} athletes${hasSmartWatchData ? ', considering their recovery and strain data' : ''} (2 sentences)
6. optimization_tips: Array of 3-4 specific, actionable tips to optimize hydration based on their ${hasSmartWatchData ? 'actual physiological metrics' : 'profile'} (each tip 1 sentence)

Return as JSON: {"personalized_insight": "", "risk_factors": "", "confidence_level": "", "professional_recommendation": "", "performance_comparison": "", "optimization_tips": []}`;

    // Retry logic with provider fallback: try Gemini first, then OpenAI. On 401/403 (bad key)
    // we skip retries and try the next provider. On 200 with invalid/empty body we also try next.
    const maxRetries = 3;
    let lastError: any = null;
    let enhancedData: Record<string, unknown> | null = null;
    const FETCH_TIMEOUT_MS = 15_000;

    for (const provider of providersToTry) {
      console.log(`[Info] Starting AI provider: ${provider}`);
      let response: Response | null = null;
      let successfulProvider: 'gemini' | 'openai' | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[Info] AI API request attempt ${attempt}/${maxRetries} (provider: ${provider})`);

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

          try {
            if (provider === 'gemini') {
              response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-goog-api-key': GEMINI_API_KEY!,
                },
                body: JSON.stringify({
                  contents: [{
                    parts: [{
                      text: `${systemPrompt}\n\n${userPrompt}\n\nIMPORTANT: You must respond with valid JSON in this exact format:\n{"personalized_insight": "...", "risk_factors": "...", "confidence_level": "high|medium|low", "professional_recommendation": "...", "performance_comparison": "...", "optimization_tips": ["tip1", "tip2", "tip3", "tip4"]}`
                    }]
                  }],
                  generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                    responseMimeType: "application/json"
                  }
                }),
                signal: controller.signal,
              });
            } else {
              response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${OPENAI_API_KEY}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  model: 'gpt-4o-mini',
                  messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt + '\n\nIMPORTANT: Respond with valid JSON in this exact format:\n{"personalized_insight": "...", "risk_factors": "...", "confidence_level": "high|medium|low", "professional_recommendation": "...", "performance_comparison": "...", "optimization_tips": ["tip1", "tip2", "tip3", "tip4"]}' }
                  ],
                  response_format: { type: "json_object" },
                  temperature: 0.7
                }),
                signal: controller.signal,
              });
            }
          } finally {
            clearTimeout(timeoutId);
          }

          if (response.ok) {
            console.log(`[Success] AI API responded successfully on attempt ${attempt} (provider: ${provider})`);
            successfulProvider = provider;
            break;
          }

          if (response.status === 401 || response.status === 403 || response.status === 429 || response.status === 402 || response.status === 400) {
            console.warn(`[Warn] Non-retriable AI API error on provider ${provider}: ${response.status} ${response.statusText}`);
            break;
          }

          lastError = { status: response.status, statusText: response.statusText };
          console.warn(`[Warn] AI API error on attempt ${attempt} (provider: ${provider}): ${response.status} ${response.statusText}`);
          if (attempt < maxRetries) {
            const delayMs = Math.pow(2, attempt - 1) * 1000;
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        } catch (error) {
          lastError = error;
          if (error instanceof DOMException && error.name === 'AbortError') {
            console.warn(`[Warn] AI API request timed out on attempt ${attempt} (provider: ${provider})`);
          } else {
            console.error(`[Error] Network error on attempt ${attempt} (provider: ${provider}):`, error);
          }
          if (attempt < maxRetries) {
            const delayMs = Math.pow(2, attempt - 1) * 1000;
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        }
      }

      if (!response || !response.ok || !successfulProvider) {
        console.warn(`[Warn] Provider ${provider} failed after retries. Moving to next provider if available.`);
        continue;
      }

      try {
        const data = await response.json();
        let parsed: Record<string, unknown> | null = null;
        if (successfulProvider === 'gemini') {
          if (data.candidates?.[0]?.content?.parts?.[0]?.text != null) {
            const jsonText = data.candidates[0].content.parts[0].text;
            parsed = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
          } else {
            console.warn(`[Warn] Gemini returned invalid or empty structure (e.g. safety block). Trying next provider.`);
            continue;
          }
        } else {
          if (data.choices?.[0]?.message?.content != null) {
            const jsonText = data.choices[0].message.content;
            parsed = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
          } else {
            console.warn(`[Warn] OpenAI returned invalid structure. Trying next provider.`);
            continue;
          }
        }
        if (parsed?.personalized_insight && parsed?.risk_factors && parsed?.confidence_level) {
          enhancedData = parsed;
          console.log(`[Success] Using AI response from provider: ${successfulProvider}`);
          break;
        }
        console.warn(`[Warn] AI response missing required fields. Trying next provider.`);
      } catch (e) {
        console.warn(`[Warn] Failed to parse response from ${successfulProvider}:`, e);
      }
    }

    if (!enhancedData) {
      console.error('[Internal] All AI providers failed or returned invalid data:', lastError);
      return new Response(
        JSON.stringify({
          error: 'AI service temporarily unavailable. Please try again.',
          code: 'SERVICE_UNAVAILABLE'
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(enhancedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Fatal] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error. Please try again.',
        code: 'INTERNAL_ERROR'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
