import Link from 'next/link';
import { amount, rate, short } from '../../src/format.mjs';

// Rate over time, in the explorer's chart style: the pool in orange, the network in graphite.
export function RateChart({
  series,
  label,
}: {
  series: { time: number; pool: number | null; network?: number | null }[];
  label: string;
}) {
  const rows = series.filter((s) => s.pool !== null);
  if (rows.length < 2)
    return (
      <div className="chart-empty">
        <span className="chart-symbol">▥</span>
        <p>The chart appears after two measurements.</p>
      </div>
    );
  const values = rows.flatMap((s) => [s.pool ?? 0, s.network ?? 0]),
    max = Math.max(...values, 1);
  const line = (key: 'pool' | 'network') =>
    rows
      .map(
        (s, i) =>
          `${(i * 900) / (rows.length - 1)},${190 - ((s[key] ?? 0) / max) * 160}`
      )
      .join(' ');
  const hasNetwork = rows.some((s) => s.network);
  const clock = (t: number) => new Date(t * 1000).toISOString().slice(11, 16);
  return (
    <div className="chart">
      <svg
        viewBox="0 0 900 200"
        role="img"
        aria-label={label}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="pool-area" x1="0" y1="0" x2="0" y2="1">
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
        {hasNetwork && (
          <polyline
            points={line('network')}
            fill="none"
            stroke="#20231f"
            strokeOpacity=".45"
            strokeWidth="1.5"
            strokeDasharray="5 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <polygon
          fill="url(#pool-area)"
          points={'0,200 ' + line('pool') + ' 900,200'}
        />
        <polyline
          points={line('pool')}
          fill="none"
          stroke="#ff5426"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="chart-scale">
        <span>{clock(rows[0].time)} UTC</span>
        <span>{rate(max)}</span>
        <span>{clock(rows.at(-1)!.time)} UTC</span>
      </div>
      {hasNetwork && (
        <div className="pool-legend">
          <span>
            <i className="pool-swatch" /> Pool
          </span>
          <span>
            <i className="pool-swatch network" /> Whole network
          </span>
        </div>
      )}
    </div>
  );
}

const STATES: Record<string, string> = {
  confirmed: 'completed',
  immature: 'in_progress',
  pending: 'in_progress',
  orphaned: 'failed',
  returned: 'failed',
};
export function Status({ value }: { value: string }) {
  const label =
    value === 'immature' ? 'Maturing' : value[0].toUpperCase() + value.slice(1);
  return <span className={'state ' + (STATES[value] || '')}>{label}</span>;
}

export function MinerLink({ address }: { address: string }) {
  return (
    <Link className="hash" href={'/pool/miner/' + address} title={address}>
      {short(address)}
    </Link>
  );
}

export function Payouts({
  payouts,
}: {
  payouts: {
    txid: string;
    time: number;
    totalAtoms?: string;
    amountAtoms?: string;
    outputs?: number | null;
    status: string;
  }[];
}) {
  if (!payouts.length)
    return <div className="empty-state">No payouts yet.</div>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Time (UTC)</th>
            {payouts[0].outputs !== undefined && <th>Miners paid</th>}
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((p) => (
            <tr key={p.txid}>
              <td>
                <Link className="hash" href={'/tx/' + p.txid} title={p.txid}>
                  {short(p.txid)}
                </Link>
              </td>
              <td className="mono muted">
                {new Date(p.time * 1000)
                  .toISOString()
                  .replace('T', ' ')
                  .slice(0, 19)}
              </td>
              {p.outputs !== undefined && <td>{p.outputs}</td>}
              <td className="mono">
                {amount(p.totalAtoms ?? p.amountAtoms)} RQT
              </td>
              <td>
                <Status value={p.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ago(seconds: number | null, now = Date.now() / 1000) {
  if (!seconds) return 'never';
  const d = Math.max(0, Math.round(now - seconds));
  if (d < 60) return d + ' s ago';
  if (d < 3600) return Math.round(d / 60) + ' min ago';
  if (d < 86400) return Math.round(d / 3600) + ' h ago';
  return Math.round(d / 86400) + ' d ago';
}

export function percent(value: number | null, digits = 1) {
  return value === null || !Number.isFinite(value)
    ? '—'
    : (value * 100).toFixed(digits) + '%';
}
