'use strict';

/** Small in-memory limiter for single-instance development deployments.
 * Use a shared store (e.g. Redis) before horizontally scaling the API.
 */
function createRateLimiter({ windowMs, max, now = Date.now, keyGenerator = (req) => req.ip || req.socket?.remoteAddress || 'unknown' }) {
  if (!Number.isFinite(windowMs) || windowMs <= 0 || !Number.isInteger(max) || max <= 0) {
    throw new TypeError('windowMs and max must be positive values.');
  }
  const buckets = new Map();

  return function rateLimit(req, res, next) {
    const time = now();
    const key = String(keyGenerator(req));
    let bucket = buckets.get(key);
    if (!bucket || time - bucket.startedAt >= windowMs) {
      bucket = { startedAt: time, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((windowMs - (time - bucket.startedAt)) / 1000))));
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }
    // Bound memory growth in a single-process server; stale entries are removed opportunistically.
    if (buckets.size > 5000) {
      for (const [entryKey, entry] of buckets) {
        if (time - entry.startedAt >= windowMs) buckets.delete(entryKey);
        if (buckets.size <= 4000) break;
      }
    }
    return next();
  };
}

module.exports = { createRateLimiter };
