import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { amount, encodeAddress, decodeAddress } from '../src/format.mjs';
import { rpc, parseRpcForTest } from '../src/rpc.mjs';
import { estimatedRate, reconcileIndex } from '../src/chain.mjs';
import { readResponse } from '../src/api.mjs';

test('amounts retain all 64-bit atom precision', () => {
  assert.equal(
    parseRpcForTest('{"value":18446744073709551615}').value,
    '18446744073709551615'
  );
  assert.equal(amount('18446744073709551615'), '184,467,440,737.09551615');
  assert.equal(amount('1'), '0.00000001');
  assert.equal(amount('-1'), '-0.00000001');
});
test('testnet address matches the published development-fund vector', () => {
  const address =
    'trq1qvfkg4mygtgkcthzsnjdpgqdujda8vm92cg62vas08aylluhf5gqsezeems';
  assert.equal(encodeAddress(decodeAddress(address)), address);
  assert.equal(decodeAddress(address.toUpperCase()), decodeAddress(address));
  assert.throws(() => decodeAddress(address.slice(0, -1) + 'q'));
  assert.throws(() => decodeAddress('rq' + address.slice(3)));
});
test('network rate derives work from each target, not GPU throughput', () => {
  const target = ((1n << 255n) - 1n).toString(16).padStart(64, '0');
  assert.equal(
    estimatedRate([
      { height: 1, time: 100, target },
      { height: 2, time: 160, target },
      { height: 3, time: 220, target },
    ]),
    4 / 120
  );
  assert.equal(
    estimatedRate([
      { height: 1, time: 160, target },
      { height: 2, time: 100, target },
    ]),
    null
  );
});
test('reorg preserves orphan blocks and removes measurements above the fork', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE blocks(height INTEGER,active INTEGER);CREATE TABLE samples(height INTEGER);INSERT INTO blocks VALUES(1,1),(2,1),(3,1);INSERT INTO samples VALUES(1),(3);'
  );
  reconcileIndex(db, 1);
  assert.deepEqual(
    db
      .prepare('SELECT height FROM blocks WHERE active=1')
      .all()
      .map((b) => b.height),
    [1]
  );
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM blocks WHERE active=0').get()
      .count,
    2
  );
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM samples').get().count,
    1
  );
  db.close();
});
test('adapter rejects mutation methods before making any network request', async () => {
  for (const method of [
    'getwork',
    'sendtx',
    'submitwork',
    'addpeer',
    'getpeerinfo',
  ])
    await assert.rejects(rpc(method), /Unsupported operation/);
});
test('node failure yields an explicit unavailable response', async () => {
  const previous = process.env.RPC_URL;
  delete process.env.RPC_URL;
  const response = await readResponse(() => rpc('getinfo'));
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /not configured/);
  if (previous) process.env.RPC_URL = previous;
});
