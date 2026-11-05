import { poolRpc, RpcError } from './rpc.mjs';
import { parsePayee } from './format.mjs';
import { overview, indexedPoolBlocks } from './chain.mjs';
import {
  poolDatabase,
  savePoolSnapshot,
  savedPoolSnapshot,
  poolChart,
  payoutPage,
  poolBlocks,
  reconcilePoolBlocks,
} from './pool-store.mjs';

// Pool statistics come from the pool node's public JSON-RPC (poolstats, minerstats). Numbers arrive as
// decimal strings (lossless parsing): atoms stay strings, rates and counts become numbers for display.
const number = (value) =>
  value === null || value === undefined ? null : Number(value);
function state() {
  const stores = (globalThis.__requantPoolStates ??= new Map());
  const key =
    (process.env.DATA_DIR || './data') + '|' + (process.env.POOL_RPC_URL || '');
  if (!stores.has(key))
    stores.set(key, { entries: new Map(), collecting: null, cursor: 0 });
  return stores.get(key);
}
const workers = (list = []) =>
  list.map((w) => ({
    name: String(w.name),
    rate: number(w.tickets_per_s),
    shares: String(w.shares ?? 0),
    rejected: String(w.rejected ?? 0),
    lastShare: number(w.last_share),
  }));

// Public miner endpoint is independent of the adapter's internal RPC URL.
export function poolEndpoint() {
  return process.env.POOL_ENDPOINT || 'pool.requant.network:19340';
}

export function shapePool(s) {
  const rate = number(s.tickets_per_s),
    networkRate = number(s.network_tickets_per_s);
  return {
    address: s.address,
    rate,
    networkRate,
    rateWindowSeconds: 600,
    networkWindowBlocks: 60,
    share: networkRate ? rate / networkRate : null,
    devices: number(s.devices),
    feePercent: number(s.fee_percent),
    minPayoutAtoms: String(s.min_payout_atoms),
    payoutEverySeconds: number(s.payout_every_s),
    maturity: number(s.maturity),
    shareBits: number(s.share_bits),
    blocks24h: number(s.blocks_24h),
    blocksTotal: number(s.blocks_total),
    lastBlockTime: number(s.last_block_time),
    roundEffort: number(s.round_effort),
    effortAverage: number(s.effort_avg),
    paidTotalAtoms: String(s.paid_total ?? 0),
    payoutsTotal: number(s.payouts_total),
    // [time, pool rate, network rate] every few minutes
    history: (s.history || []).map((h) => ({
      time: number(h[0]),
      pool: number(h[1]),
      network: number(h[2]),
      devices: number(h[3]),
    })),
    miners: (s.miners || [])
      .map((m) => ({
        address: m.address,
        rate: number(m.tickets_per_s),
        balanceAtoms: String(m.balance),
        immatureAtoms: String(m.immature),
        paidAtoms: String(m.paid),
        blocks: number(m.blocks_found),
        lastShare: number(m.last_share),
        workers: workers(m.workers),
      }))
      .sort((a, b) => b.rate - a.rate),
    hourly: (s.hourly || []).map((h) => ({
      time: number(h[0]),
      rate: number(h[1]),
      network: number(h[2]),
    })),
    height: number(s.network?.height),
    roundShares: String(s.round_shares ?? 0),
    blocks: (s.blocks || []).map((b) => ({
      height: number(b.height),
      id: b.id,
      time: number(b.time),
      finder: b.finder,
      rewardAtoms: String(b.reward),
      effort: number(b.effort),
      status: String(b.status),
      confirmations: number(b.confirmations),
    })),
    payouts: (s.payouts || []).map((p) => ({
      txid: p.txid,
      time: number(p.time),
      totalAtoms: String(p.total),
      outputs: number(p.outputs),
      status: String(p.status),
    })),
  };
}

// The pool overview, refreshed at most every 15 seconds; a failure keeps the last snapshot, marked stale.
async function cached(owner, load) {
  const entries = state().entries;
  let entry = entries.get(owner);
  if (!entry) {
    if (entries.size >= 64) {
      const oldest = [...entries.keys()].find(
        (k) => k !== 'pool' && !entries.get(k).promise
      );
      if (!oldest)
        throw new RpcError('The pool explorer is busy. Please try again.');
      entries.delete(oldest);
    }
    entry = {
      value: savedPoolSnapshot(poolDatabase(), owner),
      attempt: 0,
      promise: null,
    };
    entries.set(owner, entry);
  }
  if (entry.promise) return entry.promise;
  if (entry.value && Date.now() - entry.attempt < 15000) return entry.value;
  entry.attempt = Date.now();
  entry.promise = (async () => {
    try {
      const value = {
        ...(await load()),
        status: 'connected',
        observedAt: Date.now(),
      };
      if (owner === 'pool' || value.known)
        savePoolSnapshot(poolDatabase(), owner, value);
      entry.value = value;
    } catch (error) {
      if (!entry.value) throw error;
      entry.value = {
        ...entry.value,
        status: 'stale',
        error:
          error instanceof RpcError
            ? error.message
            : 'Pool statistics are temporarily unavailable.',
      };
    } finally {
      entry.promise = null;
    }
    return entry.value;
  })();
  return entry.promise;
}
export async function pool() {
  return cached('pool', async () => {
    const raw = await poolRpc('poolstats');
    let chain = null;
    if (process.env.RPC_URL) {
      try {
        const s = await overview();
        chain = {
          height: s.height,
          latestBlockTime: s.latestBlockTime,
          stalled: s.stalled,
          stale: s.stale,
          tip: s.tip,
          observedAt: s.observedAt,
        };
      } catch {
        /* Pool statistics remain usable when the chain observer is unavailable. */
      }
    }
    return { ...shapePool(raw), endpoint: poolEndpoint(), chain };
  });
}

export function shapeMiner(m) {
  return {
    address: m.address,
    known: m.known === true || m.known === 'true',
    rate: number(m.tickets_per_s),
    share: number(m.share_of_pool),
    balanceAtoms: String(m.balance),
    immatureAtoms: String(m.immature),
    paidAtoms: String(m.paid),
    minPayoutAtoms: String(m.min_payout_atoms),
    payoutEverySeconds: number(m.payout_every_s),
    blocks: number(m.blocks_found),
    workers: workers(m.workers),
    // [time, rate]
    history: (m.history || []).map((h) => ({
      time: number(h[0]),
      pool: number(h[1]),
    })),
    hourly: (m.hourly || []).map((h) => ({
      time: number(h[0]),
      rate: number(h[1]),
      network: number(h[2]),
    })),
    payouts: (m.payouts || []).map((p) => ({
      txid: p.txid,
      time: number(p.time),
      amountAtoms: String(p.amount),
      status: String(p.status),
    })),
  };
}

// One miner's statistics, by testnet address or key hash.
export async function poolMiner(who) {
  let parsed;
  try {
    parsed = parsePayee(who);
  } catch {
    throw new RpcError(
      'Use a valid Requant testnet address or public key hash.',
      'invalid'
    );
  }
  return cached(parsed.address, async () =>
    shapeMiner(await poolRpc('minerstats', [parsed.address]))
  );
}
export async function collectPool() {
  const s = state();
  if (s.collecting) return s.collecting;
  s.collecting = (async () => {
    const data = await pool();
    // Two addresses per pass seed the node's retained histories without fanning out requests.
    for (let i = 0; i < Math.min(2, data.miners.length); i++) {
      const m = data.miners[s.cursor++ % data.miners.length];
      await poolMiner(m.address);
    }
  })().finally(() => {
    s.collecting = null;
  });
  return s.collecting;
}
export async function poolMetrics(params = {}) {
  const data = await pool();
  const miner = params.address ? await poolMiner(params.address) : null;
  return {
    ...poolChart(
      poolDatabase(),
      miner?.address || 'pool',
      params.period || '24h'
    ),
    hourly: miner?.hourly || data.hourly,
    status: miner?.status || data.status,
    observedAt: miner?.observedAt || data.observedAt,
  };
}
export function poolPayouts(owner = 'pool', params = {}) {
  return payoutPage(poolDatabase(), owner, params);
}
export function poolBlockPage(params = {}, data) {
  if (data.chain && !data.chain.stale) {
    const db = poolDatabase();
    const records = db.prepare('SELECT id,height FROM blocks').all();
    reconcilePoolBlocks(
      db,
      indexedPoolBlocks(records),
      data.chain.height,
      data.maturity,
      data.chain.observedAt
    );
  }
  return poolBlocks(
    poolDatabase(),
    params,
    data.chain?.height ?? data.height,
    data.maturity
  );
}
