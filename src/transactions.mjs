// Read-only transaction index. Canonical membership always comes from blocks.active.
import { RpcError } from './rpc.mjs';

export function initTransactions(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tx_blocks(block_id TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS chain_txs(
      block_id TEXT NOT NULL,txid TEXT NOT NULL,height INTEGER NOT NULL,pos INTEGER NOT NULL,
      time INTEGER NOT NULL,coinbase INTEGER NOT NULL,data TEXT NOT NULL,
      PRIMARY KEY(block_id,txid));
    CREATE INDEX IF NOT EXISTS chain_txs_id ON chain_txs(txid);
    CREATE INDEX IF NOT EXISTS chain_txs_order ON chain_txs(height DESC,pos DESC);
    CREATE INDEX IF NOT EXISTS chain_txs_time ON chain_txs(time);
    CREATE TABLE IF NOT EXISTS movements(
      block_id TEXT NOT NULL,txid TEXT NOT NULL,owner TEXT NOT NULL,received TEXT NOT NULL,sent TEXT NOT NULL,
      PRIMARY KEY(block_id,txid,owner));
    CREATE INDEX IF NOT EXISTS movements_owner ON movements(owner);
    CREATE TABLE IF NOT EXISTS spends(
      block_id TEXT NOT NULL,txid TEXT NOT NULL,prev_txid TEXT NOT NULL,vout INTEGER NOT NULL,
      PRIMARY KEY(block_id,txid,prev_txid,vout));
    CREATE INDEX IF NOT EXISTS spends_previous ON spends(prev_txid,vout);
  `);
}

export function storeTransactions(db, block, transactions, complete = true) {
  const txInsert = db.prepare(
    'INSERT OR REPLACE INTO chain_txs VALUES(?,?,?,?,?,?,?)'
  );
  const movement = db.prepare(
    'INSERT OR REPLACE INTO movements VALUES(?,?,?,?,?)'
  );
  const spend = db.prepare('INSERT OR REPLACE INTO spends VALUES(?,?,?,?)');
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const tx of transactions) {
      const position = block.txids.indexOf(tx.txid);
      if (position < 0) throw new Error('Transaction is outside its block');
      const owners = new Map();
      const add = (owner, field, value) => {
        if (!owner || value == null)
          throw new Error('Unresolved indexed output');
        const entry = owners.get(owner) || { received: 0n, sent: 0n };
        entry[field] += BigInt(value);
        owners.set(owner, entry);
      };
      for (const input of tx.inputs) {
        add(input.owner, 'sent', input.value);
        spend.run(block.id, tx.txid, input.txid, Number(input.vout));
      }
      for (const output of tx.outputs)
        add(output.owner, 'received', output.value);
      txInsert.run(
        block.id,
        tx.txid,
        Number(block.height),
        position,
        Number(block.time),
        tx.coinbase ? 1 : 0,
        JSON.stringify(tx)
      );
      for (const [owner, flow] of owners)
        movement.run(
          block.id,
          tx.txid,
          owner,
          flow.received.toString(),
          flow.sent.toString()
        );
    }
    if (complete) {
      const count = db
        .prepare('SELECT COUNT(*) AS n FROM chain_txs WHERE block_id=?')
        .get(block.id).n;
      if (count !== block.txids.length)
        throw new Error('Incomplete block transaction index');
      db.prepare('INSERT OR IGNORE INTO tx_blocks VALUES(?)').run(block.id);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function coverage(db, height) {
  const indexed = db
    .prepare(
      'SELECT COUNT(*) AS n FROM tx_blocks t JOIN blocks b ON b.id=t.block_id WHERE b.active=1 AND b.height<=?'
    )
    .get(height).n;
  return {
    indexedBlocks: indexed,
    totalBlocks: height + 1,
    complete: indexed === height + 1,
  };
}

export function pageOptions(params = {}) {
  const kind = params.kind || 'all',
    before = params.before || null;
  if (
    ![
      'all',
      'transfer',
      'coinbase',
      'incoming',
      'outgoing',
      'pending',
    ].includes(kind)
  )
    throw new RpcError('Invalid transaction filter.', 'invalid');
  if (before && !/^\d{1,12}:\d{1,9}:[a-f0-9]{64}$/.test(before))
    throw new RpcError('Invalid history cursor.', 'invalid');
  const times = ['from', 'to'].map((key) => {
    if (!params[key]) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params[key]))
      throw new RpcError('Use a valid calendar date.', 'invalid');
    const value = Date.parse(params[key] + 'T00:00:00Z');
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
    kind,
    before,
    from: times[0],
    to: times[1] === null ? null : times[1] + 86400,
  };
}

export function transactionPage(db, height, params = {}, owner = null) {
  const options = pageOptions(params),
    bindings = [];
  if (!owner && ['incoming', 'outgoing'].includes(options.kind))
    throw new RpcError('This filter requires an address.', 'invalid');
  const where = ['b.active=1', 't.height<=?'];
  bindings.push(height);
  if (owner) {
    where.push('m.owner=?');
    bindings.push(owner);
  }
  if (options.kind === 'coinbase' || options.kind === 'transfer') {
    where.push('t.coinbase=?');
    bindings.push(options.kind === 'coinbase' ? 1 : 0);
  }
  if (options.kind === 'incoming') where.push("m.received!='0'");
  if (options.kind === 'outgoing') where.push("m.sent!='0'");
  if (options.kind === 'pending') where.push('0');
  if (options.from !== null) {
    where.push('t.time>=?');
    bindings.push(options.from);
  }
  if (options.to !== null) {
    where.push('t.time<?');
    bindings.push(options.to);
  }
  if (options.before) {
    const [rawHeight, rawPosition, blockId] = options.before.split(':');
    const h = Number(rawHeight),
      p = Number(rawPosition);
    if (
      !db
        .prepare('SELECT 1 FROM blocks WHERE active=1 AND height=? AND id=?')
        .get(h, blockId)
    )
      throw new RpcError(
        'The chain changed. Return to the newest history page.',
        'index-pending'
      );
    where.push('(t.height<? OR (t.height=? AND t.pos<?))');
    bindings.push(h, h, p);
  }
  const rows = db
    .prepare(
      `SELECT t.*,${owner ? 'm.received,m.sent' : "'0' AS received,'0' AS sent"}
    FROM chain_txs t JOIN blocks b ON b.id=t.block_id JOIN tx_blocks done ON done.block_id=t.block_id
    ${owner ? 'JOIN movements m ON m.block_id=t.block_id AND m.txid=t.txid' : ''}
    WHERE ${where.join(' AND ')} ORDER BY t.height DESC,t.pos DESC LIMIT 51`
    )
    .all(...bindings);
  const entries = rows.slice(0, 50).map((row) => ({
    ...JSON.parse(row.data),
    height: row.height,
    time: row.time,
    confirmations: height - row.height + 1,
    received: row.received,
    sent: row.sent,
    net: (BigInt(row.received) - BigInt(row.sent)).toString(),
  }));
  const last = rows[49];
  return {
    entries,
    next:
      rows.length > 50 ? `${last.height}:${last.pos}:${last.block_id}` : null,
    coverage: coverage(db, height),
  };
}

export function spending(db, txid, vout) {
  const result = db
    .prepare(
      `SELECT s.txid,t.height FROM spends s JOIN blocks b ON b.id=s.block_id
    JOIN tx_blocks done ON done.block_id=s.block_id JOIN chain_txs t ON t.block_id=s.block_id AND t.txid=s.txid
    WHERE b.active=1 AND s.prev_txid=? AND s.vout=? LIMIT 1`
    )
    .get(txid, vout);
  return result ? { ...result } : null;
}
