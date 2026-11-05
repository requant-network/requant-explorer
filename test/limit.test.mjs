import test from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter, visitorKey } from '../src/limit.mjs';
import { readResponse, publicError } from '../src/api.mjs';
import { RpcError } from '../src/rpc.mjs';

test('IPv6 visitors are counted by their /64, IPv4 by the address', () => {
  assert.equal(visitorKey('203.0.113.7'), '203.0.113.7');
  assert.equal(visitorKey('2001:db8:1:2:aaaa::1'), '2001:db8:1:2::/64');
  assert.equal(
    visitorKey('2001:DB8:1:2:ffff:ffff:ffff:ffff'),
    '2001:db8:1:2::/64'
  );
  assert.equal(visitorKey('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(visitorKey('2001:0db8:0001:0002::'), '2001:db8:1:2::/64');
  assert.equal(visitorKey(null), 'local');
});

test('the limiter refuses past the limit and forgives after the window', () => {
  let time = 0;
  const allow = createLimiter(3, () => time);
  for (let i = 0; i < 3; i++) assert.equal(allow('a').allowed, true);
  const refused = allow('a');
  assert.equal(refused.allowed, false);
  assert.equal(refused.retryAfter, 60);
  assert.equal(allow('b').allowed, true);
  time = 59_000;
  assert.equal(allow('a').retryAfter, 1);
  time = 60_000;
  assert.equal(allow('a').allowed, true);
});

test('API errors show the explorer own texts and hide internals', async () => {
  assert.equal(
    publicError(new Error('/opt/secrets/pool.sqlite: permission denied')),
    'The explorer could not complete this request.'
  );
  assert.equal(
    publicError(new RpcError('Use a testnet address.', 'invalid')),
    'Use a testnet address.'
  );
  const response = await readResponse(() => {
    throw new TypeError(
      "Cannot read properties of undefined (reading 'height')"
    );
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: 'The explorer could not complete this request.',
  });
});
