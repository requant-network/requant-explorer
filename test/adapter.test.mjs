import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { overview, getBlock, getAddress } from '../src/chain.mjs';
import { encodeAddress } from '../src/format.mjs';
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'requant-chain-test-'));
process.env.RPC_URL = 'http://test-only.invalid';
const hash = (value) => value.toString(16).padStart(64, '0');
const target = ((1n << 255n) - 1n).toString(16).padStart(64, '0'),
  owner = hash(999);
let fork = false,
  offline = false,
  now = 1700000000000,
  tipHeight = 2,
  newBlockTime;
const blockTime = now / 1000 - 120;
const originalFetch = globalThis.fetch,
  originalNow = Date.now;
function block(height) {
  const bytes = Buffer.alloc(388);
  bytes.writeBigUInt64LE(123n, 116);
  bytes.writeUInt32LE(7, 124);
  return {
    id: hash((fork && height === 2 ? 100 : 0) + height),
    height,
    time: height === 3 ? newBlockTime : blockTime + height * 60,
    target,
    txs: 1,
    txids: [hash(1000 + height)],
    hex: bytes.toString('hex'),
  };
}
test('live snapshots, large balances, orphan status and cached outage state', async () => {
  const legacy = new DatabaseSync(
    join(process.env.DATA_DIR, 'explorer.sqlite')
  );
  legacy.exec(
    'CREATE TABLE samples(time INTEGER PRIMARY KEY,tip TEXT NOT NULL,height INTEGER NOT NULL,rate REAL,peers INTEGER NOT NULL)'
  );
  legacy.close();
  Date.now = () => now;
  globalThis.fetch = async (_url, options) => {
    if (offline) throw new Error('Offline');
    const { method, params } = JSON.parse(options.body);
    let result;
    if (method === 'getinfo')
      result = {
        network: 'test',
        height: tipHeight,
        tip: block(tipHeight).id,
        issued_atoms: '18446744073709551615',
        peers: 3,
        known_addresses: 5,
        mempool: 0,
        indexed_txs: 3,
        version: 'test',
      };
    else if (method === 'getblock') result = block(params[0]);
    else if (method === 'gettx')
      result = {
        txid: params[0],
        coinbase: true,
        height: 1,
        confirmations: 2,
        fee: '0',
        hex: '00',
        inputs: [],
        outputs: [{ owner, value: '18446744073709551615' }],
      };
    else if (method === 'utxos')
      result = [
        { value: '9007199254740993', confirmed: true, spendable: false },
        { value: '1', confirmed: false, spendable: true },
      ];
    else if (method === 'history') result = [];
    else throw new Error('Unexpected method');
    return new Response(JSON.stringify({ result, error: null }));
  };
  try {
    const first = await overview();
    assert.equal(first.status, 'connected');
    assert.equal(first.stalled, false);
    assert.ok(first.estimatedTicketsPerSecond > 0);
    assert.equal(first.issuedAtoms, '18446744073709551615');
    assert.equal(first.knownNodes, 6);
    assert.equal(first.peers, 3);
    assert.equal(first.indexHeight, 2);
    assert.equal(Object.getPrototypeOf(first.series[0]), Object.prototype);
    const address = await getAddress(encodeAddress(owner));
    assert.equal(address.immatureAtoms, '9007199254740993');
    assert.equal(address.availableAtoms, '1');
    fork = true;
    now += 16000;
    const next = await overview();
    assert.equal(next.tip, hash(102));
    const orphan = await getBlock(hash(2));
    assert.equal(orphan.active, false);
    assert.equal(orphan.confirmations, 0);
    assert.deepEqual(orphan.transactions, []);
    now += 25 * 60_000;
    const legacyTime = Math.floor(now / 60000) * 60000 - 60_000;
    const database = new DatabaseSync(
      join(process.env.DATA_DIR, 'explorer.sqlite')
    );
    database
      .prepare(
        'INSERT INTO samples(time,tip,height,rate,peers) VALUES(?,?,?,?,?)'
      )
      .run(legacyTime, next.tip, 2, 1337, 3);
    database.close();
    const paused = await overview();
    assert.equal(paused.status, 'connected');
    assert.equal(paused.stalled, true);
    assert.equal(paused.estimatedTicketsPerSecond, null);
    assert.equal(paused.series.at(-1).rate, null);
    assert.equal(paused.series.find((s) => s.time === legacyTime).rate, null);
    tipHeight = 3;
    newBlockTime = now / 1000;
    now += 16000;
    const resumed = await overview();
    assert.equal(resumed.stalled, false);
    assert.ok(resumed.estimatedTicketsPerSecond > 0);
    offline = true;
    now += 16000;
    const failure = await overview();
    assert.equal(failure.status, 'stale');
    assert.equal(failure.stale, true);
    const cached = await overview();
    assert.equal(cached.status, 'stale');
    assert.equal(cached.stale, true);
    assert.equal(cached.observedAt, resumed.observedAt);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

test('fresh rates remain visible before the historical index reaches the tip', async () => {
  const oldDirectory = process.env.DATA_DIR;
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'requant-index-lag-test-'));
  const currentHeight = 8040;
  globalThis.fetch = async (_url, options) => {
    const { method, params } = JSON.parse(options.body);
    const result =
      method === 'getinfo'
        ? {
            network: 'test',
            height: currentHeight,
            tip: hash(currentHeight),
            issued_atoms: '123',
            peers: 2,
            mempool: 0,
            indexed_txs: 0,
            version: 'test',
          }
        : {
            ...block(params[0]),
            id: hash(params[0]),
            txs: 0,
            txids: [],
            time:
              Math.floor(Date.now() / 1000) - (currentHeight - params[0]) * 60,
          };
    return new Response(JSON.stringify({ result, error: null }));
  };
  try {
    const { overview: catchingUp } = await import('../src/chain.mjs?index-lag');
    const data = await catchingUp();
    assert.equal(data.indexHeight, 63);
    assert.equal(data.stalled, false);
    assert.ok(data.estimatedTicketsPerSecond > 0);
    assert.equal(data.series.at(-1).rate, data.estimatedTicketsPerSecond);
  } finally {
    process.env.DATA_DIR = oldDirectory;
    globalThis.fetch = originalFetch;
  }
});
