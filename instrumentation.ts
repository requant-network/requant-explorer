export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.RPC_URL) {
    const { overview } = await import('./src/chain.mjs');
    const timer = setInterval(() => {
      void overview();
    }, 30000);
    timer.unref();
    void overview();
  }
}
