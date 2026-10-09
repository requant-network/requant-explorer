import Link from 'next/link';
import { getBlock } from '../../../src/chain.mjs';
import {
  Header,
  Footer,
  Search,
  Details,
  Transactions,
  Failure,
} from '../../../src/ui';
import { date } from '../../../src/format.mjs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Block' };
export default async function BlockPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  let b;
  try {
    b = await getBlock((await params).key);
  } catch (error) {
    return <Failure error={error} />;
  }
  return (
    <>
      <Header />
      <main className="explorer-page">
        <Search />
        <div className="detail-heading">
          <div>
            <div className="eyebrow">Requant testnet / Block</div>
            <h1>Block #{b.height.toLocaleString('en-US')}</h1>
          </div>
          <span className={'state ' + (b.active ? 'completed' : 'planned')}>
            {b.active ? 'Active chain' : 'Orphaned block'}
          </span>
        </div>
        <p className="full-hash mono">{b.id}</p>
        <div className="block-navigation">
          {b.height > 0 && (
            <Link className="button" href={'/block/' + (b.height - 1)}>
              ← Previous block
            </Link>
          )}
          <Link className="button" href={'/block/' + (b.height + 1)}>
            Next block →
          </Link>
        </div>
        <Details
          rows={[
            ['Timestamp', date(b.time)],
            ['Confirmations', b.confirmations],
            ['Transactions', b.txs],
            ['Block size', b.byteLength + ' bytes'],
            ['Epoch', b.epoch + ' / 1440 blocks'],
            ['Work claim', '272 bytes / TNet v1'],
            ['Nonce', b.nonce],
            ['Row / piece', b.row + ' / ' + b.piece],
            [
              'Previous block',
              b.height > 0 ? (
                <Link className="hash" href={'/block/' + b.previous}>
                  {b.previous}
                </Link>
              ) : (
                'Genesis'
              ),
            ],
            ['Target', <span className="mono full-hash">{b.target}</span>],
            [
              'Transaction root',
              <span className="mono full-hash">{b.txRoot}</span>,
            ],
          ]}
        />
        <section className="records-panel">
          <div className="panel-heading">
            <h2>Transactions</h2>
          </div>
          {b.active ? (
            <Transactions transactions={b.transactions} />
          ) : (
            <div className="empty-state">
              This block is outside the active chain. Transaction confirmations
              must be checked against the current chain.
            </div>
          )}
          {b.transactionsTruncated && (
            <p className="notice">
              Showing the first 40 transactions. Remaining IDs:{' '}
              {b.txids.slice(40).join(', ')}
            </p>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
