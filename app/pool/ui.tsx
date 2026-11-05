import Link from 'next/link';
import { amount, short } from '../../src/format.mjs';
import { Header, Footer } from '../../src/ui';
import { Time, TimePreference, ExportCsv } from '../../src/workspace';
import { MyMinerLink } from './controls';

export function PoolShell({
  active = 'overview',
  children,
}: {
  active?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Header active="pool" />
      <main className="explorer-page pool-workspace">
        <nav className="workspace-nav pool-nav" aria-label="Pool sections">
          <div>
            <Link
              prefetch={false}
              href="/pool"
              aria-current={active === 'overview' ? 'page' : undefined}
            >
              Pool overview
            </Link>
            <MyMinerLink active={active === 'miner'} />
            <Link
              prefetch={false}
              href="/pool/connect"
              aria-current={active === 'connect' ? 'page' : undefined}
            >
              Connect a GPU
            </Link>
          </div>
          <TimePreference />
        </nav>
        {children}
        <p className="pool-disclaimer">
          Public testnet · RQT has no monetary value. Rates are estimates. Pool
          statistics and rewards may reset with the testnet.
        </p>
      </main>
      <Footer />
    </>
  );
}
export function PoolHealth({ data }: { data: any }) {
  return (
    <>
      {data.status === 'stale' && (
        <div className="notice warning" role="status">
          {data.error || 'The pool is temporarily unavailable.'} Showing the
          last successful observation.
        </div>
      )}
      {data.chain?.stalled && (
        <div className="notice warning" role="status">
          <strong>No recent network blocks.</strong> Last observed block:{' '}
          <Time seconds={data.chain.latestBlockTime} />. Mining rewards need new
          blocks to mature, and pending payouts need a block to confirm.
        </div>
      )}
      {data.chain?.stale && (
        <div className="notice" role="status">
          The chain observer is stale. Block progress may be out of date.
        </div>
      )}
    </>
  );
}
export function PoolConditions({ data }: { data: any }) {
  return (
    <section className="records-panel pool-rules">
      <div className="panel-heading">
        <h2>Pool rules</h2>
        <a className="text-link" href="/docs/pool">
          Reward guide ↗
        </a>
      </div>
      <dl className="pool-rule-grid">
        <div>
          <dt>Scheme / fee</dt>
          <dd>PPLNS · {data.feePercent}%</dd>
        </div>
        <div>
          <dt>Payout threshold</dt>
          <dd>{amount(data.minPayoutAtoms)} RQT</dd>
        </div>
        <div>
          <dt>Payout checks</dt>
          <dd>Every {Math.round(data.payoutEverySeconds / 60)} min</dd>
        </div>
        <div>
          <dt>Reward maturity</dt>
          <dd>{data.maturity} blocks</dd>
        </div>
      </dl>
      <p className="pool-help">
        Reaching the threshold makes a balance eligible for payout. It is not a
        guaranteed payment time; sufficient spendable pool funds and transaction
        confirmation are still required.
      </p>
    </section>
  );
}
export function Status({ value }: { value: string }) {
  const labels: Record<string, string> = {
    credited: 'Mature',
    immature: 'Maturing',
    pending: 'Pending',
    confirmed: 'Confirmed',
    returned: 'Returned',
    orphaned: 'Orphaned',
  };
  const style = ['confirmed', 'credited'].includes(value)
    ? 'completed'
    : ['returned', 'orphaned'].includes(value)
      ? 'failed'
      : 'in_progress';
  return <span className={'state ' + style}>{labels[value] || 'Unknown'}</span>;
}
export function MinerLink({ address }: { address: string }) {
  return (
    <Link
      prefetch={false}
      className="hash"
      href={'/pool/miner/' + address}
      title={address}
    >
      {short(address, 8)}
    </Link>
  );
}
export function Payouts({ page }: { page: any }) {
  const rows = page.entries;
  return (
    <>
      <div className="panel-heading">
        <div>
          <h2>Payout history</h2>
          <span className="muted">
            Sent transactions and their last reported status
          </span>
        </div>
        <ExportCsv
          filename="requant-pool-payouts.csv"
          rows={[
            [
              'txid',
              'time_utc',
              'amount_atoms',
              'status',
              'status_observed_utc',
            ],
            ...rows.map((p: any) => [
              p.txid,
              new Date(p.time * 1000).toISOString(),
              p.totalAtoms ?? p.amountAtoms,
              p.status,
              new Date(p.observedAt).toISOString(),
            ]),
          ]}
        />
      </div>
      {!rows.length ? (
        <div className="empty-state">
          No payouts match these filters. Rewards must mature and reach the
          payout threshold first.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="pool-data-table pool-payout-table">
            <thead>
              <tr>
                <th>Payout / time</th>
                <th className="numeric">Amount</th>
                <th>Reported status</th>
                <th className="pool-secondary">Recipients</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p: any) => (
                <tr key={p.txid}>
                  <td>
                    <Link
                      prefetch={false}
                      className="hash"
                      href={'/tx/' + p.txid}
                      title={p.txid}
                    >
                      {short(p.txid, 7)}
                    </Link>
                    <small>
                      <Time seconds={p.time} />
                    </small>
                  </td>
                  <td className="numeric">
                    {amount(p.totalAtoms ?? p.amountAtoms)}
                    <small>RQT</small>
                  </td>
                  <td>
                    <Status value={p.status} />
                    <small title={new Date(p.observedAt).toISOString()}>
                      Observed <Time seconds={p.observedAt / 1000} relative />
                    </small>
                  </td>
                  <td className="pool-secondary">{p.outputs ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="pool-help">
        {page.records} collected records
        {page.earliest ? (
          <>
            {' '}
            · Earliest payout <Time seconds={page.earliest} />
          </>
        ) : null}
        . Older records may be unavailable. This is a collected archive;
        historical statuses show when they were last observed.
      </p>
    </>
  );
}
export function Blocks({ page }: { page: any }) {
  return (
    <>
      <div className="panel-heading">
        <div>
          <h2>Blocks found</h2>
          <span className="muted">
            Maturity advances with new network blocks
          </span>
        </div>
        <ExportCsv
          filename="requant-pool-blocks.csv"
          rows={[
            [
              'height',
              'block_hash',
              'time_utc',
              'reward_atoms',
              'effort',
              'status',
              'confirmations',
            ],
            ...page.entries.map((b: any) => [
              b.height,
              b.id,
              new Date(b.time * 1000).toISOString(),
              b.rewardAtoms,
              b.effort ?? '',
              b.status,
              b.confirmations,
            ]),
          ]}
        />
      </div>
      {!page.entries.length ? (
        <div className="empty-state">
          No collected blocks match these filters.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="pool-data-table pool-block-table">
            <thead>
              <tr>
                <th>Block / time</th>
                <th className="numeric">Reward</th>
                <th>Status</th>
                <th className="pool-secondary">Finder / effort</th>
              </tr>
            </thead>
            <tbody>
              {page.entries.map((b: any) => (
                <tr key={b.id}>
                  <td>
                    <Link
                      prefetch={false}
                      className="height"
                      href={'/block/' + b.id}
                    >
                      {b.height.toLocaleString('en-US')}
                    </Link>
                    <small>
                      <Time seconds={b.time} />
                    </small>
                    <details className="pool-mobile-details">
                      <summary>Finder / effort</summary>
                      <MinerLink address={b.finder} />
                      <small>Effort {percent(b.effort, 0)}</small>
                    </details>
                  </td>
                  <td className="numeric">
                    {amount(b.rewardAtoms)}
                    <small>RQT</small>
                  </td>
                  <td>
                    <Status value={b.status} />
                    <small>
                      {b.status === 'immature'
                        ? `${b.maturityRemaining} blocks to maturity`
                        : `${b.confirmations} confirmations`}
                    </small>
                  </td>
                  <td className="pool-secondary">
                    <MinerLink address={b.finder} />
                    <small>Effort {percent(b.effort, 0)}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="pool-help">
        {page.records} collected blocks. Orphaned rewards do not mature. Effort
        compares submitted share work with the expected work for one block; it
        is not a countdown.
      </p>
    </>
  );
}
export function ArchiveFilters({
  path,
  query,
  blocks = false,
}: {
  path: string;
  query: any;
  blocks?: boolean;
}) {
  return (
    <form className="pool-filter-form" action={'/explorer' + path}>
      {query.tab && <input type="hidden" name="tab" value={query.tab} />}
      <label>
        Status
        <select name="status" defaultValue={query.status || 'all'}>
          <option value="all">All statuses</option>
          {(blocks
            ? ['immature', 'credited', 'orphaned']
            : ['pending', 'confirmed', 'returned']
          ).map((s) => (
            <option key={s} value={s}>
              {s === 'immature' ? 'Maturing' : s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </label>
      <label>
        From (UTC)
        <input type="date" name="from" defaultValue={query.from || ''} />
      </label>
      <label>
        Through (UTC)
        <input type="date" name="to" defaultValue={query.to || ''} />
      </label>
      <button className="button" type="submit">
        Apply filters
      </button>
      <Link
        prefetch={false}
        className="text-link"
        href={path + (query.tab ? '?tab=' + query.tab : '')}
      >
        Reset
      </Link>
    </form>
  );
}
export function percent(value: number | null, digits = 1) {
  return value === null || !Number.isFinite(value)
    ? '—'
    : (value * 100).toFixed(digits) + '%';
}
