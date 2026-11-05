import { bech32m } from '@scure/base';
export const hashPattern = /^[a-f0-9]{64}$/i;
export function amount(atoms) {
  const value = BigInt(atoms || 0),
    sign = value < 0n ? '-' : '',
    absolute = value < 0n ? -value : value;
  const whole = (absolute / 100000000n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (absolute % 100000000n)
    .toString()
    .padStart(8, '0')
    .replace(/0+$/, '');
  return sign + whole + (fraction ? '.' + fraction : '');
}
export function encodeAddress(owner) {
  if (!hashPattern.test(owner)) throw new Error('Invalid key hash');
  return bech32m.encode('trq', [
    0,
    ...bech32m.toWords(
      Uint8Array.from(owner.match(/../g), (h) => parseInt(h, 16))
    ),
  ]);
}
export function decodeAddress(address) {
  const parsed = bech32m.decode(address);
  if (parsed.prefix !== 'trq' || parsed.words[0] !== 0)
    throw new Error('Use a Requant testnet address');
  const bytes = bech32m.fromWords(parsed.words.slice(1));
  if (bytes.length !== 32) throw new Error('Invalid address payload');
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
export function parsePayee(input) {
  const value = String(input || '').trim();
  if (value.length > 100)
    throw new Error(
      'Use a Requant testnet address or 64-character public key hash.'
    );
  if (
    !hashPattern.test(value) &&
    value !== value.toLowerCase() &&
    value !== value.toUpperCase()
  )
    throw new Error('Use an address with consistent letter case.');
  const owner = hashPattern.test(value)
    ? value.toLowerCase()
    : decodeAddress(value.toLowerCase());
  return { owner, address: encodeAddress(owner) };
}
export function short(value, width = 10) {
  return value?.length > width * 2
    ? value.slice(0, width) + '…' + value.slice(-width)
    : value;
}
export function date(seconds) {
  return (
    new Date(Number(seconds) * 1000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19) + ' UTC'
  );
}
export function rate(value) {
  return value === null
    ? 'Unavailable'
    : new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 2,
      }).format(Math.max(0, value)) + ' tickets/s';
}
