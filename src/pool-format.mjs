export function workerActive(worker, seconds) {
  return (
    worker.rate > 0 && worker.lastShare > 0 && seconds - worker.lastShare <= 600
  );
}
export function rejectionPercent(worker) {
  const rejected = BigInt(worker.rejected || 0),
    accepted = BigInt(worker.shares || 0);
  return accepted + rejected
    ? Number((rejected * 10000n) / (accepted + rejected)) / 100
    : null;
}
