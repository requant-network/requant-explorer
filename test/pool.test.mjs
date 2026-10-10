import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRpcForTest, poolRpc } from '../src/rpc.mjs';
import { shapePool, shapeMiner, poolMiner } from '../src/pool.mjs';

const answer = parseRpcForTest(`{"result":{
  "address":"trq1qvfkg4mygtgkcthzsnjdpgqdujda8vm92cg62vas08aylluhf5gqsezeems",
  "tickets_per_s":3310175.83,"network_tickets_per_s":3228817.15,"devices":1,"fee_percent":1.0,
  "min_payout_atoms":100000000,"payout_every_s":600,"maturity":100,"share_bits":24,
  "blocks_24h":1115,"blocks_total":1115,"last_block_time":1791645539,"round_effort":0.85,"effort_avg":null,
  "paid_total":18446744073709551615,"payouts_total":106,
  "history":[[1791607538,8633215.78,8486225.29,2]],
  "miners":[{"address":"a","tickets_per_s":1,"balance":5,"immature":6,"paid":7,"blocks_found":1,"last_share":2,
             "workers":[{"name":"rig1","tickets_per_s":1,"shares":3,"rejected":0,"last_share":2}]},
            {"address":"b","tickets_per_s":9,"balance":0,"immature":0,"paid":0,"blocks_found":0,"last_share":0,"workers":[]}],
  "blocks":[{"height":1415,"id":"x","time":1,"finder":"a","reward":375873263,"effort":1.5,"status":"immature","confirmations":1}],
  "payouts":[{"txid":"t","time":1,"total":2232743986,"outputs":1,"status":"pending"}]}}`).result;

test('pool statistics keep atoms exact and order miners by rate', () => {
  const s = shapePool(answer);
  assert.equal(s.paidTotalAtoms, '18446744073709551615');
  assert.equal(s.minPayoutAtoms, '100000000');
  assert.equal(s.rate, 3310175.83);
  assert.ok(s.share > 1, 'both rates are estimates; the page caps the display');
  assert.equal(s.effortAverage, null);
  assert.deepEqual(
    s.miners.map((m) => m.address),
    ['b', 'a']
  );
  assert.equal(s.miners[1].workers[0].name, 'rig1');
  assert.deepEqual(s.history[0], {
    time: 1791607538,
    pool: 8633215.78,
    network: 8486225.29,
  });
  assert.equal(s.blocks[0].rewardAtoms, '375873263');
  assert.equal(s.payouts[0].totalAtoms, '2232743986');
});

test('miner statistics and lookups', async () => {
  const m = shapeMiner(
    parseRpcForTest(
      '{"address":"a","known":true,"tickets_per_s":2.5,"share_of_pool":0.5,"balance":1,"immature":2,"paid":3,"min_payout_atoms":100000000,"payout_every_s":600,"blocks_found":4,"workers":[],"history":[[1,2]],"payouts":[{"txid":"t","time":1,"amount":9,"status":"confirmed"}]}'
    )
  );
  assert.equal(m.known, true);
  assert.equal(m.payouts[0].amountAtoms, '9');
  assert.deepEqual(m.history[0], { time: 1, pool: 2 });
  await assert.rejects(poolMiner('not an address'), { kind: 'invalid' });
});

test('the pool adapter allows only its statistics methods', async () => {
  await assert.rejects(poolRpc('sendtx', ['00']), { kind: 'invalid' });
  await assert.rejects(poolRpc('getwork'), { kind: 'invalid' });
});
