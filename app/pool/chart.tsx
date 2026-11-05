'use client';
import { useEffect, useState } from 'react';
import { rate } from '../../src/format.mjs';
import { Time } from '../../src/workspace';

export function PoolChart({
  address = '',
  observedAt,
}: {
  address?: string;
  observedAt: number;
}) {
  const [period, setPeriod] = useState('24h'),
    [source, setSource] = useState('shares'),
    [metric, setMetric] = useState('rate');
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [hover, setHover] = useState(-1);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    const query = new URLSearchParams({
      period,
      ...(address ? { address } : {}),
    });
    fetch('/explorer/api/pool/metrics?' + query, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('Chart unavailable');
        return r.json();
      })
      .then((d) => {
        setData(d);
        setHover(-1);
      })
      .catch((e) => {
        if (e.name !== 'AbortError')
          setError(
            'Could not refresh the chart. Try another period or refresh the page.'
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [period, address, observedAt]);
  const blockSource = source === 'blocks';
  const rows = (blockSource ? data?.hourly : data?.series) || [];
  const showNetwork =
    metric === 'rate' && rows.some((r: any) => r.network != null);
  const start = blockSource ? (rows[0]?.time || 0) - 1800 : data?.start || 0;
  const end = blockSource ? (rows.at(-1)?.time || 0) + 1800 : data?.end || 1;
  const span = Math.max(1, end - start),
    bucket = blockSource ? 3600 : data?.bucketSeconds || 300;
  const key = metric === 'devices' ? 'devices' : 'rate';
  const present = rows
    .flatMap((r: any) => [r[key], ...(showNetwork ? [r.network] : [])])
    .filter((v: any) => v !== null && v !== undefined);
  const max = Math.max(1, ...present);
  const x = (r: any) =>
    Math.max(0, Math.min(900, ((r.time - start) * 900) / span));
  const y = (v: number) => 180 - (v / max) * 150;
  const path = (field: string) =>
    rows
      .map((r: any, i: number) =>
        r[field] == null
          ? ''
          : `${i === 0 || rows[i - 1][field] == null || r.time - rows[i - 1].time > bucket * 1.6 ? 'M' : 'L'}${x(r)},${y(r[field])}`
      )
      .join(' ');
  const index = hover < 0 ? rows.length - 1 : Math.min(hover, rows.length - 1),
    chosen = rows[index];
  const value = (n: number | null | undefined) =>
    n == null
      ? 'Unavailable'
      : metric === 'devices'
        ? `${n.toLocaleString('en-US', { maximumFractionDigits: 1 })} active devices`
        : rate(n);
  return (
    <section
      className="records-panel pool-chart-panel"
      aria-label={address ? 'Miner history' : 'Pool history'}
    >
      <div className="panel-heading">
        <div>
          <h2>{address ? 'Your mining history' : 'Pool activity over time'}</h2>
          <span className="muted">
            {blockSource
              ? 'Historical rate inferred from block work'
              : 'Share-based rate · up to 10-minute window'}
          </span>
        </div>
        <div className="chart-toolbar">
          <label>
            Metric
            <select
              aria-label="Pool chart metric"
              value={metric}
              onChange={(e) => {
                setMetric(e.target.value);
                if (e.target.value === 'devices') setSource('shares');
                setHover(-1);
              }}
            >
              <option value="rate">Ticket rate</option>
              <option value="devices">Active devices</option>
            </select>
          </label>
          <label>
            Source
            <select
              aria-label="Pool chart source"
              value={source}
              disabled={metric === 'devices'}
              onChange={(e) => {
                setSource(e.target.value);
                setHover(-1);
              }}
            >
              <option value="shares">Shares</option>
              <option value="blocks">Blocks · last 24h</option>
            </select>
          </label>
          <label>
            Period
            <select
              aria-label="Pool chart period"
              value={blockSource ? '24h' : period}
              disabled={blockSource}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {[
                ['1h', '1 hour'],
                ['6h', '6 hours'],
                ['24h', '24 hours'],
                ['7d', '7 days'],
                ['30d', '30 days'],
              ].map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="pool-chart-body" aria-busy={loading}>
        {error && (
          <p className="notice warning" role="status">
            {error}
          </p>
        )}
        {!data || data.period !== period ? (
          <div className="pool-skeleton pool-chart-skeleton" role="status">
            {loading ? 'Loading recorded history…' : 'Chart unavailable.'}
          </div>
        ) : !rows.length ? (
          <div className="chart-empty">
            <p>
              No observations in this period yet. New measurements appear as the
              pool reports them.
            </p>
          </div>
        ) : (
          <>
            <div className="pool-chart-readout">
              <strong>{chosen ? value(chosen[key]) : 'Unavailable'}</strong>
              {chosen && (
                <span>
                  <Time seconds={chosen.time} />
                  {showNetwork && chosen.network != null
                    ? ` · Network estimate ${rate(chosen.network)}`
                    : ''}
                </span>
              )}
            </div>
            <svg
              viewBox="0 0 900 205"
              role="img"
              aria-label={
                metric === 'devices'
                  ? 'Active devices from recorded observations'
                  : 'Pool or miner rate compared with the historical network estimate'
              }
              preserveAspectRatio="none"
              onPointerMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect(),
                  time = start + ((e.clientX - rect.left) / rect.width) * span;
                let nearest = 0;
                for (let i = 1; i < rows.length; i++)
                  if (
                    Math.abs(rows[i].time - time) <
                    Math.abs(rows[nearest].time - time)
                  )
                    nearest = i;
                setHover(nearest);
              }}
              onPointerLeave={() => setHover(-1)}
            >
              {[30, 80, 130, 180].map((t) => (
                <line
                  key={t}
                  x1="0"
                  x2="900"
                  y1={t}
                  y2={t}
                  stroke="var(--line)"
                  strokeDasharray="4 5"
                />
              ))}
              {showNetwork && (
                <path
                  d={path('network')}
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth="1.5"
                  strokeDasharray="5 5"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              <path
                d={path(key)}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              {chosen && chosen[key] != null && (
                <>
                  <line
                    x1={x(chosen)}
                    x2={x(chosen)}
                    y1="20"
                    y2="180"
                    stroke="var(--line)"
                  />
                  <circle
                    cx={x(chosen)}
                    cy={y(chosen[key])}
                    r="3"
                    fill="var(--accent)"
                  />
                </>
              )}
            </svg>
            <input
              type="range"
              className="pool-chart-scrubber"
              aria-label="Inspect chart observation"
              min={0}
              max={Math.max(0, rows.length - 1)}
              value={Math.max(0, index)}
              onChange={(e) => setHover(Number(e.target.value))}
            />
            <div className="pool-chart-axis">
              <Time seconds={start} />
              <Time seconds={end} />
            </div>
            <div className="pool-chart-legend">
              <span>
                <i />
                {address ? 'Miner' : 'Pool'}
              </span>
              {showNetwork && (
                <span>
                  <i className="network" />
                  {blockSource
                    ? 'Network · block work per hour'
                    : 'Network · historical 60-block estimate'}
                </span>
              )}
            </div>
            {!blockSource && metric === 'rate' && (
              <div className="pool-chart-summary">
                <span>
                  Recorded average <strong>{rate(data.averageRate)}</strong>
                </span>
                <span>
                  Recorded peak <strong>{rate(data.peakRate)}</strong>
                </span>
              </div>
            )}
          </>
        )}
        <p className="pool-help">
          {blockSource ? (
            'Block-based rates describe work in historical blocks, not live GPU telemetry.'
          ) : (
            <>
              Gaps are unrecorded data, not zero rate.{' '}
              {data?.first ? (
                <>
                  <Time seconds={data.first} /> is the earliest observation in
                  this period.{' '}
                </>
              ) : null}
              Longer periods fill as measurements accumulate; samples are
              retained for 30 days.
            </>
          )}
        </p>
        {data?.status === 'stale' && (
          <p className="pool-help" role="status">
            Showing the last collected pool data.
          </p>
        )}
      </div>
    </section>
  );
}
