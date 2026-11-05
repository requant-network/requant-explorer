import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pool, poolMiner } from '../src/pool.mjs';
import { poolDatabase, savedPoolSnapshot } from '../src/pool-store.mjs';
import { encodeAddress } from '../src/format.mjs';

test('pool and miner snapshots share one bounded cache across bundles and survive an outage', async () => {
  const originalFetch = globalThis.fetch,
    originalNow = Date.now;
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'requant-pool-test-'));
  process.env.POOL_RPC_URL = 'http://pool-test.invalid';
  delete process.env.RPC_URL;
  const owner = 'aa'.repeat(32),
    address = encodeAddress(owner);
  let time = 1793890200000,
    offline = false,
    poolCalls = 0,
    minerCalls = 0;
  const raw = {
    address,
    tickets_per_s: 1,
    network_tickets_per_s: 2,
    devices: 1,
    fee_percent: 1,
    min_payout_atoms: '100000000',
    payout_every_s: 600,
    maturity: 100,
    share_bits: 24,
    blocks_24h: 1,
    blocks_total: 1,
    last_block_time: time / 1000,
    round_effort: 0,
    paid_total: '18446744073709551615',
    payouts_total: 0,
    history: [],
    miners: [],
    blocks: [],
    payouts: [],
  };
  try {
    Date.now = () => time;
    globalThis.fetch = async (_url, options) => {
      if (offline) throw new Error('internal sensitive network detail');
      const { method, params } = JSON.parse(options.body);
      let result;
      if (method === 'poolstats') {
        poolCalls++;
        result = raw;
      } else if (method === 'minerstats') {
        minerCalls++;
        result = {
          ...raw,
          address: params[0],
          known: params[0] === address,
          balance: '9007199254740993',
          immature: '0',
          paid: '0',
          blocks_found: 0,
          workers: [],
          share_of_pool: 1,
        };
      } else throw new Error('Unexpected capability');
      return new Response(JSON.stringify({ result }));
    };
    const second = await import('../src/pool.mjs?second-bundle');
    const [a, b] = await Promise.all([pool(), second.pool()]);
    assert.equal(poolCalls, 1);
    assert.equal(a, b);
    const [m, n] = await Promise.all([
      poolMiner(owner),
      second.poolMiner(address),
    ]);
    assert.equal(minerCalls, 1);
    assert.equal(m, n);
    assert.equal(m.balanceAtoms, '9007199254740993');
    await poolMiner('bb'.repeat(32));
    assert.equal(
      savedPoolSnapshot(poolDatabase(), encodeAddress('bb'.repeat(32))),
      null,
      'unknown addresses do not grow the persistent archive'
    );
    offline = true;
    time += 16000;
    const stale = await pool();
    assert.equal(stale.status, 'stale');
    assert.equal(stale.observedAt, a.observedAt);
    assert.ok(!stale.error.includes('sensitive'));
    globalThis.__requantPoolStates.clear();
    const recovered = await second.pool();
    assert.equal(recovered.status, 'stale');
    assert.equal(recovered.paidTotalAtoms, a.paidTotalAtoms);
    const minerRecovered = await second.poolMiner(address);
    assert.equal(minerRecovered.status, 'stale');
    assert.equal(minerRecovered.balanceAtoms, m.balanceAtoms);
    offline = false;
    await Promise.allSettled(
      Array.from({ length: 200 }, (_, i) =>
        poolMiner((i + 1).toString(16).padStart(64, '0'))
      )
    );
    assert.ok(
      [...globalThis.__requantPoolStates.values()][0].entries.size <= 64,
      'in-flight requests cannot bypass the cache bound'
    );
    assert.equal(
      poolDatabase().prepare('SELECT COUNT(*) AS n FROM snapshots').get().n,
      2,
      'unknown addresses do not enter the archive'
    );
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});
