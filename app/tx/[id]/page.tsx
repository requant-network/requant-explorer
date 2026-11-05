import Link from 'next/link';
import { getTransaction } from '../../../src/chain.mjs';
import {
  Header,
  Footer,
  Search,
  Details,
  Failure,
  HashLink,
} from '../../../src/ui';
import { amount } from '../../../src/format.mjs';
import { WorkspaceNav, FullHash, IndexNotice } from '../../../src/records';
import { Refresh, Time, Copy } from '../../../src/workspace';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Transaction' };
export default async function TransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let tx;
  try {
    tx = await getTransaction((await params).id);
  } catch (error) {
    return <Failure error={error} />;
  }
  const feeRate =
    tx.feeRate === null
      ? 'Unavailable'
      : (BigInt(tx.feeRate) / BigInt(100)).toString() +
        '.' +
        (BigInt(tx.feeRate) % BigInt(100)).toString().padStart(2, '0') +
        ' atoms/byte';
  return (
    <>
      <Header />
      <main className="explorer-page workspace-page">
        <WorkspaceNav />
        <Search />
        <div className="detail-heading">
          <div>
            <div className="eyebrow">Requant testnet / Transaction</div>
            <h1>{tx.coinbase ? 'Mining reward' : 'Transaction'}</h1>
          </div>
          <span
            className={
              'state ' + (tx.height === null ? 'planned' : 'completed')
            }
          >
            {tx.height === null ? 'Pending' : 'Confirmed'}
          </span>
        </div>
        <FullHash value={tx.txid} />
        <Refresh observedAt={tx.observedAt} />
        <Details
          rows={
            [
              [
                'Block',
                tx.height === null ? (
                  'Awaiting a block'
                ) : (
                  <Link prefetch={false} href={'/block/' + tx.blockId}>
                    {tx.height.toLocaleString('en-US')}
                  </Link>
                ),
              ],
              ['Block time', <Time seconds={tx.time} />],
              ['Confirmations', tx.confirmations],
              ['Output total', amount(tx.totalAtoms) + ' RQT'],
              [
                'Fee',
                tx.coinbase
                  ? 'Not applicable to issuance'
                  : amount(tx.fee) + ' RQT',
              ],
              ['Fee density', tx.coinbase ? '—' : feeRate],
              ['Size', tx.hex.length / 2 + ' bytes'],
              ...(tx.coinbase
                ? [
                    [
                      'Reward availability',
                      tx.maturityRemaining
                        ? tx.maturityRemaining + ' more blocks to maturity'
                        : 'Mature on the observed chain',
                    ],
                  ]
                : []),
            ] as [string, any][]
          }
        />
        <p className="notice">
          {tx.coinbase
            ? 'New coins and any transaction fees are distributed under testnet consensus rules. Mining rewards mature after 100 blocks of height difference.'
            : 'Output total includes every output, including possible change. Explorer data does not identify which output is change. Confirmation time depends on new blocks.'}
        </p>
        <IndexNotice coverage={tx.indexCoverage} />
        <div className="transfer-grid">
          <section className="transfer-panel">
            <h2>
              Inputs <small>{tx.inputs.length}</small>
            </h2>
            {tx.coinbase ? (
              <p>Block issuance — no previous outputs are spent.</p>
            ) : (
              tx.inputs.map((input: any, index: number) => (
                <div className="transfer-row" key={index}>
                  <Link
                    prefetch={false}
                    className="hash"
                    href={'/tx/' + input.txid + '#output-' + input.vout}
                  >
                    {input.txid.slice(0, 12)}…:{input.vout}
                  </Link>
                  {input.address && (
                    <HashLink type="address" value={input.address} />
                  )}
                  <strong>
                    {input.value === null
                      ? 'Unresolved input value'
                      : amount(input.value) + ' RQT'}
                  </strong>
                  {input.unlock && (
                    <span className="state">Unlock: {input.unlock.kind}</span>
                  )}
                  {(Number(input.after_height) > 0 ||
                    Number(input.after_blocks) > 0) && (
                    <small>
                      Lock: height {input.after_height}, relative{' '}
                      {input.after_blocks} blocks
                    </small>
                  )}
                </div>
              ))
            )}
          </section>
          <section className="transfer-panel">
            <h2>
              Outputs <small>{tx.outputs.length}</small>
            </h2>
            {tx.outputs.map((output: any, index: number) => (
              <div className="transfer-row" id={'output-' + index} key={index}>
                <small>
                  Output #{index}
                  {tx.coinbase
                    ? index === 0
                      ? ' · miner'
                      : index === 1
                        ? ' · development fund'
                        : ''
                    : ''}
                </small>
                <HashLink type="address" value={output.address} />
                <strong>{amount(output.value)} RQT</strong>
                <Copy value={output.address} label="Copy address" />
                {output.spentBy ? (
                  <Link
                    prefetch={false}
                    className="text-link"
                    href={'/tx/' + output.spentBy.txid}
                  >
                    Spent by {output.spentBy.txid.slice(0, 12)}… →
                  </Link>
                ) : (
                  <span className="muted">
                    {tx.height === null
                      ? 'Unconfirmed output'
                      : tx.indexCoverage.complete
                        ? 'Unspent on indexed chain; mempool spending may differ'
                        : 'Spending status not fully indexed'}
                  </span>
                )}
              </div>
            ))}
          </section>
        </div>
        <details className="technical">
          <summary>Technical details / raw transaction</summary>
          <Copy value={tx.hex} label="Copy transaction hex" />
          <pre>{tx.hex}</pre>
          {tx.inputs.some((i: any) => i.unlock) && (
            <pre>
              {JSON.stringify(
                tx.inputs.map((i: any) => ({
                  txid: i.txid,
                  vout: i.vout,
                  unlock: i.unlock,
                  after_height: i.after_height,
                  after_blocks: i.after_blocks,
                })),
                null,
                2
              )}
            </pre>
          )}
          <a
            className="text-link"
            href={'/explorer/api/transactions/' + tx.txid}
          >
            View JSON →
          </a>
        </details>
      </main>
      <Footer />
    </>
  );
}
