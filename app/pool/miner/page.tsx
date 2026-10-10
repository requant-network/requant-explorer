import { redirect } from 'next/navigation';
export const dynamic = 'force-dynamic';
// The lookup form on the pool page: /pool/miner?address=… → /pool/miner/<address>
export default async function MinerLookup({
  searchParams,
}: {
  searchParams: Promise<{ address?: string }>;
}) {
  const address = String((await searchParams).address || '')
    .trim()
    .replace(/[^0-9a-zA-Z]/g, '')
    .slice(0, 100);
  redirect(address ? '/pool/miner/' + address : '/pool');
}
