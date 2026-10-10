import Link from 'next/link';
import { poolMiner } from '../../../../src/pool.mjs';
import { amount, rate } from '../../../../src/format.mjs';
import { Header, Footer, Failure } from '../../../../src/ui';
import { RateChart, Payouts, ago, percent } from '../../ui';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pool miner' };
export default async function Miner({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  let data: any;
  try {
    data = await poolMiner((await params).address);
  } catch (error) {
    return <Failure error={error} />;
  }
  const min = BigInt(data.minPayoutAtoms || '1') || BigInt(1),
    progress = Math.min(
      100,
      Number((BigInt(data.balanceAtoms) * BigInt(100)) / min)
    );
  return (
    <>
      <Header active="pool" />
      <main className="explorer-page">
        <p className="pool-back">
          <Link className="text-link" href="/pool">
            ← Mining pool
          </Link>
        </p>
        <div className="explorer-heading">
          <div>
            <div className="eyebrow">Pool miner</div>
            <h1>
              Miner<span className="period">.</span>
            </h1>
            <p className="mono pool-address">
              <Link className="hash" href={'/address/' + data.address}>
                {data.address}
              </Link>
            </p>
          </div>
        </div>
        {!data.known && (
          <div className="notice" role="status">
            This address has not mined in the pool yet. Statistics appear after
            its first accepted share.
          </div>
        )}
        <section className="network-stats pool-stats">
          <div>
            <span>Rate</span>
            <strong>{rate(data.rate)}</strong>
            <small>
              {data.workers.length} device{data.workers.length === 1 ? '' : 's'}{' '}
              · {percent(data.share)} of the pool
            </small>
          </div>
          <div>
            <span>Balance</span>
            <strong className="exact">
              {amount(data.balanceAtoms)} <em>RQT</em>
            </strong>
            <small>
              {progress}% of the {amount(data.minPayoutAtoms)} RQT minimum ·
              payouts every {Math.round(data.payoutEverySeconds / 60)} min
            </small>
          </div>
          <div>
            <span>Maturing</span>
            <strong className="exact">
              {amount(data.immatureAtoms)} <em>RQT</em>
            </strong>
            <small>From blocks not yet mature</small>
          </div>
          <div>
            <span>Paid</span>
            <strong className="exact">
              {amount(data.paidAtoms)} <em>RQT</em>
            </strong>
            <small>{data.blocks} blocks found by this miner</small>
          </div>
        </section>
        <section className="rate-panel">
          <div className="panel-heading">
            <div>
              <h2>Rate</h2>
              <span className="muted">Tickets/s from accepted shares</span>
            </div>
            <span className="state">Recent history</span>
          </div>
          <RateChart series={data.history} label="Miner ticket rate" />
        </section>
        <section className="records-panel">
          <div className="panel-heading">
            <div>
              <h2>Devices</h2>
              <span className="muted">Named with --worker</span>
            </div>
          </div>
          {data.workers.length === 0 ? (
            <div className="empty-state">No devices yet.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Rate</th>
                    <th>Accepted shares</th>
                    <th>Rejected</th>
                    <th>Last share</th>
                  </tr>
                </thead>
                <tbody>
                  {data.workers.map((w: any) => (
                    <tr key={w.name}>
                      <td>
                        <span
                          className={
                            'pool-dot ' +
                            (Date.now() / 1000 - (w.lastShare || 0) < 600
                              ? 'on'
                              : '')
                          }
                        />{' '}
                        {w.name}
                      </td>
                      <td className="mono">{rate(w.rate)}</td>
                      <td>{w.shares.toLocaleString('en-US')}</td>
                      <td>{w.rejected}</td>
                      <td className="muted">{ago(w.lastShare)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="records-panel">
          <div className="panel-heading">
            <div>
              <h2>Payouts to this miner</h2>
            </div>
          </div>
          <Payouts payouts={data.payouts} />
        </section>
      </main>
      <Footer />
    </>
  );
}
