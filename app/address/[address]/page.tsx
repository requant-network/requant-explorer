import Link from 'next/link';
import { getAddress } from '../../../src/chain.mjs';
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
export const metadata = { title: 'Address' };
export default async function AddressPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  let a;
  try {
    a = await getAddress((await params).address);
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
            <div className="eyebrow">Requant testnet / Address</div>
            <h1>Address overview</h1>
          </div>
          <span className="state">Testnet / trq1</span>
        </div>
        <p className="full-hash mono">{a.address}</p>
        <Details
          rows={[
            ['Spendable balance', amount(a.availableAtoms) + ' RQT'],
            ['Confirmed unspent', amount(a.confirmedAtoms) + ' RQT'],
            ['Unconfirmed outputs', amount(a.pendingAtoms) + ' RQT'],
            ['Immature coinbase', amount(a.immatureAtoms) + ' RQT'],
            ['Unspent outputs', a.utxos.length],
            ['Key hash', <span className="mono full-hash">{a.owner}</span>],
          ]}
        />
        <p className="notice">
          Balances exclude confirmed outputs already spent by mempool
          transactions. Spendable balance includes eligible unconfirmed outputs.
        </p>
        <section className="records-panel">
          <div className="panel-heading">
            <h2>Transaction history</h2>
            <span className="muted">Newest first · up to 100 records</span>
          </div>
          {a.history.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Transaction</th>
                    <th>Height</th>
                    <th>Received</th>
                    <th>Sent</th>
                    <th>Confirmations</th>
                  </tr>
                </thead>
                <tbody>
                  {a.history.map((item: any) => (
                    <tr key={item.txid}>
                      <td>
                        <HashLink type="tx" value={item.txid} />
                      </td>
                      <td>
                        {item.height === null ? (
                          'Pending'
                        ) : (
                          <Link
                            className="height"
                            href={'/block/' + item.height}
                          >
                            {Number(item.height).toLocaleString('en-US')}
                          </Link>
                        )}
                      </td>
                      <td className="mono">+{amount(item.received)} RQT</td>
                      <td className="mono">−{amount(item.sent)} RQT</td>
                      <td>{item.confirmations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              No activity on the observed chain or in its mempool.
            </div>
          )}
          {a.truncated && (
            <div className="notice">
              The node returns at most 100 records. Earlier history may exist.
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
