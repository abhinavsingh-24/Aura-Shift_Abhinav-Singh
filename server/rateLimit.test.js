'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter } = require('./rateLimit');

function response() {
  return { headers: {}, statusCode: 200, body: null,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('rate limiter allows requests up to the configured maximum', () => {
  const limiter = createRateLimiter({ windowMs: 1000, max: 2, now: () => 10, keyGenerator: () => 'client' });
  let nextCount = 0;
  for (let i = 0; i < 2; i++) { const res = response(); limiter({ ip: 'x' }, res, () => nextCount++); assert.equal(res.statusCode, 200); }
  assert.equal(nextCount, 2);
});

test('rate limiter returns 429 and retry headers after the limit', () => {
  const limiter = createRateLimiter({ windowMs: 5000, max: 1, now: () => 100, keyGenerator: () => 'client' });
  limiter({}, response(), () => {});
  const res = response();
  limiter({}, res, () => assert.fail('must not continue after limit'));
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers['Retry-After'], '5');
  assert.match(res.body.message, /Too many requests/);
});

test('rate limiter resets a client after the window', () => {
  let time = 0;
  const limiter = createRateLimiter({ windowMs: 100, max: 1, now: () => time, keyGenerator: () => 'client' });
  limiter({}, response(), () => {});
  const limited = response(); limiter({}, limited, () => {}); assert.equal(limited.statusCode, 429);
  time = 101;
  const res = response(); let proceeded = false; limiter({}, res, () => { proceeded = true; });
  assert.equal(proceeded, true); assert.equal(res.statusCode, 200);
});

test('invalid rate limiter settings are rejected', () => {
  assert.throws(() => createRateLimiter({ windowMs: 0, max: 2 }), /positive/);
  assert.throws(() => createRateLimiter({ windowMs: 1000, max: 1.5 }), /positive/);
});
