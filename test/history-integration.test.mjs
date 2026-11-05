import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { encodeAddress } from '../src/format.mjs';
import {
  backfillTransactions,
  getAddress,
  getBlock,
  getTransactions,
  overview,
  metrics,
} from '../src/chain.mjs';

test('backfill enables full history, block pagination and a shared snapshot across bundles', async () => {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'requant-history-'));
  process.env.RPC_URL = 'http://test-only.invalid';
  const original = globalThis.fetch,
    hash = (n) => n.toString(16).padStart(64, '0'),
    owner = hash(999);
  const ids = Array.from({ length: 121 }, (_, i) => hash(100 + i));
  const blocks = [0, 1].map((h) => {
    const bytes = Buffer.alloc(388);
    if (h) Buffer.from(hash(10), 'hex').copy(bytes, 12);
    return {
      id: hash(10 + h),
      height: h,
      time: Math.floor(Date.now() / 1000) - 60 + h * 60,
      target: '7'.repeat(64),
      txs: h ? 121 : 1,
      txids: h ? ids : [hash(1)],
      hex: bytes.toString('hex'),
    };
  });
  let infoCalls = 0;
  globalThis.fetch = async (_url, options) => {
    const { method, params } = JSON.parse(options.body);
    let result;
    if (method === 'getinfo') {
      infoCalls++;
      result = {
        network: 'test',
        height: 1,
        tip: blocks[1].id,
        peers: 1,
        mempool: 2,
        version: 'fixture',
        issued_atoms: '100000000',
      };
    } else if (method === 'getblock') result = blocks[Number(params[0])];
    else if (method === 'gettx') {
      const pending = params[0] === hash(500),
        coinbase = params[0] === hash(1) || params[0] === ids[0];
      result = {
        txid: params[0],
        height: pending ? null : params[0] === hash(1) ? 0 : 1,
        confirmations: pending ? 0 : 1,
        coinbase,
        fee: '1',
        hex: '0000',
        inputs: coinbase
          ? []
          : [{ txid: hash(1), vout: 0, owner, value: '9007199254740993' }],
        outputs: [
          { owner, value: coinbase ? '9007199254740993' : '9007199254740992' },
        ],
      };
    } else if (method === 'utxos')
      result = [
        {
          txid: hash(1),
          vout: 0,
          owner,
          value: '9007199254740993',
          height: 0,
          confirmed: true,
          spendable: false,
        },
      ];
    else if (method === 'history') result = [];
    else if (method === 'getrawmempool') result = [hash(500), ids[1]];
    else throw new Error('Unexpected fixture method');
    return new Response(JSON.stringify({ result, error: null }));
  };
  try {
    await backfillTransactions();
    await backfillTransactions();
    const a = await getAddress(encodeAddress(owner));
    assert.equal(a.coverage.complete, true);
    assert.equal(a.history.length, 50);
    const second = await getAddress(a.address, { before: a.next });
    const third = await getAddress(a.address, { before: second.next });
    assert.equal(
      a.history.length + second.history.length + third.history.length,
      122
    );
    const b = await getBlock('1', 80);
    assert.equal(b.transactions.length, 40);
    assert.equal(b.nextOffset, 120);
    assert.equal((await getBlock('1', 120)).transactions.length, 1);
    await assert.rejects(getBlock('1', -1), /Invalid transaction page/);
    const pending = await getTransactions({ kind: 'pending' });
    assert.equal(pending.entries.length, 1);
    assert.equal(pending.entries[0].height, null);
    await assert.rejects(
      getTransactions({ kind: 'pending', from: '2026-11-05' }),
      /no block date/
    );
    infoCalls = 0;
    const other = await import('../src/chain.mjs?separate-bundle');
    const [first, shared] = await Promise.all([overview(), other.overview()]);
    assert.equal(first.observedAt, shared.observedAt);
    assert.equal(infoCalls, 2, 'one refresh owns both callers');
    const chart = await metrics('24h');
    assert.equal(chart.fees[0].value, '120');
    await assert.rejects(metrics('__proto__'), /Invalid chart period/);
  } finally {
    globalThis.fetch = original;
  }
});
