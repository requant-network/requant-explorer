import Link from 'next/link';
import { amount, short } from './format.mjs';
import { Time, TimePreference, Copy, FilterForm } from './workspace';

export function WorkspaceNav() {
  return (
    <nav className="workspace-nav" aria-label="Explorer sections">
      <div>
        <Link prefetch={false} href="/">
          Overview
        </Link>
        <Link prefetch={false} href="/blocks">
          Blocks
        </Link>
        <Link prefetch={false} href="/transactions">
          Transactions
        </Link>
        <Link prefetch={false} href="/transactions?kind=pending">
          Mempool
        </Link>
        <Link prefetch={false} href="/pool">
          Pool
        </Link>
      </div>
      <TimePreference />
    </nav>
  );
}
export function FullHash({
  value,
  label = 'Copy identifier',
}: {
  value: string;
  label?: string;
}) {
  return (
    <div className="identifier">
      <code>{value}</code>
      <Copy value={value} label={label} />
    </div>
  );
}
export function IndexNotice({ coverage }: { coverage: any }) {
  if (!coverage || coverage.complete) return null;
  return (
    <div className="notice" role="status">
      History index: {coverage.indexedBlocks.toLocaleString('en-US')} /{' '}
      {coverage.totalBlocks.toLocaleString('en-US')} blocks. Older records and
      spending links may be incomplete while indexing. Balances come directly
      from the node.
    </div>
  );
}
export function queryLink(path: string, query: any, changes: any) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, ...changes }))
    if (typeof value === 'string' && value) params.set(key, value);
  return path + (params.size ? '?' + params.toString() : '');
}
export function Filters({
  path,
  query = {},
  address = false,
}: {
  path: string;
  query?: any;
  address?: boolean;
}) {
  return (
    <FilterForm
      key={JSON.stringify([query.kind, query.from, query.to])}
      path={path}
      query={query}
      address={address}
    />
  );
}
export function Pagination({
  path,
  query,
  next,
  after,
}: {
  path: string;
  query: any;
  next?: string | null;
  after?: string | null;
}) {
  return (
    <div className="actions">
      <Link
        prefetch={false}
        className="button"
        href={queryLink(path, query, { before: null, after: null })}
      >
        Newest
      </Link>
      {(next || after) && (
        <Link
          prefetch={false}
          className="button primary"
          href={queryLink(path, query, { before: next, after })}
        >
          Older records →
        </Link>
      )}
    </div>
  );
}
export function TransactionRows({
  transactions,
  address = false,
}: {
  transactions: any[];
  address?: boolean;
}) {
  if (!transactions.length)
    return (
      <div className="empty-state">No transactions match these filters.</div>
    );
  return (
    <div className="table-wrap">
      <table
        className={
          address
            ? 'data-table address-history-table'
            : 'data-table transaction-history-table'
        }
      >
        <thead>
          <tr>
            <th>Transaction / time</th>
            <th>Type</th>
            {address ? (
              <>
                <th className="numeric">Received</th>
                <th className="numeric">Spent</th>
                <th className="numeric">Net change</th>
              </>
            ) : (
              <>
                <th className="numeric">Output total</th>
                <th className="numeric">Fee</th>
              </>
            )}
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.txid}>
              <td>
                <Link prefetch={false} className="hash" href={'/tx/' + tx.txid}>
                  {short(tx.txid, 8)}
                </Link>
                <small>
                  <Time seconds={tx.time == null ? null : Number(tx.time)} />
                </small>
              </td>
              <td>
                {tx.coinbase === null
                  ? '—'
                  : tx.coinbase
                    ? 'Mining reward'
                    : 'Transfer'}
              </td>
              {address ? (
                <>
                  <td className="numeric">{amount(tx.received)}</td>
                  <td className="numeric">{amount(tx.sent)}</td>
                  <td
                    className={
                      'numeric ' +
                      (BigInt(tx.net) < BigInt(0) ? 'negative' : 'positive')
                    }
                  >
                    {BigInt(tx.net) > BigInt(0) ? '+' : ''}
                    {amount(tx.net)}
                  </td>
                </>
              ) : (
                <>
                  <td className="numeric">
                    {amount(
                      tx.totalAtoms ??
                        tx.outputs
                          ?.reduce(
                            (s: bigint, o: any) => s + BigInt(o.value),
                            BigInt(0)
                          )
                          .toString()
                    )}{' '}
                    RQT
                  </td>
                  <td className="numeric">{amount(tx.fee)} RQT</td>
                </>
              )}
              <td>
                {tx.height === null ? (
                  <span className="state planned">Pending</span>
                ) : (
                  <>
                    <Link prefetch={false} href={'/block/' + tx.height}>
                      {Number(tx.height).toLocaleString('en-US')}
                    </Link>
                    <small>{tx.confirmations} confirmations</small>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
