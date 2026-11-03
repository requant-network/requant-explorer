// Requests per visitor per minute, counted in proxy.ts before a page or API route asks the node.
// The edge proxy (Caddy) overwrites X-Real-IP; an IPv6 visitor is counted by its /64, which one
// subscriber gets whole.
export const PER_MINUTE = 120;
const WINDOW_MS = 60_000;
// shortcut: one process keeps the counts in memory; a second explorer replica would need a shared store.
const MAX_VISITORS = 50_000;

export function visitorKey(address) {
  const ip = (address || '').trim().toLowerCase();
  if (!ip.includes(':')) return ip || 'local';
  const [head, tail = ''] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = ip.includes('::')
    ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
    : left;
  return groups
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ''))
    .join(':') + '::/64';
}

export function createLimiter(limit = PER_MINUTE, now = () => Date.now()) {
  let started = now();
  const counts = new Map();
  return function allow(key) {
    const time = now();
    if (time - started >= WINDOW_MS || counts.size >= MAX_VISITORS) {
      started = time;
      counts.clear();
    }
    const count = (counts.get(key) || 0) + 1;
    counts.set(key, count);
    return {
      allowed: count <= limit,
      retryAfter: Math.ceil((started + WINDOW_MS - time) / 1000),
    };
  };
}
