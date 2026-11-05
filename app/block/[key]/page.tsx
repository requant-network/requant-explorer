import Link from 'next/link';
import { getBlock } from '../../../src/chain.mjs';
import {
  Header,
  Footer,
  Search,
  Details,
  Failure,
  HashLink,
} from '../../../src/ui';
import { amount } from '../../../src/format.mjs';
import { WorkspaceNav, FullHash, TransactionRows } from '../../../src/records';
import { Refresh, Time } from '../../../src/workspace';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Block' };
export default async function BlockPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<any>;
}) {
  const query = await searchParams;
  let b;
  try {
    b = await getBlock((await params).key, Number(query.offset || 0));
  } catch (error) {
    return <Failure error={error} />;
  }
  return (
    <>
      <Header />
      <main className="explorer-page workspace-page">
        <WorkspaceNav />
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
        <FullHash value={b.id} />
        <Refresh observedAt={b.observedAt} />
        <div className="block-navigation">
          {b.height > 0 && (
            <Link
              prefetch={false}
              className="button"
              href={'/block/' + b.previous}
            >
              ← Previous block
            </Link>
          )}
          {b.active && b.confirmations > 1 && (
            <Link
              prefetch={false}
              className="button"
              href={'/block/' + (b.height + 1)}
            >
              Next block →
            </Link>
          )}
        </div>
        <Details
          rows={[
            ['Block time', <Time seconds={b.time} />],
            ['Confirmations', b.confirmations],
            [
              'Interval from parent',
              b.intervalSeconds === null
                ? b.height === 0
                  ? 'Genesis'
                  : 'Unavailable'
                : b.intervalSeconds + ' seconds',
            ],
            ['Transactions', b.txs],
            ['Block size', b.byteLength.toLocaleString('en-US') + ' bytes'],
            [
              'Miner payout address',
              b.miner ? (
                <HashLink type="address" value={b.miner} />
              ) : (
                'Unavailable'
              ),
            ],
            [
              'Miner output (including fees)',
              b.rewardAtoms === null
                ? 'Unavailable'
                : amount(b.rewardAtoms) + ' RQT',
            ],
            [
              'Development fund output',
              b.fundAtoms === null
                ? 'Unavailable'
                : amount(b.fundAtoms) + ' RQT',
            ],
            [
              'Total transaction fees',
              b.feesAtoms === null
                ? 'Indexing transaction bodies'
                : amount(b.feesAtoms) + ' RQT',
            ],
          ]}
        />
        <details className="technical">
          <summary>TNet work claim / block header</summary>
          <Details
            rows={[
              [
                'Epoch',
                b.epoch +
                  ' · ' +
                  (1440 - (b.height % 1440)) +
                  ' blocks to next epoch',
              ],
              [
                'Work claim',
                '272 bytes / TNet v1; excludes header and transactions',
              ],
              ['Nonce', b.nonce],
              ['Row / piece', b.row + ' / ' + b.piece],
              ['Target', b.target],
              ['Transaction root', b.txRoot],
              ['Parent block', <HashLink value={b.previous} />],
            ]}
          />
          <a className="text-link" href={'/explorer/api/blocks/' + b.id}>
            View JSON →
          </a>
        </details>
        <section className="records-panel">
          <div className="panel-heading">
            <h2>Transactions</h2>
            <span className="muted">
              {b.txids.length ? b.offset + 1 : 0}–
              {Math.min(b.offset + 40, b.txids.length)} of {b.txids.length}
            </span>
          </div>
          {b.active ? (
            <TransactionRows transactions={b.transactions} />
          ) : (
            <div className="empty-state">
              This block is outside the active chain. Its transactions do not
              receive confirmations from this branch.
            </div>
          )}
        </section>
        {b.active && (
          <div className="actions">
            {b.offset > 0 && (
              <Link
                prefetch={false}
                className="button"
                href={
                  '/block/' + b.id + '?offset=' + Math.max(0, b.offset - 40)
                }
              >
                ← Previous transactions
              </Link>
            )}
            {b.nextOffset !== null && (
              <Link
                prefetch={false}
                className="button primary"
                href={'/block/' + b.id + '?offset=' + b.nextOffset}
              >
                More transactions →
              </Link>
            )}
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
