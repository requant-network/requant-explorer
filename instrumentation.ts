export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.RPC_URL) {
    const { overview } = await import('./src/chain.mjs');
    const { background } = await import('./src/rpc.mjs');
    const refresh = () => void background.run(true, overview);
    const timer = setInterval(refresh, 30000);
    timer.unref();
    refresh();
  }
}
