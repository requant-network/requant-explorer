import { poolRpc, RpcError } from './rpc.mjs';
import { decodeAddress, hashPattern } from './format.mjs';

// Pool statistics come from the pool node's public JSON-RPC (poolstats, minerstats). Numbers arrive as
// decimal strings (lossless parsing): atoms stay strings, rates and counts become numbers for display.
const number = (value) =>
  value === null || value === undefined ? null : Number(value);
let snapshot,
  refreshing,
  lastAttempt = 0;

// What miners type: POOL_ENDPOINT, else the host and port of POOL_RPC_URL.
export function poolEndpoint() {
  if (process.env.POOL_ENDPOINT) return process.env.POOL_ENDPOINT;
  try {
    return new URL(process.env.POOL_RPC_URL).host;
  } catch {
    return 'POOL_HOST:19340';
  }
}

export function shapePool(s) {
  const rate = number(s.tickets_per_s),
    networkRate = number(s.network_tickets_per_s);
  return {
    address: s.address,
    rate,
    networkRate,
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
        workers: (m.workers || []).map((w) => ({
          name: String(w.name),
          rate: number(w.tickets_per_s),
          shares: number(w.shares),
          rejected: number(w.rejected),
          lastShare: number(w.last_share),
        })),
      }))
      .sort((a, b) => b.rate - a.rate),
    blocks: (s.blocks || []).slice(0, 15).map((b) => ({
      height: number(b.height),
      id: b.id,
      time: number(b.time),
      finder: b.finder,
      rewardAtoms: String(b.reward),
      effort: number(b.effort),
      status: String(b.status),
      confirmations: number(b.confirmations),
    })),
    payouts: (s.payouts || []).slice(0, 10).map((p) => ({
      txid: p.txid,
      time: number(p.time),
      totalAtoms: String(p.total),
      outputs: number(p.outputs),
      status: String(p.status),
    })),
  };
}

// The pool overview, refreshed at most every 15 seconds; a failure keeps the last snapshot, marked stale.
export async function pool() {
  if (snapshot && Date.now() - lastAttempt < 15000) return snapshot;
  if (refreshing) return refreshing;
  lastAttempt = Date.now();
  refreshing = (async () => {
    try {
      snapshot = {
        status: 'connected',
        observedAt: Date.now(),
        endpoint: poolEndpoint(),
        ...shapePool(await poolRpc('poolstats')),
      };
    } catch (error) {
      if (!snapshot) throw error;
      snapshot = { ...snapshot, status: 'stale', error: error.message };
    } finally {
      refreshing = null;
    }
    return snapshot;
  })();
  return refreshing;
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
    workers: (m.workers || []).map((w) => ({
      name: String(w.name),
      rate: number(w.tickets_per_s),
      shares: number(w.shares),
      rejected: number(w.rejected),
      lastShare: number(w.last_share),
    })),
    // [time, rate]
    history: (m.history || []).map((h) => ({
      time: number(h[0]),
      pool: number(h[1]),
    })),
    payouts: (m.payouts || []).slice(0, 20).map((p) => ({
      txid: p.txid,
      time: number(p.time),
      amountAtoms: String(p.amount),
      status: String(p.status),
    })),
  };
}

// One miner's statistics, by testnet address or key hash.
export async function poolMiner(who) {
  const value = String(who || '').trim();
  if (!hashPattern.test(value)) {
    try {
      decodeAddress(value.toLowerCase());
    } catch {
      throw new RpcError('Use a Requant testnet address.', 'invalid');
    }
  }
  return shapeMiner(await poolRpc('minerstats', [value.toLowerCase()]));
}
