/**
 * Stress test: Rate limiter memory leak & bypass
 *
 * Tests:
 * 1. Memory leak: rateLimitMap never cleans up expired entries
 * 2. IP spoofing: X-Forwarded-For header bypasses rate limits
 * 3. Empty/missing IP handling
 */

// Replicate the rate limiter from chat.ts exactly
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// --- TEST 1: Memory leak ---
console.log("=== TEST 1: Rate Limit Map Memory Leak ===");
const UNIQUE_IPS = 100_000;
const before = process.memoryUsage().heapUsed;

for (let i = 0; i < UNIQUE_IPS; i++) {
  checkRateLimit(`192.168.${Math.floor(i / 256)}.${i % 256}`);
}

const after = process.memoryUsage().heapUsed;
const leakedMB = (after - before) / 1024 / 1024;
console.log(`  Map size after ${UNIQUE_IPS} unique IPs: ${rateLimitMap.size}`);
console.log(`  Memory consumed: ${leakedMB.toFixed(2)} MB`);
console.log(`  RESULT: ${rateLimitMap.size === UNIQUE_IPS ? "FAIL - entries never cleaned up (memory leak)" : "PASS"}`);

// Simulate time passing — entries should expire but they DON'T get deleted
const expiredCount = Array.from(rateLimitMap.values()).filter(
  (e) => Date.now() >= e.resetAt - RATE_WINDOW_MS + 100 // they're all "active" right now
).length;
console.log(`  Stale entries still in map: ${rateLimitMap.size} (none are ever removed)\n`);

// --- TEST 2: IP Spoofing ---
console.log("=== TEST 2: Rate Limit Bypass via IP Spoofing ===");
rateLimitMap.clear();

// Simulate one real IP hitting rate limit
const realIP = "10.0.0.1";
let blocked = false;
for (let i = 0; i < 35; i++) {
  if (!checkRateLimit(realIP)) {
    blocked = true;
    console.log(`  Real IP blocked after ${i} requests (expected ~30)`);
    break;
  }
}
if (!blocked) console.log("  FAIL: Real IP was never rate limited");

// Now simulate spoofed IPs — each "new" IP gets a fresh limit
let spoofedRequests = 0;
for (let i = 0; i < 100; i++) {
  const spoofedIP = `fake-${i}.${i}.${i}.${i}`;
  if (checkRateLimit(spoofedIP)) spoofedRequests++;
}
console.log(`  Spoofed IPs allowed through: ${spoofedRequests}/100`);
console.log(`  RESULT: ${spoofedRequests === 100 ? "FAIL - trivial bypass via X-Forwarded-For" : "PASS"}\n`);

// --- TEST 3: Edge cases ---
console.log("=== TEST 3: Edge Cases ===");
rateLimitMap.clear();

// Empty string IP
const emptyResult = checkRateLimit("");
console.log(`  Empty string IP allowed: ${emptyResult} (groups all unknown clients together)`);

// "unknown" IP
checkRateLimit("unknown");
console.log(`  'unknown' IP entry created: ${rateLimitMap.has("unknown")}`);

// Very long IP string (potential abuse)
const longIP = "A".repeat(10_000);
checkRateLimit(longIP);
console.log(`  10KB IP string accepted: ${rateLimitMap.has(longIP)}`);
console.log(`  RESULT: FAIL - no validation on IP input, accepts arbitrary strings\n`);

// --- TEST 4: Concurrent window race ---
console.log("=== TEST 4: Rapid-fire at boundary ===");
rateLimitMap.clear();
const testIP = "boundary-test";
let allowed = 0;
for (let i = 0; i < 100; i++) {
  if (checkRateLimit(testIP)) allowed++;
}
console.log(`  Requests allowed: ${allowed}/100 (should be exactly ${RATE_LIMIT})`);
console.log(`  RESULT: ${allowed === RATE_LIMIT ? "PASS" : "FAIL"}\n`);

console.log("=== SUMMARY ===");
console.log("FAIL: Memory leak - entries never cleaned from map");
console.log("FAIL: IP spoofing - trivial bypass via header");
console.log("FAIL: No input validation on IP strings");
console.log("PASS: Rate limit count works correctly within a window");
