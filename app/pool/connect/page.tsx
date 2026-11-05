import { pool, poolEndpoint } from '../../../src/pool.mjs';
import { Copy } from '../../../src/workspace';
import { PoolShell, PoolConditions } from '../ui';
import { MiningSetup } from '../controls';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Connect a GPU' };
export default async function Connect({
  searchParams,
}: {
  searchParams: Promise<{ address?: string }>;
}) {
  let data: any = null;
  try {
    data = await pool();
  } catch {}
  const initial = String((await searchParams).address || '').slice(0, 100);
  return (
    <PoolShell active="connect">
      <div className="pool-title-row">
        <div>
          <div className="eyebrow">TNet v1 / GPU mining</div>
          <h1>
            Connect a GPU<span className="period">.</span>
          </h1>
          <p>
            Choose your system, paste your public address and copy the command.
          </p>
        </div>
        <a className="text-link" href="/docs/mining">
          Full mining guide ↗
        </a>
      </div>
      <div className="pool-connect-workspace">
        <section className="records-panel pool-setup">
          <div className="panel-heading">
            <h2>Build your mining command</h2>
          </div>
          <div className="pool-setup-body">
            <div className="pool-endpoint">
              <span>Pool endpoint</span>
              <code>{poolEndpoint()}</code>
              <Copy value={poolEndpoint()} label="Copy pool endpoint" />
              <small>TNet · HTTP getwork / submitwork · Not Stratum</small>
            </div>
            <ol className="pool-prerequisites">
              <li>
                <strong>Get a public payout address.</strong> Create one in the{' '}
                <a className="text-link" href="/wallet/">
                  Web Wallet ↗
                </a>
                . Keep the private key and recovery phrase private.
              </li>
              <li>
                <strong>Download CPPminer.</strong> Extract the{' '}
                <a
                  className="text-link"
                  href="https://github.com/danifest751/CPPminer/releases/latest"
                >
                  Windows / Linux release ↗
                </a>
                . NVIDIA CUDA requires a compatible tensor-core GPU; AMD / Intel
                use OpenCL. See the release requirements for your device.
              </li>
            </ol>
            <MiningSetup endpoint={poolEndpoint()} initial={initial} />
          </div>
        </section>
        <aside className="pool-connect-help">
          <section className="records-panel">
            <div className="panel-heading">
              <h2>After starting CPPminer</h2>
            </div>
            <div className="pool-help-body">
              <ol>
                <li>
                  Check the miner log for a successful connection and accepted
                  shares.
                </li>
                <li>
                  Open your miner’s statistics using the link below the command.
                </li>
                <li>
                  Rate appears after accepted shares; a slow device may need
                  several minutes.
                </li>
                <li>
                  Use a unique worker name for each GPU so you can identify it.
                </li>
              </ol>
              <p>
                Zero rate may mean no recent accepted shares. It does not by
                itself diagnose a GPU fault.
              </p>
              <a href="/discord" className="text-link">
                Ask for mining support ↗
              </a>
            </div>
          </section>
          {data ? (
            <PoolConditions data={data} />
          ) : (
            <div className="notice" role="status">
              Live pool rules are temporarily unavailable. The command builder
              still uses the configured public endpoint.
            </div>
          )}
        </aside>
      </div>
    </PoolShell>
  );
}
