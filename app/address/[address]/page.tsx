import Link from 'next/link';
import QRCode from 'qrcode';
import { RpcError } from '../../../src/rpc.mjs';
import { getAddress } from '../../../src/chain.mjs';
import { Header, Footer, Search, Details, Failure } from '../../../src/ui';
import { amount, short } from '../../../src/format.mjs';
import {
  WorkspaceNav,
  FullHash,
  IndexNotice,
  Filters,
  Pagination,
  TransactionRows,
  queryLink,
} from '../../../src/records';
import { Refresh, ExportCsv } from '../../../src/workspace';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Address' };
export default async function AddressPage({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<any>;
}) {
  const query = await searchParams;
  const outputOffset = Number(query.outputs || 0);
  let a;
  try {
    if (
      !Number.isSafeInteger(outputOffset) ||
      outputOffset < 0 ||
      outputOffset > 1000000
    )
      throw new RpcError('Invalid output page.', 'invalid');
    a = await getAddress((await params).address, query);
  } catch (error) {
    return <Failure error={error} />;
  }
  const path = '/address/' + a.address;
  const qr = await QRCode.toDataURL(a.address, {
    width: 192,
    margin: 2,
    color: { dark: '#20231f', light: '#ffffff' },
  });
  const utxos = query.view === 'utxos';
  const outputRows = [...a.utxos]
    .sort(
      (x, y) =>
        Number(y.height ?? Number.MAX_SAFE_INTEGER) -
          Number(x.height ?? Number.MAX_SAFE_INTEGER) ||
        x.txid.localeCompare(y.txid) ||
        Number(x.vout) - Number(y.vout)
    )
    .slice(outputOffset, outputOffset + 50);
  return (
    <>
      <Header />
      <main className="explorer-page workspace-page">
        <WorkspaceNav />
        <Search />
        <div className="detail-heading">
          <div>
            <div className="eyebrow">Requant testnet / Address</div>
            <h1>Address overview</h1>
          </div>
          <span className="state">Testnet / trq1</span>
        </div>
        <FullHash value={a.address} label="Copy address" />
        <Details
          rows={[
            ['Spendable balance', amount(a.availableAtoms) + ' RQT'],
            ['Confirmed unspent', amount(a.confirmedAtoms) + ' RQT'],
            ['Unconfirmed outputs', amount(a.pendingAtoms) + ' RQT'],
            ['Immature mining rewards', amount(a.immatureAtoms) + ' RQT'],
            ['Unspent outputs', a.utxos.length],
          ]}
        />
        <p className="notice">
          Spendable balance includes eligible unconfirmed outputs. Outputs
          already spent by pending transactions are excluded. Confirmed unspent
          includes immature mining rewards.
        </p>
        <details className="technical qr-panel">
          <summary>Receive address / QR code</summary>
          <div className="address-qr">
            <img
              src={qr}
              width="192"
              height="192"
              alt="QR code containing this Requant testnet address"
            />
            <div>
              <p>
                Scan to copy this testnet address. The QR contains only the
                address, with no requested amount.
              </p>
              <p className="mono full-hash">Key hash: {a.owner}</p>
            </div>
          </div>
        </details>
        <Refresh observedAt={a.observedAt} automatic={false} />
        <IndexNotice coverage={a.coverage} />
        <section className="records-panel">
          <div className="panel-heading">
            <div className="record-tabs">
              <Link
                prefetch={false}
                className={!utxos ? 'selected' : ''}
                href={queryLink(path, query, { view: null })}
              >
                History
              </Link>
              <Link
                prefetch={false}
                className={utxos ? 'selected' : ''}
                href={queryLink(path, {}, { view: 'utxos' })}
              >
                Unspent outputs ({a.utxos.length})
              </Link>
            </div>
            <ExportCsv
              filename={utxos ? 'requant-utxos.csv' : 'requant-history.csv'}
              rows={
                utxos
                  ? [
                      ['txid', 'vout', 'value_atoms', 'height', 'spendable'],
                      ...outputRows.map((u: any) => [
                        u.txid,
                        u.vout,
                        u.value,
                        u.height ?? '',
                        String(u.spendable),
                      ]),
                    ]
                  : [
                      [
                        'txid',
                        'height',
                        'time_utc',
                        'received_atoms',
                        'sent_atoms',
                        'net_atoms',
                        'confirmations',
                      ],
                      ...a.history.map((h: any) => [
                        h.txid,
                        h.height ?? '',
                        h.time == null
                          ? ''
                          : new Date(Number(h.time) * 1000).toISOString(),
                        h.received,
                        h.sent,
                        h.net,
                        h.confirmations,
                      ]),
                    ]
              }
            />
          </div>
          {utxos ? (
            a.utxos.length ? (
              <div className="table-wrap">
                <table className="data-table utxo-table">
                  <thead>
                    <tr>
                      <th>Source output</th>
                      <th className="numeric">Amount (RQT)</th>
                      <th>Block</th>
                      <th>Availability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outputRows.map((u: any) => (
                      <tr key={u.txid + ':' + u.vout}>
                        <td>
                          <Link
                            prefetch={false}
                            className="hash"
                            href={'/tx/' + u.txid + '#output-' + u.vout}
                          >
                            {short(u.txid, 8)}:{u.vout}
                          </Link>
                        </td>
                        <td className="numeric">{amount(u.value)}</td>
                        <td>
                          {u.height === null ? (
                            'Pending'
                          ) : (
                            <Link prefetch={false} href={'/block/' + u.height}>
                              {u.height}
                            </Link>
                          )}
                        </td>
                        <td>
                          {u.spendable ? (
                            <span className="state completed">Spendable</span>
                          ) : (
                            <span className="state planned">
                              {Math.max(
                                0,
                                100 - (a.tipHeight + 1 - Number(u.height))
                              )}{' '}
                              blocks to maturity
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                No unspent outputs on the observed node.
              </div>
            )
          ) : (
            <>
              <Filters path={path} query={query} address />
              <TransactionRows transactions={a.history} address />
              {!a.coverage.complete && (
                <p className="notice">
                  Recent history is supplied by the node (up to 100 records).
                  Mining and transfer filters use the indexed portion until
                  backfill completes.
                </p>
              )}
            </>
          )}
        </section>
        {utxos && (
          <div className="actions">
            <Link
              prefetch={false}
              className="button"
              href={path + '?view=utxos'}
            >
              Newest outputs
            </Link>
            {outputOffset > 0 && (
              <Link
                prefetch={false}
                className="button"
                href={
                  path + '?view=utxos&outputs=' + Math.max(0, outputOffset - 50)
                }
              >
                Previous outputs
              </Link>
            )}
            {outputOffset + 50 < a.utxos.length && (
              <Link
                prefetch={false}
                className="button primary"
                href={path + '?view=utxos&outputs=' + (outputOffset + 50)}
              >
                More outputs →
              </Link>
            )}
            <span className="muted">
              {outputOffset + 1}–{Math.min(outputOffset + 50, a.utxos.length)}{' '}
              of {a.utxos.length}
            </span>
          </div>
        )}
        {!utxos && <Pagination path={path} query={query} next={a.next} />}
      </main>
      <Footer />
    </>
  );
}
