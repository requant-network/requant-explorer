'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Search, Blocks } from '../src/ui';
import { amount, rate } from '../src/format.mjs';
import { WorkspaceNav, TransactionRows } from '../src/records';
import { Time } from '../src/workspace';
import ActivityChart from '../src/activity-chart';
export default function Overview({ initial }: { initial: any }) {
  const [data, setData] = useState(initial),
    [next, setNext] = useState<any>(null),
    [tab, setTab] = useState('blocks'),
    [enabled, setEnabled] = useState(true);
  useEffect(() => {
    if (!enabled) return;
    let stopped = false,
      busy = false;
    const abort = new AbortController();
    const timer = setInterval(async () => {
      if (document.hidden || busy) return;
      busy = true;
      try {
        const r = await fetch('/explorer/api/overview', {
          cache: 'no-store',
          signal: abort.signal,
        });
        if (!r.ok) throw new Error();
        const value = await r.json();
        if (!stopped) {
          if (data.tip && value.tip && value.tip !== data.tip) setNext(value);
          else setData(value);
        }
      } catch {
        if (!stopped)
          setData((old: any) => ({
            ...old,
            status: 'stale',
            stale: true,
            error: 'The explorer connection is unavailable.',
          }));
      } finally {
        busy = false;
      }
    }, 30000);
    return () => {
      stopped = true;
      abort.abort();
      clearInterval(timer);
    };
  }, [enabled, data.tip]);
  const connected = data.observedAt != null;
  return (
    <main className="explorer-page workspace-page">
      <WorkspaceNav />
      <div className="explorer-heading">
        <div>
          <div className="eyebrow">TNet v1 / Public testnet</div>
          <h1>
            Network explorer<span className="period">.</span>
          </h1>
          <p>Follow blocks, trace transactions and inspect addresses.</p>
        </div>
        <span
          className={
            'connection ' +
            (data.status === 'connected' && !data.stalled ? '' : 'disconnected')
          }
        >
          <i />
          {data.status === 'connected'
            ? data.stalled
              ? 'Node connected · no recent blocks'
              : 'Node connected'
            : data.status === 'stale'
              ? 'Data stale'
              : 'Node unavailable'}
        </span>
      </div>
      <Search />
      <div className="workspace-refresh">
        <span>
          {connected ? (
            <>
              Observed <Time seconds={data.observedAt / 1000} />
            </>
          ) : (
            'Waiting for node data'
          )}
        </span>
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />{' '}
          Check for updates
        </label>
      </div>
      {next && (
        <button
          className="button primary new-records"
          onClick={() => {
            setData(next);
            setNext(null);
          }}
        >
          New chain data available · Show updates
        </button>
      )}
      {data.stalled && (
        <div className="notice warning" role="status">
          No new blocks observed for over 20 minutes. Last block:{' '}
          <Time seconds={data.latestBlockTime} />. Confirmations and payouts
          wait for new blocks.
        </div>
      )}
      {data.error && (
        <div className="notice warning" role="status">
          {data.error}{' '}
          {connected && (
            <>
              Last successful update: <Time seconds={data.observedAt / 1000} />.
            </>
          )}
        </div>
      )}
      <section className="workspace-summary" aria-label="Network summary">
        <div>
          <span>Block height</span>
          <strong>
            {connected ? Number(data.height).toLocaleString('en-US') : '—'}
          </strong>
          <small>
            Last block:{' '}
            {connected ? (
              <Time seconds={data.latestBlockTime} relative />
            ) : (
              'Unavailable'
            )}
          </small>
        </div>
        <div>
          <span>Estimated network rate</span>
          <strong style={{ fontSize: '21px' }}>
            {connected ? rate(data.estimatedTicketsPerSecond) : '—'}
          </strong>
          <small>
            {data.stalled
              ? 'Unavailable until new blocks arrive'
              : (data.rateWindow || 0) + ' block window'}
          </small>
        </div>
        <div>
          <span>Average block interval</span>
          <strong>
            {connected && data.averageBlockSeconds != null
              ? Math.round(data.averageBlockSeconds) + ' s'
              : '—'}
          </strong>
          <small>Target: 60 seconds</small>
        </div>
        <div>
          <span>Pending transactions</span>
          <strong>
            {connected ? (
              <Link prefetch={false} href="/transactions?kind=pending">
                {data.mempool}
              </Link>
            ) : (
              '—'
            )}
          </strong>
          <small>Observed node’s mempool</small>
        </div>
        <div>
          <span>TNet epoch</span>
          <strong>{connected ? data.epoch : '—'}</strong>
          <small>
            {connected
              ? data.epochRemaining + ' blocks to next epoch'
              : '1440 blocks per epoch'}
          </small>
          {connected && (
            <div className="epoch-progress">
              <span
                style={{
                  width: (100 * (1440 - data.epochRemaining)) / 1440 + '%',
                }}
              />
            </div>
          )}
        </div>
      </section>
      <div className="overview-secondary">
        <span>
          Issued testnet coins{' '}
          <strong>{connected ? amount(data.issuedAtoms) + ' RQT' : '—'}</strong>
        </span>
        <span>
          Connected peers <strong>{connected ? data.peers : '—'}</strong>
        </span>
        <span>
          Known nodes{' '}
          <strong>
            {connected ? (data.knownNodes ?? 'Unavailable') : '—'}
          </strong>{' '}
          · observed node only
        </span>
        <span>
          Node <strong>{data.nodeVersion || '—'}</strong>
        </span>
      </div>
      <ActivityChart observedAt={data.observedAt || 0} />
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
          <Link
            prefetch={false}
            className="text-link"
            href={tab === 'blocks' ? '/blocks' : '/transactions'}
          >
            View all →
          </Link>
        </div>
        {!connected ? (
          <div className="empty-state">
            No live chain data is available yet.
          </div>
        ) : tab === 'blocks' ? (
          <Blocks blocks={data.blocks} />
        ) : (
          <TransactionRows transactions={data.transactions} />
        )}
      </section>
      <p className="notice">
        Testnet coins have no value. Rate is an estimate in tickets/s. Peer and
        address-book counts describe this node. Indexed block hashes:{' '}
        {Number(data.indexHeight || 0).toLocaleString('en-US')} /{' '}
        {Number(data.height || 0).toLocaleString('en-US')}.
      </p>
    </main>
  );
}
