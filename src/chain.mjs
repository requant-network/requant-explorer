import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { rpc, RpcError } from './rpc.mjs';
import { encodeAddress, decodeAddress, hashPattern } from './format.mjs';
const blockSilenceMs = 20 * 60_000;
let database,
  refreshing,
  snapshot,
  lastAttempt = 0;
function db() {
  if (database) return database;
  const dir = resolve(
    /* turbopackIgnore: true */ process.env.DATA_DIR || './data'
  );
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  database = new DatabaseSync(resolve(dir, 'explorer.sqlite'));
  database.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS blocks(id TEXT PRIMARY KEY,height INTEGER NOT NULL,time INTEGER NOT NULL,data TEXT NOT NULL,active INTEGER NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS active_height ON blocks(height) WHERE active=1;
    CREATE TABLE IF NOT EXISTS samples(time INTEGER PRIMARY KEY,tip TEXT NOT NULL,height INTEGER NOT NULL,rate REAL,peers INTEGER NOT NULL,block_time INTEGER);`);
  if (
    !database
      .prepare('PRAGMA table_info(samples)')
      .all()
      .some((column) => column.name === 'block_time')
  )
    database.exec('ALTER TABLE samples ADD COLUMN block_time INTEGER');
  return database;
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
async function indexBatch(info) {
  let top = db()
    .prepare(
      'SELECT height,id FROM blocks WHERE active=1 ORDER BY height DESC LIMIT 1'
    )
    .get();
  if (top) {
    let height = Math.min(top.height, Number(info.height));
    let block = await rpc('getblock', [height]);
    while (
      height >= 0 &&
      db()
        .prepare('SELECT id FROM blocks WHERE height=? AND active=1')
        .get(height)?.id !== block.id
    ) {
      height--;
      if (height >= 0) block = await rpc('getblock', [height]);
    }
    if (height < top.height) {
      reconcileIndex(db(), height);
      top = height < 0 ? null : { height };
    }
  }
  const begin = top ? top.height + 1 : 0,
    end = Math.min(Number(info.height), begin + 63);
  for (let height = begin; height <= end; height++)
    storeBlock(await rpc('getblock', [height]));
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
          // Current tip and the window are read again: never trust a stale fork in the recent cache.
          return rpc('getblock', [h]);
        })
      ))
    );
  }
  const fresh = await rpc('getinfo');
  if (fresh.tip !== info.tip)
    throw new RpcError(
      'The chain changed during this update. Refresh shortly.'
    );
  const now = Date.now(),
    stalled = now - Number(blocks[0].time) * 1000 > blockSilenceMs,
    measured = stalled ? null : estimatedRate(blocks);
  const transactions = await Promise.all(
    blocks
      .slice(0, 8)
      .flatMap((b) => b.txids.slice(0, 4))
      .slice(0, 8)
      .map((id) => getTransaction(id))
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
    .run(now - 86400000);
  const indexHeight = db()
    .prepare('SELECT MAX(height) AS height FROM blocks WHERE active=1')
    .get().height;
  snapshot = {
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
    latestBlockTime: Number(blocks[0].time),
    blocks: blocks.slice(0, 10),
    transactions,
    indexHeight,
    series: db()
      .prepare(
        `SELECT s.time, CASE WHEN s.time - COALESCE(s.block_time, b.time) * 1000 <= ?
        THEN s.rate ELSE NULL END AS rate FROM samples s
        LEFT JOIN blocks b ON b.id=s.tip ORDER BY s.time`
      )
      .all(blockSilenceMs)
      .map(({ time, rate }) => ({ time, rate })),
    stale: false,
  };
  return snapshot;
}
export async function overview() {
  if (snapshot && Date.now() - lastAttempt < 15000) {
    if (!snapshot.observedAt) return snapshot;
    const stale = snapshot.stale || Date.now() - snapshot.observedAt > 60000;
    return { ...snapshot, stale, status: stale ? 'stale' : snapshot.status };
  }
  if (refreshing) return refreshing;
  lastAttempt = Date.now();
  refreshing = update()
    .catch((error) => {
      snapshot = snapshot?.observedAt
        ? { ...snapshot, status: 'stale', stale: true, error: error.message }
        : {
            status: 'unavailable',
            network: 'testnet',
            observedAt: null,
            error: error.message,
            blocks: [],
            transactions: [],
            series: [],
          };
      return snapshot;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}
export async function getBlock(key) {
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
    for (let i = 0; i < Math.min(block.txids.length, 40); i += 4)
      transactions.push(
        ...(await Promise.all(
          block.txids
            .slice(i, Math.min(i + 4, 40))
            .map((id) => getTransaction(id))
        ))
      );
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
    transactionsTruncated: block.txids.length > 40,
  };
}
export async function getTransaction(id) {
  if (!hashPattern.test(id))
    throw new RpcError('Enter a 64-character transaction ID.', 'invalid');
  const info = await rpc('getinfo');
  if (info.network !== 'test')
    throw new RpcError('The connected node is not on Requant testnet.');
  const tx = await rpc('gettx', [id.toLowerCase()]);
  return {
    ...tx,
    height: tx.height === null ? null : Number(tx.height),
    confirmations: Number(tx.confirmations),
    inputs: tx.inputs.map((input) => ({
      ...input,
      address: input.owner ? encodeAddress(input.owner) : null,
    })),
    outputs: tx.outputs.map((output) => ({
      ...output,
      address: encodeAddress(output.owner),
    })),
    totalAtoms: tx.outputs
      .reduce((sum, out) => sum + BigInt(out.value), 0n)
      .toString(),
  };
}
export async function getAddress(address) {
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
  const [utxos, history] = await Promise.all([
    rpc('utxos', [owner]),
    rpc('history', [owner, 100]),
  ]);
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
    history,
    limit: 100,
    truncated: history.length === 100,
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
    blocks: blocks.map(({ hex, ...block }) => block),
    nextHeight: start - heights.length >= 0 ? start - heights.length : null,
  };
}
