'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Search, Blocks, Transactions } from '../src/ui';
import { amount, rate, date, short } from '../src/format.mjs';
export default function Overview({ initial }: { initial: any }) {
  const [data, setData] = useState(initial),
    [tab, setTab] = useState('blocks');
  useEffect(() => {
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const r = await fetch('/explorer/api/overview', { cache: 'no-store' });
        if (!r.ok) throw new Error();
        const next = await r.json();
        if (!stopped) setData(next);
      } catch {
        if (!stopped)
          setData((old: any) => ({
            ...old,
            status: 'stale',
            stale: true,
            error: 'The explorer connection is unavailable.',
          }));
      }
    }, 30000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, []);
  const connected = data.observedAt !== null,
    series = data.series.filter((s: any) => s.rate !== null),
    values = series.map((s: any) => s.rate),
    max = Math.max(...values, 1),
    min = Math.min(...values, 0);
  const points = series
    .map(
      (s: any, i: number) =>
        `${(i * 900) / Math.max(1, series.length - 1)},${180 - ((s.rate - min) / (max - min || 1)) * 140}`
    )
    .join(' ');
  return (
    <main className="explorer-page">
      <div className="explorer-heading">
        <div>
          <div className="eyebrow">TNet v1 / Public testnet</div>
          <h1>
            Network explorer<span className="period">.</span>
          </h1>
          <p>Follow every block. Verify every transaction.</p>
        </div>
        <span
          className={
            'connection ' + (data.status === 'connected' ? '' : 'disconnected')
          }
        >
          <i />
          {data.status === 'connected'
            ? 'Node connected'
            : data.status === 'stale'
              ? 'Data stale'
              : 'Node unavailable'}
        </span>
      </div>
      <Search />
      {data.error && (
        <div className="notice warning" role="status">
          {data.error}
          {data.observedAt && (
            <>
              {' '}
              Last successful update:{' '}
              {new Date(data.observedAt)
                .toISOString()
                .replace('T', ' ')
                .slice(0, 19)}{' '}
              UTC.
            </>
          )}
        </div>
      )}
      <section className="network-stats">
        <div>
          <span>Block height</span>
          <strong>
            {connected ? data.height.toLocaleString('en-US') : '—'}
          </strong>
          <small>
            {connected ? short(data.tip, 7) : 'Awaiting node connection'}
          </small>
        </div>
        <div>
          <span>Estimated network rate</span>
          <strong>
            {connected ? rate(data.estimatedTicketsPerSecond) : '—'}
          </strong>
          <small>
            {connected
              ? `${data.rateWindow} block window`
              : 'Measured from block targets'}
          </small>
        </div>
        <div>
          <span>Issued testnet coins</span>
          <strong>
            {connected ? amount(data.issuedAtoms) : '—'} <em>RQT</em>
          </strong>
          <small>Continuous issuance with tail emission</small>
        </div>
        <div>
          <span>Known nodes</span>
          <strong>{connected ? (data.knownNodes ?? data.peers) : '—'}</strong>
          <small>
            {connected
              ? `${data.peers} connected to the observed node · ${data.mempool} pending transactions`
              : 'Address book of the observed node'}
          </small>
        </div>
      </section>
      <section className="rate-panel">
        <div className="panel-heading">
          <div>
            <h2>Network activity</h2>
            <span className="muted">
              Estimated tickets/s · Collected by this explorer
            </span>
          </div>
          <span className="state">24 h history</span>
        </div>
        {series.length > 1 ? (
          <div className="chart">
            <svg
              viewBox="0 0 900 200"
              role="img"
              aria-label="Estimated ticket rate over the last 24 hours"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                  <stop stopColor="#ff5426" stopOpacity=".18" />
                  <stop offset="1" stopColor="#ff5426" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[40, 90, 140, 190].map((y) => (
                <line
                  key={y}
                  x1="0"
                  x2="900"
                  y1={y}
                  y2={y}
                  stroke="#ddd8cf"
                  strokeDasharray="4 5"
                />
              ))}
              <polygon
                fill="url(#area)"
                points={'0,200 ' + points + ' 900,200'}
              />
              <polyline
                points={points}
                fill="none"
                stroke="#ff5426"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <div className="chart-scale">
              <span>
                {new Date(series[0].time).toISOString().slice(11, 16)} UTC
              </span>
              <span>{rate(max)}</span>
              <span>
                {new Date(series.at(-1).time).toISOString().slice(11, 16)} UTC
              </span>
            </div>
          </div>
        ) : (
          <div className="chart-empty">
            <span className="chart-symbol">▥</span>
            <p>
              {connected
                ? 'Collecting network activity. The chart appears after two measurements.'
                : 'Network activity appears when the node is connected.'}
            </p>
          </div>
        )}
      </section>
      <section className="records-panel">
        <div className="panel-heading">
          <div className="record-tabs">
            <button
              className={tab === 'blocks' ? 'selected' : ''}
              onClick={() => setTab('blocks')}
            >
              Latest blocks
            </button>
            <button
              className={tab === 'transactions' ? 'selected' : ''}
              onClick={() => setTab('transactions')}
            >
              Latest transactions
            </button>
          </div>
          <Link className="text-link" href="/blocks">
            All blocks ↗
          </Link>
        </div>
        {!connected ? (
          <div className="empty-state">
            No live chain data is available yet.
          </div>
        ) : tab === 'blocks' ? (
          <Blocks blocks={data.blocks} />
        ) : (
          <Transactions transactions={data.transactions} />
        )}
      </section>
      <div className="explorer-notes">
        <p>
          <span className="status-dot" />{' '}
          {connected
            ? `Observed ${new Date(data.observedAt).toISOString().slice(11, 19)} UTC · Node ${data.nodeVersion}`
            : 'Read-only testnet explorer'}
        </p>
        <p>
          {connected
            ? `Block hash index: ${Number(data.indexHeight).toLocaleString('en-US')} / ${data.height.toLocaleString('en-US')}`
            : 'Search supports testnet addresses beginning with trq1.'}
        </p>
      </div>
      <div className="notice">
        Testnet coins have no value. Network rate is an estimate from block
        targets and timestamps; known nodes are the observed node's address book
        and the node itself, connections are its own peers.
      </div>
    </main>
  );
}
