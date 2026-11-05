'use client';
import Link from 'next/link';
import { useState } from 'react';
import { amount, rate, short } from '../../src/format.mjs';
import { workerActive, rejectionPercent } from '../../src/pool-format.mjs';
import { Time, ExportCsv } from '../../src/workspace';

export function Workers({
  workers,
  observedAt,
  address = '',
}: {
  workers: any[];
  observedAt: number;
  address?: string;
}) {
  const [filter, setFilter] = useState('all'),
    [sort, setSort] = useState('rate'),
    [search, setSearch] = useState('');
  const at = observedAt / 1000;
  const active = workers.filter((w) => workerActive(w, at)).length;
  const rows = workers
    .filter(
      (w) =>
        w.name.toLowerCase().includes(search.toLowerCase()) &&
        (filter === 'all' || workerActive(w, at) === (filter === 'active'))
    )
    .sort((a, b) =>
      sort === 'rejected'
        ? (rejectionPercent(b) ?? -1) - (rejectionPercent(a) ?? -1)
        : sort === 'last'
          ? (b.lastShare || 0) - (a.lastShare || 0)
          : b.rate - a.rate || a.name.localeCompare(b.name)
    );
  return (
    <section className="records-panel">
      <div className="panel-heading">
        <div>
          <h2>Devices</h2>
          <span className="muted">
            {active} receiving shares · {workers.length - active} without recent
            shares
          </span>
        </div>
        {workers.length > 0 && (
          <ExportCsv
            filename="requant-pool-devices.csv"
            rows={[
              [
                'worker',
                'tickets_per_second',
                'accepted',
                'rejected',
                'rejected_percent',
                'last_share_utc',
                'active',
              ],
              ...rows.map((w) => [
                w.name,
                w.rate ?? '',
                w.shares,
                w.rejected,
                rejectionPercent(w) ?? '',
                w.lastShare ? new Date(w.lastShare * 1000).toISOString() : '',
                String(workerActive(w, at)),
              ]),
            ]}
          />
        )}
      </div>
      {workers.length > 0 && (
        <div className="pool-table-tools">
          <label>
            Find a device
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Worker name"
            />
          </label>
          <label>
            Activity
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All devices</option>
              <option value="active">Receiving shares</option>
              <option value="inactive">No recent shares</option>
            </select>
          </label>
          <label>
            Sort devices
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="rate">Highest rate</option>
              <option value="rejected">Highest rejection rate</option>
              <option value="last">Latest share</option>
            </select>
          </label>
        </div>
      )}
      {!rows.length ? (
        <div className="empty-state">
          {workers.length
            ? 'No devices match these filters.'
            : 'No devices are currently reported. Start CPPminer with a worker name; the first accepted share creates its statistics.'}
          {!workers.length && (
            <p>
              <Link
                prefetch={false}
                className="text-link"
                href={'/pool/connect' + (address ? '?address=' + address : '')}
              >
                Connect a device ↗
              </Link>
            </p>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="pool-data-table pool-worker-table">
            <thead>
              <tr>
                <th>Device / last share</th>
                <th className="numeric">Rate</th>
                <th>Shares / rejected</th>
                <th className="pool-secondary">Activity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.name}>
                  <td>
                    <strong className="pool-worker-name">{w.name}</strong>
                    <small>
                      <Time seconds={w.lastShare || null} relative />
                    </small>
                    <span
                      className={
                        'pool-device-activity ' +
                        (workerActive(w, at) ? 'on' : '')
                      }
                    >
                      {workerActive(w, at)
                        ? 'Receiving shares'
                        : 'No recent shares'}
                    </span>
                  </td>
                  <td className="numeric">{rate(w.rate)}</td>
                  <td>
                    <span className="mono">
                      {BigInt(w.shares).toLocaleString('en-US')}
                    </span>
                    <small>
                      {BigInt(w.rejected).toLocaleString('en-US')} rejected ·{' '}
                      {rejectionPercent(w) === null
                        ? '—'
                        : rejectionPercent(w) + '%'}
                    </small>
                  </td>
                  <td className="pool-secondary">
                    {workerActive(w, at)
                      ? 'Share received within 10 min'
                      : 'Check CPPminer and connectivity'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <details className="pool-help">
        <summary>How activity and counters are measured</summary>
        <p>
          Activity is inferred from accepted shares, not a direct GPU
          connection. Counts cover the current device reporting session and may
          reset. The node removes devices with no shares for one hour.
        </p>
      </details>
    </section>
  );
}
export function MinerList({
  miners,
  observedAt,
}: {
  miners: any[];
  observedAt: number;
}) {
  const [filter, setFilter] = useState('all'),
    [sort, setSort] = useState('rate'),
    [search, setSearch] = useState('');
  const rows = miners
    .filter(
      (m) =>
        m.address.toLowerCase().includes(search.toLowerCase()) &&
        (filter === 'all' ||
          (filter === 'active'
            ? m.rate > 0
            : BigInt(m.balanceAtoms) > BigInt(0)))
    )
    .sort((a, b) => {
      if (sort === 'balance' || sort === 'paid') {
        const field = sort === 'balance' ? 'balanceAtoms' : 'paidAtoms';
        return BigInt(a[field]) < BigInt(b[field])
          ? 1
          : BigInt(a[field]) > BigInt(b[field])
            ? -1
            : a.address.localeCompare(b.address);
      }
      return b.rate - a.rate || a.address.localeCompare(b.address);
    });
  return (
    <section className="records-panel">
      <div className="panel-heading">
        <div>
          <h2>Miners</h2>
          <span className="muted">
            {miners.filter((m) => m.rate > 0).length} active · {miners.length}{' '}
            known addresses
          </span>
        </div>
        <ExportCsv
          filename="requant-pool-miners.csv"
          rows={[
            [
              'address',
              'tickets_per_second',
              'available_atoms',
              'maturing_atoms',
              'sent_atoms',
              'blocks_found',
            ],
            ...rows.map((m) => [
              m.address,
              m.rate ?? '',
              m.balanceAtoms,
              m.immatureAtoms,
              m.paidAtoms,
              m.blocks,
            ]),
          ]}
        />
      </div>
      <div className="pool-table-tools">
        <label>
          Find a miner
          <input
            type="search"
            placeholder="Testnet address"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Show miners
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All miners</option>
            <option value="active">Active miners</option>
            <option value="balance">With available balance</option>
          </select>
        </label>
        <label>
          Sort miners
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="rate">Highest rate</option>
            <option value="balance">Highest available balance</option>
            <option value="paid">Most sent</option>
          </select>
        </label>
      </div>
      {!rows.length ? (
        <div className="empty-state">No miners match these filters.</div>
      ) : (
        <div className="table-wrap">
          <table className="pool-data-table pool-miner-table">
            <thead>
              <tr>
                <th>Miner / activity</th>
                <th className="numeric">Rate</th>
                <th className="numeric">Available</th>
                <th className="numeric pool-secondary">Maturing</th>
                <th className="numeric pool-secondary">Sent / blocks found</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.address}>
                  <td>
                    <Link
                      prefetch={false}
                      className="hash"
                      href={'/pool/miner/' + m.address}
                      title={m.address}
                    >
                      {short(m.address, 7)}
                    </Link>
                    <small>
                      {
                        m.workers.filter((w: any) =>
                          workerActive(w, observedAt / 1000)
                        ).length
                      }{' '}
                      active devices ·{' '}
                      <Time seconds={m.lastShare || null} relative />
                    </small>
                    <details className="pool-mobile-details">
                      <summary>Rewards / blocks</summary>
                      <small>Maturing {amount(m.immatureAtoms)} RQT</small>
                      <small>
                        Sent {amount(m.paidAtoms)} RQT · {m.blocks} blocks
                      </small>
                    </details>
                  </td>
                  <td className="numeric">{rate(m.rate)}</td>
                  <td className="numeric">
                    {amount(m.balanceAtoms)}
                    <small>RQT</small>
                  </td>
                  <td className="numeric pool-secondary">
                    {amount(m.immatureAtoms)}
                    <small>RQT</small>
                  </td>
                  <td className="numeric pool-secondary">
                    {amount(m.paidAtoms)}
                    <small>RQT · {m.blocks} blocks</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="pool-help">
        Available balances have matured. Sent amounts include pending
        transactions; confirmation is shown in payout history.
      </p>
    </section>
  );
}
