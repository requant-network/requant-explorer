import Link from 'next/link';
import { redirect } from 'next/navigation';
import { pool, poolMiner, poolPayouts } from '../../../../src/pool.mjs';
import { amount, rate, parsePayee } from '../../../../src/format.mjs';
import { workerActive } from '../../../../src/pool-format.mjs';
import { Failure } from '../../../../src/ui';
import { Copy, Refresh, Time } from '../../../../src/workspace';
import { Pagination } from '../../../../src/records';
import {
  PoolShell,
  PoolHealth,
  PoolConditions,
  ArchiveFilters,
  Payouts,
} from '../../ui';
import { SaveMiner } from '../../controls';
import { Workers } from '../../tables';
import { PoolChart } from '../../chart';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pool miner' };
export default async function Miner({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const value = (await params).address,
    query = await searchParams;
  let canonical = '';
  try {
    canonical = parsePayee(value).address;
  } catch {}
  if (canonical && canonical !== value) redirect('/pool/miner/' + canonical);
  let data: any, poolData: any, payouts: any;
  try {
    [data, poolData] = await Promise.all([poolMiner(value), pool()]);
    payouts = poolPayouts(data.address, query);
  } catch (error) {
    return <Failure error={error} />;
  }
  const minimum = BigInt(data.minPayoutAtoms || 1) || BigInt(1),
    balance = BigInt(data.balanceAtoms),
    gap = balance < minimum ? minimum - balance : BigInt(0),
    ratio = (balance * BigInt(10000)) / minimum;
  const progress = ratio > BigInt(10000) ? 100 : Number(ratio) / 100;
  const active = data.workers.filter((w: any) =>
    workerActive(w, data.observedAt / 1000)
  ).length;
  const last =
    poolData.miners.find((m: any) => m.address === data.address)?.lastShare ||
    Math.max(0, ...data.workers.map((w: any) => w.lastShare || 0));
  const path = '/pool/miner/' + data.address;
  return (
    <PoolShell active="miner">
      <div className="pool-title-row">
        <div>
          <div className="eyebrow">Your mining dashboard</div>
          <h1>
            Miner overview<span className="period">.</span>
          </h1>
        </div>
        <SaveMiner address={data.address} />
      </div>
      <div className="pool-miner-identity">
        <Link
          prefetch={false}
          className="hash"
          href={'/address/' + data.address}
        >
          {data.address}
        </Link>
        <Copy value={data.address} label="Copy miner address" />
      </div>
      <Refresh observedAt={data.observedAt} />
      <PoolHealth
        data={{
          ...poolData,
          ...(data.status === 'stale'
            ? { status: 'stale', error: data.error }
            : {}),
        }}
      />
      {!data.known && (
        <div className="notice" role="status">
          This address has not submitted an accepted share yet.{' '}
          <Link
            prefetch={false}
            className="text-link"
            href={'/pool/connect?address=' + data.address}
          >
            Create a mining command ↗
          </Link>
        </div>
      )}
      <section
        className="network-stats pool-dashboard-stats"
        aria-label="Miner summary"
      >
        <div>
          <span>Miner rate</span>
          <strong>{rate(data.rate)}</strong>
          <small>
            {active} receiving shares · Last{' '}
            <Time seconds={last || null} relative />
          </small>
        </div>
        <div>
          <span>Available for payout</span>
          <strong className="exact">
            {amount(data.balanceAtoms)} <em>RQT</em>
          </strong>
          <small>
            {gap > BigInt(0)
              ? `${amount(gap.toString())} RQT to the threshold`
              : 'Threshold reached · eligible for payout'}
          </small>
          <progress
            value={progress}
            max="100"
            aria-label="Progress to payout threshold"
          />
        </div>
        <div>
          <span>Maturing rewards</span>
          <strong className="exact">
            {amount(data.immatureAtoms)} <em>RQT</em>
          </strong>
          <small>Rewards need {poolData.maturity} block confirmations</small>
        </div>
        <div>
          <span>Sent to this miner</span>
          <strong className="exact">
            {amount(data.paidAtoms)} <em>RQT</em>
          </strong>
          <small>
            Includes pending · {data.blocks.toLocaleString('en-US')} blocks
            found
          </small>
        </div>
      </section>
      <section className="pool-payment-flow" aria-label="Payout progress">
        <div>
          <span>1 / Maturing</span>
          <strong>{amount(data.immatureAtoms)} RQT</strong>
          <p>New blocks advance reward maturity.</p>
        </div>
        <div>
          <span>2 / Available</span>
          <strong>{amount(data.balanceAtoms)} RQT</strong>
          <p>
            {gap > BigInt(0)
              ? `Minimum ${amount(data.minPayoutAtoms)} RQT. Checks every ${Math.round(data.payoutEverySeconds / 60)} min.`
              : 'Eligible at a future payout check when the pool has sufficient spendable funds.'}
          </p>
        </div>
        <div>
          <span>3 / Pending confirmation</span>
          <strong>{amount(payouts.pendingAtoms)} RQT</strong>
          <p>From collected payouts. Sent does not mean confirmed.</p>
        </div>
        <div>
          <span>4 / Confirmed</span>
          <strong>
            <a href="#miner-payouts">View payout history ↓</a>
          </strong>
          <p>Open a transaction for its current chain confirmations.</p>
        </div>
      </section>
      <Workers
        workers={data.workers}
        observedAt={data.observedAt}
        address={data.address}
      />
      <PoolChart address={data.address} observedAt={data.observedAt} />
      <section id="miner-payouts" className="pool-archive">
        <ArchiveFilters path={path} query={query} />
        <section className="records-panel">
          <Payouts page={payouts} />
        </section>
        <Pagination path={path} query={query} next={payouts.next} />
      </section>
      <PoolConditions data={poolData} />
      <div className="pool-overview-foot">
        <Link
          prefetch={false}
          className="text-link"
          href={'/pool/connect?address=' + data.address}
        >
          Connect another device ↗
        </Link>
        <Link prefetch={false} className="text-link" href="/pool/miner">
          Look up another miner ↗
        </Link>
      </div>
    </PoolShell>
  );
}
