export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.RPC_URL) {
    if (globalThis.__requantExplorerCollector) return;
    globalThis.__requantExplorerCollector = true;
    const { overview, backfillTransactions } = await import('./src/chain.mjs');
    const { background } = await import('./src/rpc.mjs');
    const refresh = () => void background.run(true, overview);
    const timer = setInterval(refresh, 30000);
    timer.unref();
    refresh();
    const indexTimer = setInterval(() => {
      void background.run(true, () => backfillTransactions().catch(() => {}));
    }, 3000);
    indexTimer.unref();
  }
}
