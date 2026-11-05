import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { rpc, RpcError } from './rpc.mjs';
import { encodeAddress, decodeAddress, hashPattern } from './format.mjs';
import {
  initTransactions,
  storeTransactions,
  coverage,
  transactionPage,
  spending,
  pageOptions,
} from './transactions.mjs';
const blockSilenceMs = 20 * 60_000;
// Next bundles instrumentation and routes separately; they share one collector and index job.
function state() {
  const stores = (globalThis.__requantExplorerChains ??= new Map());
  const key = process.env.DATA_DIR || './data';
  if (!stores.has(key))
    stores.set(key, {
      database: null,
      refreshing: null,
      snapshot: null,
      lastAttempt: 0,
      backfilling: null,
      indexing: null,
    });
  return stores.get(key);
}
function db() {
  const cache = state();
  if (cache.database) return cache.database;
  const dir = resolve(
    /* turbopackIgnore: true */ process.env.DATA_DIR || './data'
  );
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  cache.database = new DatabaseSync(resolve(dir, 'explorer.sqlite'));
  cache.database.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS blocks(id TEXT PRIMARY KEY,height INTEGER NOT NULL,time INTEGER NOT NULL,data TEXT NOT NULL,active INTEGER NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS active_height ON blocks(height) WHERE active=1;
    CREATE TABLE IF NOT EXISTS samples(time INTEGER PRIMARY KEY,tip TEXT NOT NULL,height INTEGER NOT NULL,rate REAL,peers INTEGER NOT NULL,block_time INTEGER);`);
  initTransactions(cache.database);
  if (
    !cache.database
      .prepare('PRAGMA table_info(samples)')
      .all()
      .some((column) => column.name === 'block_time')
  )
    cache.database.exec('ALTER TABLE samples ADD COLUMN block_time INTEGER');
  return cache.database;
}
export function reconcileIndex(database, ancestorHeight) {
  database
    .prepare('UPDATE blocks SET active=0 WHERE height>? AND active=1')
    .run(ancestorHeight);
  database.prepare('DELETE FROM samples WHERE height>?').run(ancestorHeight);
}
function storeBlock(block) {
  db()
    .prepare('UPDATE blocks SET active=0 WHERE height=? AND id<>?')
    .run(Number(block.height), block.id);
  db()
    .prepare('INSERT OR REPLACE INTO blocks VALUES(?,?,?,?,1)')
    .run(
      block.id,
      Number(block.height),
      Number(block.time),
      JSON.stringify(block)
    );
}
function indexBatch(info) {
  const cache = state();
  if (cache.indexing) return cache.indexing;
  cache.indexing = buildIndex(info).finally(() => {
    cache.indexing = null;
  });
  return cache.indexing;
}
async function buildIndex(info) {
  await reconcileTip(info);
  const begin = nextMissingHeight(),
    end = Math.min(Number(info.height), begin + 63);
  const blocks = [];
  let bytes = 0;
  for (let height = begin; height <= end; height++) {
    const block = await rpc('getblock', [height]);
    if (
      blocks.length &&
      Buffer.from(block.hex, 'hex').subarray(12, 44).toString('hex') !==
        blocks.at(-1).id
    )
      throw new RpcError(
        'The chain changed during indexing. Retrying shortly.'
      );
    blocks.push(block);
    bytes += block.hex.length;
    if (bytes >= 16 * 1024 * 1024) break;
  }
  if (!blocks.length) return;
  const last = blocks.at(-1);
  if ((await rpc('getblock', [Number(last.height)])).id !== last.id)
    throw new RpcError('The chain changed during indexing. Retrying shortly.');
  db().exec('BEGIN IMMEDIATE');
  try {
    for (const block of blocks) storeBlock(block);
    db().exec('COMMIT');
  } catch (error) {
    db().exec('ROLLBACK');
    throw error;
  }
}
async function reconcileTip(info) {
  let top = db()
    .prepare(
      'SELECT height,id FROM blocks WHERE active=1 ORDER BY height DESC LIMIT 1'
    )
    .get();
  if (top) {
    let height = Math.min(top.height, Number(info.height));
    let block = await rpc('getblock', [height]);
    let steps = 0;
    while (
      height >= 0 &&
      db()
        .prepare('SELECT id FROM blocks WHERE height=? AND active=1')
        .get(height)?.id !== block.id
    ) {
      if (++steps > 16) {
        height = -1;
        break;
      }
      height--;
      if (height >= 0) block = await rpc('getblock', [height]);
    }
    if (height < top.height) {
      reconcileIndex(db(), height);
      top = height < 0 ? null : { height };
    }
  }
}
function nextMissingHeight() {
  if (!db().prepare('SELECT 1 FROM blocks WHERE active=1 AND height=0').get())
    return 0;
  return db()
    .prepare(
      `SELECT b.height+1 AS next FROM blocks b LEFT JOIN blocks n ON n.active=1 AND n.height=b.height+1
    WHERE b.active=1 AND n.id IS NULL ORDER BY b.height LIMIT 1`
    )
    .get().next;
}

export function backfillTransactions() {
  if (state().backfilling) return state().backfilling;
  state().backfilling = (async () => {
    const info = await rpc('getinfo');
    if (info.network !== 'test')
      throw new RpcError('The connected node is not on Requant testnet.');
    await indexBatch(info);
    let budget = 64;
    while (budget > 0) {
      const row = db()
        .prepare(
          `SELECT b.data FROM blocks b LEFT JOIN tx_blocks t ON t.block_id=b.id
        WHERE b.active=1 AND t.block_id IS NULL ORDER BY b.height DESC LIMIT 1`
        )
        .get();
      if (!row) break;
      const block = JSON.parse(row.data);
      const known = new Set(
        db()
          .prepare('SELECT txid FROM chain_txs WHERE block_id=?')
          .all(block.id)
          .map((t) => t.txid)
      );
      const missing = block.txids.filter((id) => !known.has(id));
      const batch = missing.slice(0, Math.min(4, budget));
      const txs = [];
      for (const id of batch) txs.push(await rpc('gettx', [id]));
      const current = await rpc('getblock', [Number(block.height)]);
      if (current.id !== block.id) {
        reconcileIndex(db(), Number(block.height) - 1);
        throw new RpcError(
          'The chain changed during indexing. Retrying shortly.'
        );
      }
      storeTransactions(db(), block, txs, batch.length === missing.length);
      budget -= Math.max(1, batch.length);
    }
  })().finally(() => {
    state().backfilling = null;
  });
  return state().backfilling;
}

export function estimatedRate(blocks) {
  if (blocks.length < 2) return null;
  const ordered = [...blocks].sort(
    (a, b) => Number(a.height) - Number(b.height)
  );
  const seconds = Number(ordered.at(-1).time) - Number(ordered[0].time);
  if (seconds <= 0) return null;
  const work = ordered
    .slice(1)
    .reduce(
      (sum, b) => sum + (1n << 256n) / (BigInt('0x' + b.target) + 1n),
      0n
    );
  return Number(work) / seconds;
}
async function update() {
  const info = await rpc('getinfo');
  if (info.network !== 'test')
    throw new RpcError('The connected node is not on Requant testnet.');
  const height = Number(info.height);
  await indexBatch(info);
  const heights = Array.from(
    { length: Math.min(height + 1, 121) },
    (_, i) => height - i
  );
  const blocks = [];
  for (let i = 0; i < heights.length; i += 4) {
    blocks.push(
      ...(await Promise.all(
        heights.slice(i, i + 4).map((h) => {
          const row = db()
            .prepare('SELECT data FROM blocks WHERE height=? AND active=1')
            .get(h);
          // reconcileTip checked canonical membership; a reorg invalidates the affected suffix.
          return row ? JSON.parse(row.data) : rpc('getblock', [h]);
        })
      ))
    );
  }
  const fresh = await rpc('getinfo');
  if (fresh.tip !== info.tip)
    throw new RpcError(
      'The chain changed during this update. Refresh shortly.'
    );
  for (const block of blocks) storeBlock(block);
  const now = Date.now(),
    stalled = now - Number(blocks[0].time) * 1000 > blockSilenceMs,
    measured = stalled ? null : estimatedRate(blocks);
  const latestIds = blocks
    .slice(0, 8)
    .flatMap((b) => b.txids.slice(0, 4))
    .slice(0, 8);
  const transactions = [];
  for (let i = 0; i < latestIds.length; i += 4)
    transactions.push(
      ...(await Promise.all(
        latestIds.slice(i, i + 4).map((id) =>
          getTransaction(id, {
            info,
            block: blocks.find((b) => b.txids.includes(id)),
          })
        )
      ))
    );
  db()
    .prepare(
      'INSERT OR REPLACE INTO samples(time,tip,height,rate,peers,block_time) VALUES(?,?,?,?,?,?)'
    )
    .run(
      Math.floor(now / 60000) * 60000,
      info.tip,
      height,
      measured,
      Number(info.peers),
      Number(blocks[0].time)
    );
  db()
    .prepare('DELETE FROM samples WHERE time<?')
    .run(now - 30 * 86400000);
  const indexHeight = nextMissingHeight() - 1;
  state().snapshot = {
    status: 'connected',
    network: 'testnet',
    observedAt: now,
    stalled,
    nodeVersion: info.version,
    height,
    tip: info.tip,
    issuedAtoms: info.issued_atoms,
    peers: Number(info.peers),
    // the observed node's address book plus the node itself (older nodes do not report it)
    knownNodes:
      info.known_addresses == null ? null : Number(info.known_addresses) + 1,
    mempool: Number(info.mempool),
    indexedTransactions: Number(info.indexed_txs),
    estimatedTicketsPerSecond: measured,
    rateWindow: blocks.length - 1,
    averageBlockSeconds:
      blocks.length > 1
        ? Math.max(
            0,
            (Number(blocks[0].time) - Number(blocks.at(-1).time)) /
              (blocks.length - 1)
          )
        : null,
    epoch: Math.floor(height / 1440),
    epochRemaining: 1440 - (height % 1440),
    indexCoverage: coverage(db(), height),
    latestBlockTime: Number(blocks[0].time),
    blocks: blocks.slice(0, 10).map(blockSummary),
    transactions,
    indexHeight,
    series: db()
      .prepare(
        `SELECT s.time, CASE WHEN s.time - COALESCE(s.block_time, b.time) * 1000 <= ?
        THEN s.rate ELSE NULL END AS rate FROM samples s
         LEFT JOIN blocks b ON b.id=s.tip WHERE s.time>=? ORDER BY s.time`
      )
      .all(blockSilenceMs, now - 86400000)
      .map(({ time, rate }) => ({ time, rate })),
    stale: false,
  };
  return state().snapshot;
}
export async function overview() {
  if (state().snapshot && Date.now() - state().lastAttempt < 15000) {
    if (!state().snapshot.observedAt) return state().snapshot;
    const stale =
      state().snapshot.stale ||
      Date.now() - state().snapshot.observedAt > 60000;
    return {
      ...state().snapshot,
      stale,
      status: stale ? 'stale' : state().snapshot.status,
    };
  }
  if (state().refreshing) return state().refreshing;
  state().lastAttempt = Date.now();
  state().refreshing = update()
    .catch((error) => {
      const message =
        error instanceof RpcError
          ? error.message
          : 'The explorer could not refresh the network snapshot.';
      state().snapshot = state().snapshot?.observedAt
        ? {
            ...state().snapshot,
            status: 'stale',
            stale: true,
            error: message,
          }
        : {
            status: 'unavailable',
            network: 'testnet',
            observedAt: null,
            error: message,
            blocks: [],
            transactions: [],
            series: [],
          };
      return state().snapshot;
    })
    .finally(() => {
      state().refreshing = null;
    });
  return state().refreshing;
}
export async function getBlock(key, offset = 0) {
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1000000)
    throw new RpcError('Invalid transaction page.', 'invalid');
  let block,
    active = true;
  if (/^\d{1,12}$/.test(key)) block = await rpc('getblock', [Number(key)]);
  else if (hashPattern.test(key)) {
    const row = db()
      .prepare('SELECT data,active FROM blocks WHERE id=?')
      .get(key.toLowerCase());
    if (!row)
      throw new RpcError(
        'Block hash is not in this explorer index yet. Try a block height or transaction ID.',
        'index-pending'
      );
    block = JSON.parse(row.data);
    active = !!row.active;
    try {
      const current = await rpc('getblock', [Number(block.height)]);
      active = current.id === block.id;
    } catch (error) {
      if (error.kind !== 'not-found') throw error;
      active = false;
    }
  } else
    throw new RpcError(
      'Enter a block height or a 64-character block hash.',
      'invalid'
    );
  const info = await rpc('getinfo'),
    bytes = Buffer.from(block.hex, 'hex');
  if (info.network !== 'test')
    throw new RpcError('The connected node is not on Requant testnet.');
  const transactions = [];
  if (active)
    for (let i = offset; i < Math.min(block.txids.length, offset + 40); i += 4)
      transactions.push(
        ...(await Promise.all(
          block.txids
            .slice(i, Math.min(i + 4, offset + 40))
            .map((id) => getTransaction(id, { info, block }))
        ))
      );
  const coinbase =
    active && block.txids.length
      ? offset === 0
        ? transactions[0]
        : await getTransaction(block.txids[0])
      : null;
  const previousBlock =
    Number(block.height) > 0
      ? await rpc('getblock', [Number(block.height) - 1])
      : null;
  const parent = bytes.subarray(12, 44).toString('hex');
  const complete = db()
    .prepare('SELECT 1 FROM tx_blocks WHERE block_id=?')
    .get(block.id);
  const feeRows = complete
    ? db()
        .prepare('SELECT data FROM chain_txs WHERE block_id=? AND coinbase=0')
        .all(block.id)
    : null;
  return {
    ...block,
    height: Number(block.height),
    time: Number(block.time),
    active,
    confirmations: active
      ? Math.max(0, Number(info.height) - Number(block.height) + 1)
      : 0,
    byteLength: bytes.length,
    previous: bytes.subarray(12, 44).toString('hex'),
    txRoot: bytes.subarray(44, 76).toString('hex'),
    nonce: bytes.length >= 132 ? bytes.readBigUInt64LE(116).toString() : null,
    row: bytes.length >= 132 ? bytes.readUInt32LE(124) : null,
    piece: bytes.length >= 132 ? bytes.readUInt32LE(128) : null,
    epoch: Math.floor(Number(block.height) / 1440),
    transactions,
    offset,
    nextOffset: offset + 40 < block.txids.length ? offset + 40 : null,
    transactionsTruncated: offset + 40 < block.txids.length,
    miner: coinbase?.outputs[0]?.address || null,
    rewardAtoms: coinbase?.outputs[0]?.value || null,
    fundAtoms: coinbase?.outputs[1]?.value || null,
    intervalSeconds:
      previousBlock?.id === parent
        ? Math.max(0, Number(block.time) - Number(previousBlock.time))
        : null,
    feesAtoms: feeRows
      ? feeRows
          .reduce((sum, t) => sum + BigInt(JSON.parse(t.data).fee), 0n)
          .toString()
      : null,
    observedAt: Date.now(),
  };
}
export async function getTransaction(id, context = null) {
  if (!hashPattern.test(id))
    throw new RpcError('Enter a 64-character transaction ID.', 'invalid');
  const info = context?.info || (await rpc('getinfo'));
  if (info.network !== 'test')
    throw new RpcError('The connected node is not on Requant testnet.');
  if (!context) await reconcileTip(info);
  const tx = await rpc('gettx', [id.toLowerCase()]);
  const progress = coverage(db(), Number(info.height));
  const block =
    tx.height === null
      ? null
      : context?.block || (await rpc('getblock', [Number(tx.height)]));
  if (block && !block.txids.includes(tx.txid))
    throw new RpcError(
      'The transaction moved during this update. Refresh shortly.'
    );
  const size = tx.hex.length / 2;
  return {
    ...tx,
    height: tx.height === null ? null : Number(tx.height),
    confirmations: Number(tx.confirmations),
    time: block ? Number(block.time) : null,
    blockId: block?.id || null,
    observedAt: Date.now(),
    maturityRemaining:
      tx.coinbase && tx.height !== null
        ? Math.max(0, 100 - (Number(info.height) + 1 - Number(tx.height)))
        : 0,
    feeRate: size ? ((BigInt(tx.fee) * 100n) / BigInt(size)).toString() : null,
    indexCoverage: progress,
    inputs: tx.inputs.map((input) => ({
      ...input,
      address: input.owner ? encodeAddress(input.owner) : null,
    })),
    outputs: tx.outputs.map((output, vout) => ({
      ...output,
      address: encodeAddress(output.owner),
      spentBy: spending(db(), tx.txid, vout),
    })),
    totalAtoms: tx.outputs
      .reduce((sum, out) => sum + BigInt(out.value), 0n)
      .toString(),
  };
}
export async function getAddress(address, params = {}) {
  const options = pageOptions(params);
  let owner;
  try {
    owner = decodeAddress(address);
  } catch {
    throw new RpcError(
      'Enter a valid Requant testnet address beginning with trq1.',
      'invalid'
    );
  }
  const info = await rpc('getinfo');
  if (info.network !== 'test')
    throw new RpcError('The connected node is not on Requant testnet.');
  await reconcileTip(info);
  const [utxos, history] = await Promise.all([
    rpc('utxos', [owner]),
    rpc('history', [owner, 100]),
  ]);
  const indexed = transactionPage(db(), Number(info.height), params, owner);
  const pending =
    !options.before &&
    options.from === null &&
    options.to === null &&
    ['all', 'pending', 'incoming', 'outgoing'].includes(options.kind)
      ? history
          .filter(
            (t) =>
              t.height === null &&
              (options.kind !== 'incoming' || BigInt(t.received) > 0n) &&
              (options.kind !== 'outgoing' || BigInt(t.sent) > 0n)
          )
          .map((t) => ({
            ...t,
            net: (BigInt(t.received) - BigInt(t.sent)).toString(),
            coinbase: false,
          }))
      : [];
  const recent = history
    .filter((t) => t.height !== null)
    .filter(
      (t) =>
        options.kind !== 'pending' &&
        (options.from === null || Number(t.time) >= options.from) &&
        (options.to === null || Number(t.time) < options.to) &&
        (options.kind !== 'incoming' || BigInt(t.received) > 0n) &&
        (options.kind !== 'outgoing' || BigInt(t.sent) > 0n)
    )
    .map((t) => ({
      ...t,
      net: (BigInt(t.received) - BigInt(t.sent)).toString(),
      coinbase: null,
    }));
  const entries =
    indexed.coverage.complete ||
    options.before ||
    ['coinbase', 'transfer'].includes(options.kind)
      ? indexed.entries
      : recent;
  const sum = (filter) =>
    utxos
      .filter(filter)
      .reduce((total, item) => total + BigInt(item.value), 0n)
      .toString();
  return {
    address: encodeAddress(owner),
    owner,
    availableAtoms: sum((item) => item.spendable),
    confirmedAtoms: sum((item) => item.confirmed),
    pendingAtoms: sum((item) => !item.confirmed),
    immatureAtoms: sum((item) => item.confirmed && !item.spendable),
    utxos,
    history: [...pending, ...entries],
    next: indexed.coverage.complete ? indexed.next : null,
    coverage: indexed.coverage,
    truncated: !indexed.coverage.complete && history.length === 100,
    observedAt: Date.now(),
    tipHeight: Number(info.height),
  };
}
export async function getTransactions(params = {}) {
  const options = pageOptions(params);
  const info = await rpc('getinfo');
  if (info.network !== 'test')
    throw new RpcError('The connected node is not on Requant testnet.');
  await reconcileTip(info);
  if (options.kind === 'pending') {
    if (options.from !== null || options.to !== null)
      throw new RpcError(
        'Pending transactions have no block date. Clear date filters.',
        'invalid'
      );
    if (params.after && !hashPattern.test(params.after))
      throw new RpcError('Invalid pending cursor.', 'invalid');
    const all = (await rpc('getrawmempool')).sort();
    const ids = all
      .filter((id) => !params.after || id > params.after)
      .slice(0, 51);
    const entries = [];
    for (let i = 0; i < Math.min(ids.length, 50); i += 4)
      entries.push(
        ...(await Promise.all(
          ids.slice(i, Math.min(i + 4, 50)).map(async (id) => {
            try {
              const tx = await getTransaction(id, { info });
              return tx.height === null ? tx : null;
            } catch (error) {
              if (error.kind === 'not-found') return null;
              throw error;
            }
          })
        ))
      );
    return {
      entries: entries.filter(Boolean),
      next: null,
      nextAfter: ids.length > 50 ? ids[49] : null,
      pendingTotal: all.length,
      coverage: coverage(db(), Number(info.height)),
      observedAt: Date.now(),
    };
  }
  const result = transactionPage(db(), Number(info.height), params);
  return {
    ...result,
    entries: result.entries.map((tx) => ({
      ...tx,
      totalAtoms: tx.outputs
        .reduce((sum, o) => sum + BigInt(o.value), 0n)
        .toString(),
    })),
    observedAt: Date.now(),
  };
}

export async function metrics(period = '24h') {
  const hours = new Map([
    ['1h', 1],
    ['24h', 24],
    ['7d', 168],
    ['30d', 720],
  ]).get(period);
  if (!hours) throw new RpcError('Invalid chart period.', 'invalid');
  const data = state().snapshot || (await overview());
  const start = Date.now() - hours * 3600000;
  const bucket = Math.max(60000, (hours * 3600000) / 240);
  const series = db()
    .prepare(
      'SELECT time,rate,block_time FROM samples WHERE time>=? ORDER BY time'
    )
    .all(start);
  const grouped = new Map();
  for (const s of series) {
    const key = Math.floor(s.time / bucket);
    grouped.set(key, {
      time: s.time,
      rate:
        s.time - Number(s.block_time) * 1000 > blockSilenceMs ? null : s.rate,
    });
  }
  const activity = db()
    .prepare(
      `SELECT CAST(time*1000/? AS INTEGER)*? AS time,
    AVG(CASE WHEN height=prev_height+1 AND time>=prev_time THEN time-prev_time ELSE NULL END) AS interval,
    SUM(MAX(CAST(json_extract(data,'$.txs') AS INTEGER)-1,0)) AS transfers
    FROM (SELECT height,time,data,LAG(height) OVER(ORDER BY height) AS prev_height,LAG(time) OVER(ORDER BY height) AS prev_time
      FROM blocks WHERE active=1 AND time>=?) GROUP BY 1 ORDER BY 1`
    )
    .all(bucket, bucket, Math.floor(start / 1000));
  const fees = db()
    .prepare(
      `SELECT t.time,json_extract(t.data,'$.fee') AS fee FROM chain_txs t JOIN blocks b ON b.id=t.block_id
    JOIN tx_blocks done ON done.block_id=t.block_id WHERE b.active=1 AND t.coinbase=0 AND t.time>=? ORDER BY t.time`
    )
    .iterate(Math.floor(start / 1000));
  const daily = new Map();
  for (const tx of fees) {
    const day = Math.floor(tx.time / 86400) * 86400000;
    daily.set(day, (daily.get(day) || 0n) + BigInt(tx.fee));
  }
  return {
    status:
      data.observedAt && Date.now() - data.observedAt > 60000
        ? 'stale'
        : data.status,
    unit: 'tickets/s',
    rateWindowBlocks: data.rateWindow || 0,
    stalled: data.stalled ?? null,
    latestBlockTime: data.latestBlockTime ?? null,
    observedAt: data.observedAt,
    series: [...grouped.values()],
    intervals: activity.map((b) => ({ time: b.time, value: b.interval })),
    transfers: activity.map((b) => ({ time: b.time, value: b.transfers })),
    fees: [...daily].map(([time, atoms]) => ({
      time,
      value: atoms.toString(),
    })),
    coverage: coverage(db(), Number(data.height || 0)),
    period,
  };
}

export async function search(query) {
  const q = query.trim();
  if (/^\d{1,12}$/.test(q)) return '/block/' + q;
  if (/^trq1/i.test(q)) {
    decodeAddress(q);
    return '/address/' + encodeAddress(decodeAddress(q));
  }
  if (hashPattern.test(q)) {
    if (db().prepare('SELECT id FROM blocks WHERE id=?').get(q.toLowerCase()))
      return '/block/' + q.toLowerCase();
    try {
      await getTransaction(q);
      return '/tx/' + q.toLowerCase();
    } catch (error) {
      if (error.kind === 'not-found')
        throw new RpcError(
          'No transaction found. Block hashes become searchable as the index catches up; you can search a block by height.',
          'index-pending'
        );
      throw error;
    }
  }
  throw new RpcError(
    'Search a block height, transaction ID, block hash or testnet address.',
    'invalid'
  );
}

function blockSummary(block) {
  const { hex, ...fields } = block;
  const tx = db()
    .prepare(
      'SELECT data FROM chain_txs WHERE block_id=? AND coinbase=1 LIMIT 1'
    )
    .get(block.id);
  const output = tx ? JSON.parse(tx.data).outputs[0] : null;
  return {
    ...fields,
    byteLength: hex.length / 2,
    miner: output ? encodeAddress(output.owner) : null,
  };
}

export async function blockList(before = null, limit = 20) {
  const info = await rpc('getinfo'),
    height = Number(info.height);
  if (info.network !== 'test')
    throw new RpcError('The connected node is not on Requant testnet.');
  const start = before === null ? height : Number(before);
  if (
    !Number.isSafeInteger(start) ||
    start < 0 ||
    start > height ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 20
  )
    throw new RpcError('Invalid block page.', 'invalid');
  const heights = Array.from(
      { length: Math.min(limit, start + 1) },
      (_, i) => start - i
    ),
    blocks = [];
  for (let i = 0; i < heights.length; i += 4)
    blocks.push(
      ...(await Promise.all(
        heights.slice(i, i + 4).map((h) => rpc('getblock', [h]))
      ))
    );
  const fresh = await rpc('getinfo');
  if (fresh.tip !== info.tip)
    throw new RpcError('The chain changed during this page. Please refresh.');
  return {
    network: 'testnet',
    tip: info.tip,
    observedAt: Date.now(),
    blocks: blocks.map(blockSummary),
    nextHeight: start - heights.length >= 0 ? start - heights.length : null,
  };
}
