import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  initPoolStore,
  savePoolSnapshot,
  savedPoolSnapshot,
  payoutPage,
  poolBlocks,
  poolChart,
  archiveOptions,
  reconcilePoolBlocks,
} from '../src/pool-store.mjs';
import { workerActive, rejectionPercent } from '../src/pool-format.mjs';
const now = 1793890200,
  hash = (n) => n.toString(16).padStart(64, '0');
const snapshot = (changes = {}) => ({
  observedAt: now * 1000,
  rate: 0,
  networkRate: 10,
  devices: 0,
  miners: [],
  history: [],
  blocks: [],
  payouts: [],
  ...changes,
});

test('collected payouts page past upstream windows, retain exact amounts and update status', () => {
  const db = initPoolStore(new DatabaseSync(':memory:'));
  const payouts = Array.from({ length: 123 }, (_, i) => ({
    txid: hash(i),
    time: now - 20,
    totalAtoms: '18446744073709551615',
    outputs: 1,
    status: 'pending',
  }));
  for (let i = 0; i < payouts.length; i += 30)
    savePoolSnapshot(
      db,
      'pool',
      snapshot({ payouts: payouts.slice(i, i + 30) })
    );
  let page = payoutPage(db),
    ids = [];
  while (true) {
    ids.push(...page.entries.map((p) => p.txid));
    if (!page.next) break;
    page = payoutPage(db, 'pool', { before: page.next });
  }
  assert.equal(ids.length, 123);
  assert.equal(new Set(ids).size, 123);
  assert.equal(page.entries[0].totalAtoms, '18446744073709551615');
  savePoolSnapshot(
    db,
    'pool',
    snapshot({ payouts: [{ ...payouts[0], status: 'returned' }] })
  );
  assert.equal(
    payoutPage(db, 'pool', { status: 'returned' }).entries[0].txid,
    hash(0)
  );
  assert.equal(payoutPage(db, 'pool').records, 123);
  assert.equal(payoutPage(db, 'someone').records, 0);
  assert.equal(
    payoutPage(db, 'pool').pendingAtoms,
    (BigInt('18446744073709551615') * 122n).toString()
  );
  db.close();
});
test('chart retains 30 days, keeps gaps, limits bins and records zero activity', () => {
  const db = initPoolStore(new DatabaseSync(':memory:'));
  const history = Array.from({ length: 31 * 288 }, (_, i) => ({
    time: now - i * 300,
    pool: i % 2 ? 0 : 3,
    network: 10,
    devices: i % 2 ? 0 : 1,
  }));
  savePoolSnapshot(db, 'pool', snapshot({ history }));
  const chart = poolChart(db, 'pool', '30d', now * 1000);
  assert.ok(chart.series.length <= 240);
  assert.equal(chart.samples, 30 * 288 + 1);
  assert.ok(chart.averageRate > 0 && chart.averageRate < 3);
  assert.ok(
    db.prepare('SELECT MIN(time) AS t FROM samples').get().t >= now - 30 * 86400
  );
  const later = now + 10 * 3600;
  savePoolSnapshot(db, 'pool', snapshot({ observedAt: later * 1000 }));
  const gaps = poolChart(db, 'pool', '24h', later * 1000).series;
  assert.ok(gaps.some((r, i) => i > 0 && r.time - gaps[i - 1].time > 3600));
  assert.equal(gaps.at(-1).rate, 0);
  assert.equal(gaps.at(-1).devices, 0);
  db.close();
});
test('miner samples and payouts are separate from the pool and independent of current response limits', () => {
  const db = initPoolStore(new DatabaseSync(':memory:'));
  savePoolSnapshot(
    db,
    'miner',
    snapshot({
      known: true,
      workers: [],
      history: [{ time: now - 300, pool: 7 }],
      payouts: [
        {
          txid: hash(9),
          time: now,
          amountAtoms: '9007199254740993',
          status: 'confirmed',
        },
      ],
    })
  );
  assert.equal(
    payoutPage(db, 'miner').entries[0].amountAtoms,
    '9007199254740993'
  );
  assert.equal(payoutPage(db).records, 0);
  assert.equal(savedPoolSnapshot(db, 'miner').known, true);
  assert.ok(poolChart(db, 'miner', '1h', now * 1000).samples >= 1);
  db.close();
});
test('archive block cursor works for equal heights and maturity counts use block confirmations', () => {
  const db = initPoolStore(new DatabaseSync(':memory:'));
  savePoolSnapshot(
    db,
    'pool',
    snapshot({
      blocks: Array.from({ length: 25 }, (_, i) => ({
        id: hash(i),
        height: 100,
        time: now,
        status: 'immature',
        confirmations: 1,
        rewardAtoms: '1',
        finder: 'm',
      })),
    })
  );
  const first = poolBlocks(db, {}, 120, 100),
    second = poolBlocks(db, { before: first.next }, 120, 100);
  assert.equal(first.entries.length, 20);
  assert.equal(second.entries.length, 5);
  assert.equal(first.entries[0].maturityRemaining, 79);
  db.close();
});
test('filters reject invalid dates, cursors, statuses and chart periods', () => {
  for (const query of [
    { from: '2026-02-30' },
    { from: '2026-02-01', to: '2026-01-01' },
    { before: '0:abc' },
    { status: 'x;drop table payouts' },
  ])
    assert.throws(() => archiveOptions(query), { kind: 'invalid' });
  const db = initPoolStore(new DatabaseSync(':memory:'));
  assert.throws(() => poolChart(db, 'pool', 'forever'), { kind: 'invalid' });
  assert.equal(
    archiveOptions({ from: '2026-01-01', to: '2026-01-01' }).to -
      archiveOptions({ from: '2026-01-01' }).from,
    86400
  );
  db.close();
});
test('archived block maturity and orphan filters follow the canonical index, including a returning branch', () => {
  const db = initPoolStore(new DatabaseSync(':memory:'));
  savePoolSnapshot(
    db,
    'pool',
    snapshot({
      blocks: [
        {
          id: hash(3),
          height: 100,
          time: now,
          status: 'immature',
          confirmations: 1,
          rewardAtoms: '3',
          finder: 'm',
        },
      ],
    })
  );
  reconcilePoolBlocks(
    db,
    [{ id: hash(3), active: true }],
    200,
    100,
    now * 1000
  );
  assert.equal(poolBlocks(db, { status: 'credited' }, 200).entries.length, 1);
  reconcilePoolBlocks(
    db,
    [{ id: hash(3), active: false }],
    200,
    100,
    now * 1000
  );
  const orphan = poolBlocks(db, { status: 'orphaned' }, 200).entries[0];
  assert.equal(orphan.confirmations, 0);
  assert.equal(poolBlocks(db, { status: 'credited' }, 200).entries.length, 0);
  reconcilePoolBlocks(
    db,
    [{ id: hash(3), active: true }],
    120,
    100,
    now * 1000
  );
  assert.equal(
    poolBlocks(db, { status: 'immature' }, 120).entries[0].maturityRemaining,
    79
  );
  db.close();
});
test('device activity and rejection ratios do not overflow large counters', () => {
  assert.equal(
    rejectionPercent({
      shares: '18446744073709551615',
      rejected: '18446744073709551615',
    }),
    50
  );
  assert.equal(rejectionPercent({ shares: '0', rejected: '0' }), null);
  assert.equal(workerActive({ rate: 1, lastShare: now - 599 }, now), true);
  assert.equal(workerActive({ rate: 1, lastShare: now - 601 }, now), false);
  assert.equal(workerActive({ rate: 0, lastShare: now }, now), false);
});
