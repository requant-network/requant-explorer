import { parse } from 'lossless-json';
const methods = new Set(['getinfo', 'getblock', 'gettx', 'history', 'utxos']);
let active = 0;
export class RpcError extends Error {
  constructor(message, kind = 'unavailable') {
    super(message);
    this.kind = kind;
  }
}
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
  if (active >= 12)
    throw new RpcError('The explorer is busy. Please try again.');
  active++;
  try {
    const response = await fetch(process.env.RPC_URL, {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.RPC_TOKEN
          ? { Authorization: `Bearer ${process.env.RPC_TOKEN}` }
          : {}),
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
      if (size > 16 * 1024 * 1024) {
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
      throw new RpcError('The node could not complete this request.');
    }
    return reply.result;
  } catch (error) {
    if (error instanceof RpcError) throw error;
    throw new RpcError('The node connection is temporarily unavailable.');
  } finally {
    active--;
  }
}
export function parseRpcForTest(text) {
  return normalize(parse(text));
}
