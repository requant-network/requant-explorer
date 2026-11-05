import { AsyncLocalStorage } from 'node:async_hooks';
import { parse } from 'lossless-json';
import { RpcError } from './errors.mjs';
export { RpcError } from './errors.mjs';
const methods = new Set([
  'getinfo',
  'getblock',
  'gettx',
  'history',
  'utxos',
  'getrawmempool',
]);
// the mining pool's public JSON-RPC: read-only statistics, no token
const poolMethods = new Set(['poolstats', 'minerstats']);
// The background snapshot (instrumentation.ts) runs inside `background`: visitors get 9 of the 12
// node slots, so a flood of page requests can't stall the snapshot that every page reads. Kept on
// globalThis: Next may bundle instrumentation and the routes apart, and the slots are one budget.
const slots = (globalThis.__requantExplorerRpc ??= {
  active: 0,
  poolActive: 0,
  background: new AsyncLocalStorage(),
});
export const background = slots.background;
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    if (value.isLosslessNumber) return value.value;
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, normalize(child)])
    );
  }
  return value;
}
export async function rpc(method, params = []) {
  if (!methods.has(method))
    throw new RpcError('Unsupported operation', 'invalid');
  if (!process.env.RPC_URL)
    throw new RpcError('The explorer node is not configured.');
  if (slots.active >= (background.getStore() ? 12 : 9))
    throw new RpcError('The explorer is busy. Please try again.');
  slots.active++;
  try {
    return await call(
      process.env.RPC_URL,
      process.env.RPC_TOKEN,
      method,
      params,
      16 * 1024 * 1024
    );
  } finally {
    slots.active--;
  }
}
export async function poolRpc(method, params = []) {
  if (!poolMethods.has(method))
    throw new RpcError('Unsupported operation', 'invalid');
  if (!process.env.POOL_RPC_URL)
    throw new RpcError('The mining pool is not configured.');
  if (slots.poolActive >= 6)
    throw new RpcError('The pool page is busy. Please try again.');
  slots.poolActive++;
  try {
    return await call(
      process.env.POOL_RPC_URL,
      '',
      method,
      params,
      4 * 1024 * 1024
    );
  } finally {
    slots.poolActive--;
  }
}
async function call(url, token, method, params, limit) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ method, params }),
    });
    if (!response.ok)
      throw new RpcError('The node did not respond successfully.');
    const reader = response.body.getReader();
    let size = 0;
    const chunks = [];
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > limit) {
        await reader.cancel();
        throw new RpcError('The node response exceeded the size limit.');
      }
      chunks.push(Buffer.from(part.value));
    }
    const reply = normalize(parse(Buffer.concat(chunks).toString('utf8')));
    if (reply.error) {
      if (/unknown transaction|no block at that height/.test(reply.error))
        throw new RpcError(
          'No matching record on the active chain or in the mempool.',
          'not-found'
        );
      if (/not an address or key hash/.test(reply.error))
        throw new RpcError('Use a Requant testnet address.', 'invalid');
      throw new RpcError('The node could not complete this request.');
    }
    return reply.result;
  } catch (error) {
    if (error instanceof RpcError) throw error;
    throw new RpcError('The node connection is temporarily unavailable.');
  }
}
export function parseRpcForTest(text) {
  return normalize(parse(text));
}
