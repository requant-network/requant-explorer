import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { RpcError } from './rpc.mjs';
import { workerActive } from './pool-format.mjs';

export function initPoolStore(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots(owner TEXT PRIMARY KEY,data TEXT NOT NULL,observed INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS samples(owner TEXT NOT NULL,time INTEGER NOT NULL,observed INTEGER NOT NULL,
      rate REAL,network REAL,devices INTEGER,PRIMARY KEY(owner,time));
    CREATE TABLE IF NOT EXISTS payouts(owner TEXT NOT NULL,txid TEXT NOT NULL,time INTEGER NOT NULL,
      amount TEXT NOT NULL,outputs INTEGER,status TEXT NOT NULL,observed INTEGER NOT NULL,PRIMARY KEY(owner,txid));
    CREATE INDEX IF NOT EXISTS payouts_order ON payouts(owner,time DESC,txid DESC);
    CREATE INDEX IF NOT EXISTS payouts_status ON payouts(owner,status,time DESC,txid DESC);
    CREATE TABLE IF NOT EXISTS blocks(id TEXT PRIMARY KEY,height INTEGER NOT NULL,time INTEGER NOT NULL,data TEXT NOT NULL,observed INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS blocks_order ON blocks(height DESC,id DESC);
  `);
  return db;
}
export function poolDatabase() {
  const stores = (globalThis.__requantPoolDatabases ??= new Map());
  const directory = resolve(
    /* turbopackIgnore: true */ process.env.DATA_DIR || './data'
  );
  if (!stores.has(directory)) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const db = new DatabaseSync(resolve(directory, 'pool.sqlite'));
    db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=2000;');
    stores.set(directory, initPoolStore(db));
  }
  return stores.get(directory);
}
export function savePoolSnapshot(db, owner, data) {
  const at = Math.floor(data.observedAt / 1000);
  const sample =
    db.prepare(`INSERT INTO samples VALUES(?,?,?,?,?,?) ON CONFLICT(owner,time) DO UPDATE SET
    observed=excluded.observed,rate=excluded.rate,network=COALESCE(excluded.network,samples.network),
    devices=COALESCE(excluded.devices,samples.devices) WHERE excluded.observed>=samples.observed`);
  const putSample = (who, time, rate, network, devices) => {
    if (!Number.isFinite(time) || time < at - 30 * 86400 || time > at + 60)
      return;
    sample.run(who, Math.floor(time / 300) * 300, time, rate, network, devices);
  };
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT OR REPLACE INTO snapshots VALUES(?,?,?)').run(
      owner,
      JSON.stringify(data),
      at
    );
    for (const h of data.history)
      putSample(owner, h.time, h.pool, h.network ?? null, h.devices ?? null);
    putSample(
      owner,
      at,
      data.rate,
      owner === 'pool' ? data.networkRate : null,
      owner === 'pool'
        ? data.devices
        : data.workers.filter((w) => workerActive(w, at)).length
    );
    if (owner === 'pool') {
      for (const m of data.miners)
        putSample(
          m.address,
          at,
          m.rate,
          null,
          m.workers.filter((w) => workerActive(w, at)).length
        );
      const putBlock = db.prepare(
        'INSERT OR REPLACE INTO blocks VALUES(?,?,?,?,?)'
      );
      for (const b of data.blocks)
        putBlock.run(b.id, b.height, b.time, JSON.stringify(b), at);
    }
    const payout = db.prepare(
      'INSERT OR REPLACE INTO payouts VALUES(?,?,?,?,?,?,?)'
    );
    for (const p of data.payouts)
      payout.run(
        owner,
        p.txid,
        p.time,
        p.totalAtoms ?? p.amountAtoms,
        p.outputs ?? null,
        p.status,
        at
      );
    db.prepare('DELETE FROM samples WHERE time<?').run(at - 30 * 86400);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
export function savedPoolSnapshot(db, owner) {
  const row = db.prepare('SELECT data FROM snapshots WHERE owner=?').get(owner);
  return row ? JSON.parse(row.data) : null;
}
export function poolChart(db, owner, period = '24h', now = Date.now()) {
  const hours = { '1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720 }[period];
  if (!hours) throw new RpcError('Invalid chart period.', 'invalid');
  const end = Math.floor(now / 1000),
    start = end - hours * 3600;
  const width = Math.max(
    300,
    Math.ceil((hours * 3600 + 300) / 240 / 300) * 300
  );
  const rows = db
    .prepare(
      `SELECT CAST((time-?)/? AS INTEGER) AS bucket,MIN(time) AS time,
    AVG(rate) AS rate,AVG(network) AS network,AVG(devices) AS devices,COUNT(*) AS samples
    FROM samples WHERE owner=? AND time>=? AND time<=? GROUP BY bucket ORDER BY bucket`
    )
    .all(start, width, owner, start, end);
  const stats = db
    .prepare(
      `SELECT MIN(time) AS first,MAX(observed) AS last,AVG(rate) AS averageRate,
    MAX(rate) AS peakRate,COUNT(*) AS samples FROM samples WHERE owner=? AND time>=? AND time<=?`
    )
    .get(owner, start, end);
  return {
    period,
    start,
    end,
    bucketSeconds: width,
    series: rows.map((r) => ({ ...r })),
    ...stats,
  };
}
export function archiveOptions(params = {}, blocks = false) {
  const status = params.status || 'all';
  const allowed = blocks
    ? ['all', 'immature', 'credited', 'orphaned']
    : ['all', 'pending', 'confirmed', 'returned'];
  if (!allowed.includes(status))
    throw new RpcError('Invalid status filter.', 'invalid');
  const before = params.before || null;
  if (before && !/^\d{1,12}:[a-f0-9]{64}$/.test(before))
    throw new RpcError('Invalid archive cursor.', 'invalid');
  const times = ['from', 'to'].map((key) => {
    if (!params[key]) return null;
    const value = /^\d{4}-\d{2}-\d{2}$/.test(params[key])
      ? Date.parse(params[key] + 'T00:00:00Z')
      : NaN;
    if (
      !Number.isFinite(value) ||
      new Date(value).toISOString().slice(0, 10) !== params[key]
    )
      throw new RpcError('Use a valid calendar date.', 'invalid');
    return value / 1000;
  });
  if (times[0] !== null && times[1] !== null && times[0] > times[1])
    throw new RpcError('The start date must precede the end date.', 'invalid');
  return {
    status,
    before,
    from: times[0],
    to: times[1] === null ? null : times[1] + 86400,
  };
}
export function payoutPage(db, owner = 'pool', params = {}) {
  const options = archiveOptions(params),
    where = ['owner=?'],
    bindings = [owner];
  if (options.status !== 'all') {
    where.push('status=?');
    bindings.push(options.status);
  }
  if (options.from !== null) {
    where.push('time>=?');
    bindings.push(options.from);
  }
  if (options.to !== null) {
    where.push('time<?');
    bindings.push(options.to);
  }
  if (options.before) {
    const [t, id] = options.before.split(':');
    where.push('(time<? OR (time=? AND txid<?))');
    bindings.push(Number(t), Number(t), id);
  }
  const rows = db
    .prepare(
      `SELECT * FROM payouts WHERE ${where.join(' AND ')} ORDER BY time DESC,txid DESC LIMIT 21`
    )
    .all(...bindings);
  const last = rows[19];
  const entries = rows.slice(0, 20).map((r) => ({
    txid: r.txid,
    time: r.time,
    status: r.status,
    observedAt: r.observed * 1000,
    ...(owner === 'pool'
      ? { totalAtoms: r.amount, outputs: r.outputs }
      : { amountAtoms: r.amount }),
  }));
  const summary = db
    .prepare(
      'SELECT COUNT(*) AS records,MIN(time) AS earliest,MAX(observed) AS observed FROM payouts WHERE owner=?'
    )
    .get(owner);
  const pending = db
    .prepare("SELECT amount FROM payouts WHERE owner=? AND status='pending'")
    .all(owner)
    .reduce((total, r) => total + BigInt(r.amount), 0n)
    .toString();
  return {
    entries,
    next: rows.length > 20 ? `${last.time}:${last.txid}` : null,
    ...summary,
    pendingAtoms: pending,
  };
}
export function poolBlocks(db, params = {}, height = null, maturity = 100) {
  const options = archiveOptions(params, true),
    where = ['1'],
    bindings = [];
  if (options.status !== 'all') {
    where.push("json_extract(data,'$.status')=?");
    bindings.push(options.status);
  }
  if (options.from !== null) {
    where.push('time>=?');
    bindings.push(options.from);
  }
  if (options.to !== null) {
    where.push('time<?');
    bindings.push(options.to);
  }
  if (options.before) {
    const [h, id] = options.before.split(':');
    where.push('(height<? OR (height=? AND id<?))');
    bindings.push(Number(h), Number(h), id);
  }
  const rows = db
    .prepare(
      `SELECT * FROM blocks WHERE ${where.join(' AND ')} ORDER BY height DESC,id DESC LIMIT 21`
    )
    .all(...bindings);
  const last = rows[19];
  return {
    entries: rows.slice(0, 20).map((r) => {
      const b = JSON.parse(r.data);
      const confirmations =
        b.status === 'orphaned'
          ? 0
          : height === null
            ? b.confirmations
            : Math.max(0, height - b.height + 1);
      return {
        ...b,
        confirmations,
        maturityRemaining: Math.max(0, maturity - confirmations),
        observedAt: r.observed * 1000,
      };
    }),
    next: rows.length > 20 ? `${last.height}:${last.id}` : null,
    records: db.prepare('SELECT COUNT(*) AS n FROM blocks').get().n,
  };
}
export function reconcilePoolBlocks(
  db,
  membership,
  height,
  maturity,
  observedAt
) {
  const find = db.prepare('SELECT data FROM blocks WHERE id=?');
  const update = db.prepare('UPDATE blocks SET data=?,observed=? WHERE id=?');
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const { id, active } of membership) {
      if (active === null) continue;
      const row = find.get(id);
      if (!row) continue;
      const block = JSON.parse(row.data);
      const confirmations = active ? Math.max(0, height - block.height + 1) : 0;
      const status = active
        ? confirmations >= maturity
          ? 'credited'
          : 'immature'
        : 'orphaned';
      if(status===block.status)continue;
      update.run(
        JSON.stringify({ ...block, status, confirmations }),
        Math.floor(observedAt / 1000),
        id
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
