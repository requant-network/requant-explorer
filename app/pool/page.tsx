import Link from 'next/link';
import { pool } from '../../src/pool.mjs';
import { amount, rate } from '../../src/format.mjs';
import { Header, Footer, Failure } from '../../src/ui';
import { RateChart, Status, MinerLink, Payouts, ago, percent } from './ui';
import { MiningSetup, PoolRefresh, PoolActivity } from './controls';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Mining pool',
  description:
    'The Requant testnet mining pool: pool and network rate, miners, found blocks and payouts.',
};
export default async function Pool() {
  let data: any;
  try {
    data = await pool();
  } catch (error) {
    return <Failure error={error} />;
  }
  const minPayout = BigInt(data.minPayoutAtoms || '1') || BigInt(1);
  return (
    <>
      <Header active="pool" />
      <main className="explorer-page pool-page">
        <div className="explorer-heading">
          <div>
            <div className="eyebrow">TNet v1 / Public testnet</div>
            <h1>
              Mining pool<span className="period">.</span>
            </h1>
            <p>
              Connect your GPU. Track your shares. Mine on the public testnet.
            </p>
          </div>
          <span
            className={
              'connection ' +
              (data.status === 'connected' ? '' : 'disconnected')
            }
          >
            <i />
            {data.status === 'connected' ? 'Pool online' : 'Data stale'}
          </span>
        </div>
        <nav className="pool-jump-links" aria-label="On this page">
          <a href="#connect">Connect a GPU</a>
          <a href="#rates">Rate history</a>
          <a href="#activity">Pool activity</a>
        </nav>
        {data.error && (
          <div className="notice warning" role="status">
            {data.error} Last successful update:{' '}
            {new Date(data.observedAt).toISOString().slice(11, 19)} UTC.
          </div>
        )}
        <PoolRefresh observedAt={data.observedAt} />
        <section className="network-stats pool-stats" aria-label="Pool summary">
          <div>
            <span>Pool rate</span>
            <strong>{rate(data.rate)}</strong>
            <small>
              {data.devices} active device{data.devices === 1 ? '' : 's'} ·{' '}
              {data.share !== null && data.share > 1
                ? '≈100%'
                : percent(data.share, 0)}{' '}
              of the network
            </small>
          </div>
          <div>
            <span>Blocks found, 24 h</span>
            <strong>{(data.blocks24h ?? 0).toLocaleString('en-US')}</strong>
            <small>
              {(data.blocksTotal ?? 0).toLocaleString('en-US')} in total · last{' '}
              {ago(data.lastBlockTime)}
            </small>
          </div>
          <div>
            <span>Round effort</span>
            <strong>{percent(data.roundEffort, 0)}</strong>
            <small>
              {data.effortAverage === null
                ? "Of a block's expected shares"
                : `Average ${percent(data.effortAverage, 0)} over recent blocks`}
            </small>
          </div>
          <div>
            <span>Paid out</span>
            <strong className="exact">
              {amount(data.paidTotalAtoms)} <em>RQT</em>
            </strong>
            <small>
              {(data.payoutsTotal ?? 0).toLocaleString('en-US')} payout
              transactions
            </small>
          </div>
        </section>

        <div className="pool-connect-grid" id="connect">
          <section
            className="records-panel pool-setup"
            aria-labelledby="pool-setup-title"
          >
            <div className="panel-heading">
              <div>
                <div className="eyebrow">01 / Connect a GPU</div>
                <h2 id="pool-setup-title">Start mining</h2>
              </div>
              <a className="text-link" href="/docs/mining">
                Full guide ↗
              </a>
            </div>
            <div className="pool-setup-body">
              <div className="pool-endpoint">
                <span>Pool endpoint</span>
                <code>{data.endpoint}</code>
                <small>TNet · HTTP getwork / submitwork · Not Stratum</small>
              </div>
              <ol className="pool-prerequisites">
                <li>
                  <strong>Create a payout address.</strong> Open the{' '}
                  <a href="/wallet/" className="text-link">
                    Web Wallet ↗
                  </a>{' '}
                  and copy its public key hash.
                </li>
                <li>
                  <strong>Download and extract CPPminer.</strong> Use a
                  supported NVIDIA GPU (Turing or newer).{' '}
                  <a
                    href="https://github.com/danifest751/CPPminer/releases/latest"
                    className="text-link"
                  >
                    Windows / Linux downloads ↗
                  </a>
                </li>
              </ol>
              <MiningSetup endpoint={data.endpoint} />
            </div>
          </section>
          <aside className="pool-sidebar">
            <section
              className="records-panel pool-lookup"
              aria-labelledby="pool-lookup-title"
            >
              <div className="eyebrow">02 / Follow your GPU</div>
              <h2 id="pool-lookup-title">Your mining statistics</h2>
              <p>
                See device rates, accepted shares, rewards and payouts for your
                address.
              </p>
              <form action="/explorer/pool/miner">
                <label htmlFor="pool-address">
                  Testnet address or public key hash
                </label>
                <input
                  id="pool-address"
                  name="address"
                  placeholder="trq1… or 64-character key hash"
                  maxLength={100}
                  required
                  spellCheck={false}
                  autoComplete="off"
                />
                <button className="button primary">View my statistics ↗</button>
              </form>
              <small>Statistics appear after your first accepted share.</small>
            </section>
            <section className="records-panel pool-conditions">
              <h2>How rewards work</h2>
              <dl>
                <div>
                  <dt>Reward scheme</dt>
                  <dd>PPLNS</dd>
                </div>
                <div>
                  <dt>Pool fee</dt>
                  <dd>{data.feePercent}%</dd>
                </div>
                <div>
                  <dt>Minimum payout</dt>
                  <dd>{amount(data.minPayoutAtoms)} RQT</dd>
                </div>
                <div>
                  <dt>Payout interval</dt>
                  <dd>{Math.round(data.payoutEverySeconds / 60)} minutes</dd>
                </div>
                <div>
                  <dt>Reward maturity</dt>
                  <dd>{data.maturity} blocks</dd>
                </div>
              </dl>
              <p>
                Rewards from new blocks mature before they become available for
                payout.
              </p>
              <a className="text-link" href="/docs/pool">
                Shares and payout rules ↗
              </a>
            </section>
            <p className="pool-support">
              Need help?{' '}
              <a href="mailto:support@requant.network">
                support@requant.network
              </a>
            </p>
          </aside>
        </div>

        <section className="rate-panel" id="rates">
          <div className="panel-heading">
            <div>
              <h2>Pool and network rate</h2>
              <span className="muted">
                Tickets/s from shares and block targets · Reported by the pool
              </span>
            </div>
            <span className="state">Recent history</span>
          </div>
          <RateChart
            series={data.history}
            label="Pool and network ticket rate over recent hours"
          />
        </section>

        <PoolActivity
          minerCount={data.miners.length}
          miners={
            <section className="records-panel">
              <div className="panel-heading">
                <div>
                  <h2>Miners</h2>
                  <span className="muted">
                    Balances are paid once they reach the minimum payout
                  </span>
                </div>
              </div>
              {data.miners.length === 0 ? (
                <div className="empty-state">
                  No miners yet. Start one with the steps above.
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Miner · devices</th>
                        <th>Rate</th>
                        <th>Share of pool</th>
                        <th>Maturing</th>
                        <th>Balance</th>
                        <th>Paid</th>
                        <th>Blocks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.miners.map((m: any) => {
                        const share = data.rate ? m.rate / data.rate : 0;
                        const toPayout = Number(
                          (BigInt(m.balanceAtoms) * BigInt(100)) / minPayout
                        );
                        return (
                          <tr key={m.address}>
                            <td>
                              <MinerLink address={m.address} />{' '}
                              <span className="muted">
                                · {m.workers.length} device
                                {m.workers.length === 1 ? '' : 's'}
                              </span>
                            </td>
                            <td className="mono">{rate(m.rate)}</td>
                            <td>
                              <span className="pool-bar">
                                <i
                                  style={{
                                    width: `${Math.min(100, share * 100)}%`,
                                  }}
                                />
                              </span>{' '}
                              <span className="muted">{percent(share)}</span>
                            </td>
                            <td className="mono muted">
                              {amount(m.immatureAtoms)} RQT
                            </td>
                            <td
                              className="mono"
                              title={`${Math.min(100, toPayout)}% of the minimum payout`}
                            >
                              {amount(m.balanceAtoms)} RQT
                            </td>
                            <td className="mono">{amount(m.paidAtoms)} RQT</td>
                            <td>{m.blocks}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          }
          blocks={
            <section className="records-panel">
              <div className="panel-heading">
                <div>
                  <h2>Blocks found</h2>
                  <span className="muted">
                    Effort: shares spent on the block against the expected
                    number
                  </span>
                </div>
              </div>
              {data.blocks.length === 0 ? (
                <div className="empty-state">No blocks found yet.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Height</th>
                        <th>Time (UTC)</th>
                        <th>Found by</th>
                        <th>Reward</th>
                        <th>Effort</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.blocks.map((b: any) => (
                        <tr key={b.id}>
                          <td>
                            <Link
                              className="height"
                              href={'/block/' + b.height}
                            >
                              {b.height.toLocaleString('en-US')}
                            </Link>
                          </td>
                          <td className="mono muted">
                            {new Date(b.time * 1000)
                              .toISOString()
                              .replace('T', ' ')
                              .slice(0, 19)}
                          </td>
                          <td>
                            <MinerLink address={b.finder} />
                          </td>
                          <td className="mono">{amount(b.rewardAtoms)} RQT</td>
                          <td className="mono">{percent(b.effort, 0)}</td>
                          <td>
                            <Status value={b.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          }
          payouts={
            <section className="records-panel">
              <div className="panel-heading">
                <div>
                  <h2>Payouts</h2>
                  <span className="muted">
                    One transaction pays every miner over the minimum
                  </span>
                </div>
              </div>
              <Payouts payouts={data.payouts} />
            </section>
          }
        />

        <div className="explorer-notes">
          <p>
            <span className="status-dot" /> Observed{' '}
            {new Date(data.observedAt).toISOString().slice(11, 19)} UTC · Pool
            address <MinerLink address={data.address} />
          </p>
          <p>Share difficulty: {data.shareBits} bits</p>
        </div>
        <div className="notice">
          Testnet coins have no value. Rates are estimates from submitted shares
          and block targets; the pool may be reset with the testnet.
        </div>
      </main>
      <Footer />
    </>
  );
}
