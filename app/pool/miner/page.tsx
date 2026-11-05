import { redirect } from 'next/navigation';
import { parsePayee } from '../../../src/format.mjs';
import { PoolShell } from '../ui';
import { MinerLookup } from '../controls';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'My pool miner' };
export default async function MinerLookupPage({
  searchParams,
}: {
  searchParams: Promise<{ address?: string }>;
}) {
  const input = String((await searchParams).address || '').slice(0, 101);
  let address = '',
    error = '';
  if (input) {
    try {
      address = parsePayee(input).address;
    } catch {
      error =
        'Enter a valid trq1 testnet address or 64-character public key hash.';
    }
  }
  if (address) redirect('/pool/miner/' + address);
  return (
    <PoolShell active="miner">
      <div className="pool-title-row">
        <div>
          <div className="eyebrow">Your mining dashboard</div>
          <h1>
            My miner<span className="period">.</span>
          </h1>
          <p>Check your devices, available rewards and sent payouts.</p>
        </div>
      </div>
      <section className="records-panel pool-lookup-page">
        <MinerLookup initial={input} error={error} />
      </section>
    </PoolShell>
  );
}
