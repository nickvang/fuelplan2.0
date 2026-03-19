// Simple in-memory rate limiter for edge functions
// Note: This resets on function cold starts, but provides basic protection

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const MAX_MAP_SIZE = 10_000;
let cleanupCounter = 0;

export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000,   // 1 minute
  maxRequests: 10,        // 10 requests per minute
};

export function getClientIP(req: Request): string {
  // Prefer x-real-ip (platform-set, not spoofable by clients)
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  // Fall back to LAST x-forwarded-for entry (closest proxy, harder to spoof)
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const parts = forwardedFor.split(',');
    return parts[parts.length - 1].trim();
  }

  return 'unknown';
}

export function checkRateLimit(
  clientIP: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const key = clientIP;

  const entry = rateLimitMap.get(key);

  // Deterministic cleanup every 100 calls
  cleanupCounter++;
  if (cleanupCounter >= 100) {
    cleanupCounter = 0;
    for (const [k, v] of rateLimitMap) {
      if (now > v.resetTime) {
        rateLimitMap.delete(k);
      }
    }
  }

  // Evict 20% oldest entries when map exceeds size cap
  if (rateLimitMap.size > MAX_MAP_SIZE) {
    const entries = Array.from(rateLimitMap.entries())
      .sort((a, b) => a[1].resetTime - b[1].resetTime);
    const evictCount = Math.ceil(MAX_MAP_SIZE * 0.2);
    for (let i = 0; i < evictCount && i < entries.length; i++) {
      rateLimitMap.delete(entries[i][0]);
    }
  }

  if (!entry || now > entry.resetTime) {
    // New window
    rateLimitMap.set(key, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return { allowed: true, remaining: config.maxRequests - 1, resetIn: config.windowMs };
  }

  if (entry.count >= config.maxRequests) {
    // Rate limited
    const resetIn = entry.resetTime - now;
    return { allowed: false, remaining: 0, resetIn };
  }

  // Increment and allow
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetIn: entry.resetTime - now
  };
}

export function rateLimitResponse(resetIn: number, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests. Please try again later.',
      code: 'RATE_LIMIT',
      retryAfter: Math.ceil(resetIn / 1000),
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil(resetIn / 1000)),
      },
    }
  );
}
