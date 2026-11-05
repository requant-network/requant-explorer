import { PoolShell } from './ui';
export default function Loading() {
  return (
    <PoolShell>
      <div aria-busy="true" className="pool-loading">
        <div className="pool-skeleton pool-loading-title" />
        <div className="pool-skeleton pool-loading-summary" />
        <div className="pool-skeleton pool-chart-skeleton" />
        <p role="status">Loading pool statistics…</p>
      </div>
    </PoolShell>
  );
}
