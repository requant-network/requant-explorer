'use client';
import { useEffect, useState } from 'react';
import { amount, date, rate } from './format.mjs';
export default function ActivityChart({ observedAt }: { observedAt: number }) {
  const [period, setPeriod] = useState('24h'),
    [metric, setMetric] = useState('rate'),
    [data, setData] = useState<any>(null),
    [error, setError] = useState(''),
    [hover, setHover] = useState(0),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError('');
    fetch('/explorer/api/metrics?period=' + period, {
      signal: abort.signal,
      cache: 'no-store',
    })
      .then(async (r) => {
        if (!r.ok) throw new Error('Chart data is temporarily unavailable.');
        return r.json();
      })
      .then((value) => {
        setData(value);
        setHover(0);
      })
      .catch((e) => {
        if (e.name !== 'AbortError')
          setError('Chart data is temporarily unavailable.');
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [period, observedAt]);
  const rows =
    (metric === 'rate'
      ? data?.series
      : metric === 'interval'
        ? data?.intervals
        : metric === 'transfers'
          ? data?.transfers
          : data?.fees) || [];
  const points = rows.map((r: any) => ({
    time: r.time,
    raw: metric === 'rate' ? r.rate : r.value,
    value:
      metric === 'rate' ? r.rate : r.value === null ? null : Number(r.value),
  }));
  const present = points.filter((p: any) => p.value !== null),
    max = Math.max(1, ...present.map((p: any) => p.value)),
    start = points[0]?.time || 0,
    span = Math.max(1, (points.at(-1)?.time || 0) - start);
  const x = (p: any) => ((p.time - start) * 900) / span,
    y = (p: any) => 180 - (p.value / max) * 150;
  const path = points
    .map((p: any, i: number) =>
      p.value === null
        ? ''
        : (i === 0 || points[i - 1].value === null ? 'M' : 'L') +
          x(p) +
          ',' +
          y(p)
    )
    .join(' ');
  const chosen = points[Math.min(hover, points.length - 1)];
  const label = (p: any) =>
    p.raw === null
      ? 'Unavailable'
      : metric === 'rate'
        ? rate(p.raw)
        : metric === 'fees'
          ? amount(p.raw) + ' RQT'
          : metric === 'interval'
            ? Number(p.raw).toFixed(1) + ' seconds'
            : p.raw + ' transfers';
  return (
    <section className="rate-panel">
      <div className="panel-heading">
        <div>
          <h2>Network activity</h2>
          <span className="muted">
            Observed history · estimates from this node
          </span>
        </div>
        <div className="chart-toolbar">
          <label>
            Metric{' '}
            <select
              aria-label="Chart metric"
              value={metric}
              onChange={(e) => {
                setMetric(e.target.value);
                setHover(0);
              }}
            >
              <option value="rate">Network tickets/s</option>
              <option value="interval">Block interval</option>
              <option value="transfers">Transfers per interval</option>
              <option value="fees">Fees per day</option>
            </select>
          </label>
          <label>
            Period{' '}
            <select
              aria-label="Chart period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="1h">1 hour</option>
              <option value="24h">24 hours</option>
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
            </select>
          </label>
        </div>
      </div>
      {loading ? (
        <div className="chart-empty" aria-busy="true">
          <p>Loading recorded observations…</p>
        </div>
      ) : error ? (
        <p className="chart-error" role="status">
          {error}
        </p>
      ) : present.length > 1 ? (
        <>
          <div className="chart">
            <svg
              viewBox="0 0 900 200"
              preserveAspectRatio="none"
              role="img"
              tabIndex={0}
              aria-label="Activity chart. Use left and right arrow keys to inspect observations."
              onPointerMove={(e) => {
                const box = e.currentTarget.getBoundingClientRect(),
                  time = start + ((e.clientX - box.left) / box.width) * span;
                let nearest = 0;
                points.forEach((p: any, i: number) => {
                  if (
                    Math.abs(p.time - time) <
                    Math.abs(points[nearest].time - time)
                  )
                    nearest = i;
                });
                setHover(nearest);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                  e.preventDefault();
                  setHover((i) =>
                    Math.max(
                      0,
                      Math.min(
                        points.length - 1,
                        i + (e.key === 'ArrowRight' ? 1 : -1)
                      )
                    )
                  );
                }
              }}
            >
              {[30, 80, 130, 180].map((n) => (
                <line
                  key={n}
                  x1="0"
                  x2="900"
                  y1={n}
                  y2={n}
                  stroke="#ddd8cf"
                  strokeDasharray="4 5"
                />
              ))}
              <path
                d={path}
                fill="none"
                stroke="#d84420"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              {chosen && chosen.value !== null && (
                <circle cx={x(chosen)} cy={y(chosen)} r="4" fill="#d84420" />
              )}
            </svg>
            <div className="chart-scale">
              <span>{date(start / 1000)}</span>
              <span>{date((points.at(-1)?.time || 0) / 1000)}</span>
            </div>
          </div>
          <div className="chart-hover" aria-live="polite">
            {chosen && date(chosen.time / 1000) + ' · ' + label(chosen)}
          </div>
        </>
      ) : (
        <div className="chart-empty">
          <p>
            {present.length
              ? 'Not enough observations in this period yet.'
              : 'No recorded observations in this period.'}
          </p>
        </div>
      )}
      <p className="chart-hover">
        Rate uses up to 120 block intervals. Gaps mean unavailable data.
        Historical index: {data?.coverage?.indexedBlocks ?? '—'} /{' '}
        {data?.coverage?.totalBlocks ?? '—'} blocks. Earlier periods fill as
        observations are collected.
      </p>
    </section>
  );
}
