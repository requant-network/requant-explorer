import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import {
  initTransactions,
  storeTransactions,
  transactionPage,
  spending,
  coverage,
  pageOptions,
} from '../src/transactions.mjs';
const hash = (n) => n.toString(16).padStart(64, '0');
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE blocks(id TEXT PRIMARY KEY,height INTEGER,time INTEGER,active INTEGER)'
  );
  initTransactions(db);
  const owner = hash(9),
    block = {
      id: hash(1000),
      height: 0,
      time: 1700000000,
      txids: Array.from({ length: 121 }, (_, i) => hash(i + 1)),
    };
  const txs = block.txids.map((txid, i) => ({
    txid,
    coinbase: i === 0,
    height: 0,
    fee: '1',
    hex: '00',
    inputs: i
      ? [{ txid: hash(i), vout: 0, owner, value: '9007199254740993' }]
      : [],
    outputs: [{ owner, value: i ? '9007199254740992' : '9007199254740993' }],
  }));
  db.prepare('INSERT INTO blocks VALUES(?,?,?,1)').run(block.id, 0, block.time);
  return { db, owner, block, txs };
}
test('history crosses 100 records with stable same-block cursors and exact movements', () => {
  const { db, owner, block, txs } = fixture();
  storeTransactions(db, block, txs);
  const first = transactionPage(db, 0, {}, owner),
    second = transactionPage(db, 0, { before: first.next }, owner),
    third = transactionPage(db, 0, { before: second.next }, owner);
  assert.deepEqual(
    [first.entries.length, second.entries.length, third.entries.length],
    [50, 50, 21]
  );
  assert.equal(
    new Set(
      [...first.entries, ...second.entries, ...third.entries].map((t) => t.txid)
    ).size,
    121
  );
  assert.equal(first.entries[0].sent, '9007199254740993');
  assert.equal(first.entries[0].net, '-1');
  assert.equal(third.next, null);
  assert.equal(coverage(db, 0).complete, true);
  assert.equal(
    transactionPage(db, 0, { kind: 'coinbase' }, owner).entries.length,
    1
  );
  assert.equal(spending(db, hash(1), 0).txid, hash(2));
  assert.throws(
    () => transactionPage(db, 0, { kind: 'incoming' }),
    /requires an address/
  );
  db.close();
});
test('partial blocks stay out of history; failed completion rolls back', () => {
  const { db, owner, block, txs } = fixture();
  storeTransactions(db, block, txs.slice(0, 4), false);
  assert.equal(transactionPage(db, 0, {}, owner).entries.length, 0);
  assert.equal(coverage(db, 0).complete, false);
  assert.throws(
    () => storeTransactions(db, block, txs.slice(4, 6)),
    /Incomplete block/
  );
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM chain_txs').get().n, 4);
  db.close();
});
test('reorg removes spending links and rejects a cursor from the replaced branch', () => {
  const { db, owner, block, txs } = fixture();
  storeTransactions(db, block, txs);
  const cursor = transactionPage(db, 0, {}, owner).next;
  db.exec('UPDATE blocks SET active=0');
  assert.equal(spending(db, hash(1), 0), null);
  assert.equal(coverage(db, 0).complete, false);
  const replacement = { ...block, id: hash(2000), txids: [hash(500)] };
  db.prepare('INSERT INTO blocks VALUES(?,?,?,1)').run(
    replacement.id,
    0,
    replacement.time
  );
  storeTransactions(db, replacement, [{ ...txs[0], txid: hash(500) }]);
  assert.throws(
    () => transactionPage(db, 0, { before: cursor }, owner),
    /chain changed/
  );
  assert.equal(transactionPage(db, 0, {}, owner).entries[0].txid, hash(500));
  db.close();
});
test('history filters reject malformed dates, injection and inverted ranges', () => {
  for (const params of [
    { from: '2026-02-30' },
    { from: '2026-12-01', to: '2026-01-01' },
    { kind: 'anything' },
    { before: '0 OR 1=1' },
  ])
    assert.throws(() => pageOptions(params));
  const options = pageOptions({ from: '2026-11-05', to: '2026-11-05' });
  assert.equal(options.to - options.from, 86400);
});
