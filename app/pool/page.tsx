import Link from 'next/link';
import { pool, poolPayouts, poolBlockPage } from '../../src/pool.mjs';
import { amount, rate } from '../../src/format.mjs';
import { Failure } from '../../src/ui';
import { Refresh, Time } from '../../src/workspace';
import { Pagination } from '../../src/records';
import {
  PoolShell,
  PoolHealth,
  PoolConditions,
  ArchiveFilters,
  Blocks,
  Payouts,
} from './ui';
import { MinerLookup } from './controls';
import { MinerList } from './tables';
import { PoolChart } from './chart';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Mining pool',
  description:
    'Monitor the Requant testnet pool, your mining devices, rewards and payouts.',
};
export default async function Pool({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  let data: any, page: any;
  const query = await searchParams,
    tab = ['blocks', 'payouts'].includes(query.tab) ? query.tab : 'miners';
  try {
    data = await pool();
    if (tab === 'blocks') page = poolBlockPage(query, data);
    if (tab === 'payouts') page = poolPayouts('pool', query);
  } catch (error) {
    return <Failure error={error} />;
  }
  return (
    <PoolShell>
      <div className="pool-title-row">
        <div>
          <div className="eyebrow">TNet v1 / Public testnet</div>
          <h1>
            Mining pool<span className="period">.</span>
          </h1>
          <p>Follow your devices, rewards and payouts.</p>
        </div>
        <span
          className={
            'connection ' + (data.status === 'stale' ? 'disconnected' : '')
          }
        >
          <i />
          {data.status === 'stale'
            ? 'Last saved observation'
            : data.devices
              ? 'Receiving shares'
              : 'Pool reachable · no active devices'}
        </span>
      </div>
      <Refresh observedAt={data.observedAt} />
      <PoolHealth data={data} />
      <section
        className="pool-quick-start"
        aria-label="Open your mining dashboard"
      >
        <div>
          <div className="eyebrow">Your mining dashboard</div>
          <h2>Find your miner.</h2>
          <p>Devices, reward progress and payment status in one place.</p>
        </div>
        <MinerLookup compact />
      </section>
      <section
        className="network-stats pool-dashboard-stats"
        aria-label="Pool summary"
      >
        <div>
          <span>Pool rate</span>
          <strong>{rate(data.rate)}</strong>
          <small>Estimated from accepted shares</small>
        </div>
        <div>
          <span>Active devices</span>
          <strong>{data.devices}</strong>
          <small>
            {data.miners.filter((m: any) => m.rate > 0).length} active /{' '}
            {data.miners.length} known miners
          </small>
        </div>
        <div>
          <span>Blocks found · 24h</span>
          <strong>{data.blocks24h.toLocaleString('en-US')}</strong>
          <small>
            Last <Time seconds={data.lastBlockTime} relative />
          </small>
        </div>
        <div>
          <span>Sent by pool</span>
          <strong className="exact">
            {amount(data.paidTotalAtoms)} <em>RQT</em>
          </strong>
          <small>
            {data.payoutsTotal.toLocaleString('en-US')} transactions · includes
            pending
          </small>
        </div>
      </section>
      <PoolChart observedAt={data.observedAt} />
      <nav className="pool-view-tabs" aria-label="Pool activity views">
        {[
          ['miners', `Miners (${data.miners.length})`],
          ['blocks', 'Blocks found'],
          ['payouts', 'Payouts'],
        ].map(([value, label]) => (
          <Link
            prefetch={false}
            key={value}
            href={'/pool?tab=' + value + '#activity'}
            aria-current={tab === value ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div id="activity" className="pool-archive">
        {tab === 'miners' ? (
          <MinerList miners={data.miners} observedAt={data.observedAt} />
        ) : (
          <>
            <ArchiveFilters
              path="/pool"
              query={{ ...query, tab }}
              blocks={tab === 'blocks'}
            />
            <section className="records-panel">
              {tab === 'blocks' ? (
                <Blocks page={page} />
              ) : (
                <Payouts page={page} />
              )}
            </section>
            <Pagination
              path="/pool"
              query={{ ...query, tab }}
              next={page.next}
            />
          </>
        )}
      </div>
      <PoolConditions data={data} />
      <div className="pool-overview-foot">
        <span>
          Round effort <strong>{(data.roundEffort * 100).toFixed(0)}%</strong> ·{' '}
          {BigInt(data.roundShares).toLocaleString('en-US')} shares · Difficulty{' '}
          {data.shareBits} bits
        </span>
        <a href="/docs/pool" className="text-link">
          How PPLNS works ↗
        </a>
      </div>
    </PoolShell>
  );
}
