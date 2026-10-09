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
  return (
    <>
      <Header />
      <main className="explorer-page">
        <Search />
        <div className="detail-heading">
          <div>
            <div className="eyebrow">Requant testnet / Transaction</div>
            <h1>{tx.coinbase ? 'Coinbase transaction' : 'Transaction'}</h1>
          </div>
          <span
            className={
              'state ' + (tx.height === null ? 'planned' : 'completed')
            }
          >
            {tx.height === null ? 'Pending' : 'Confirmed'}
          </span>
        </div>
        <p className="full-hash mono">{tx.txid}</p>
        <Details
          rows={[
            [
              'Block height',
              tx.height === null ? (
                'Unconfirmed'
              ) : (
                <Link className="height" href={'/block/' + tx.height}>
                  {tx.height.toLocaleString('en-US')}
                </Link>
              ),
            ],
            ['Confirmations', tx.confirmations],
            ['Output total', amount(tx.totalAtoms) + ' RQT'],
            ['Fee', amount(tx.fee) + ' RQT'],
            ['Type', tx.coinbase ? 'Coinbase / block issuance' : 'Transfer'],
            ['Size', tx.hex.length / 2 + ' bytes'],
          ]}
        />
        <div className="transfer-grid">
          <section className="transfer-panel">
            <h2>
              Inputs <small>{tx.inputs.length}</small>
            </h2>
            {tx.coinbase ? (
              <p>New coins issued under testnet consensus rules.</p>
            ) : (
              tx.inputs.map((input: any, index: number) => (
                <div className="transfer-row" key={index}>
                  <HashLink value={input.txid} type="tx" />
                  <small>Output #{input.vout}</small>
                  {input.address && (
                    <Link className="hash" href={'/address/' + input.address}>
                      {input.address}
                    </Link>
                  )}
                  <strong>
                    {input.value === null
                      ? 'Unresolved'
                      : amount(input.value) + ' RQT'}
                  </strong>
                </div>
              ))
            )}
          </section>
          <section className="transfer-panel">
            <h2>
              Outputs <small>{tx.outputs.length}</small>
            </h2>
            {tx.outputs.map((output: any, index: number) => (
              <div className="transfer-row" key={index}>
                <small>Output #{index}</small>
                <Link className="hash" href={'/address/' + output.address}>
                  {output.address}
                </Link>
                <strong>{amount(output.value)} RQT</strong>
              </div>
            ))}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
