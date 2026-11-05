import { getTransactions } from '../../src/chain.mjs';
import { Header, Footer, Search, Failure } from '../../src/ui';
import {
  WorkspaceNav,
  IndexNotice,
  Filters,
  Pagination,
  TransactionRows,
} from '../../src/records';
import { Refresh, ExportCsv } from '../../src/workspace';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Transactions' };
export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<any>;
}) {
  const query = await searchParams;
  let data;
  try {
    data = await getTransactions(query);
  } catch (error) {
    return <Failure error={error} />;
  }
  return (
    <>
      <Header />
      <main className="explorer-page workspace-page">
        <WorkspaceNav />
        <div className="eyebrow">Requant testnet / Transactions</div>
        <h1>
          {query.kind === 'pending' ? 'Pending transactions' : 'Transactions'}
        </h1>
        <Search />
        <Refresh observedAt={data.observedAt} automatic={false} />
        <IndexNotice coverage={data.coverage} />
        {query.kind === 'pending' && (
          <p className="notice">
            Transactions currently observed in this node’s mempool. Arrival
            times are not recorded. Transactions may be replaced, removed or
            confirmed between pages. Total observed: {data.pendingTotal}.
          </p>
        )}
        <section className="records-panel">
          <div className="panel-heading">
            <h2>
              {query.kind === 'pending' ? 'Awaiting blocks' : 'Chain history'}
            </h2>
            <ExportCsv
              filename="requant-transactions.csv"
              rows={[
                ['txid', 'height', 'time_utc', 'output_atoms', 'fee_atoms'],
                ...data.entries.map((tx: any) => [
                  tx.txid,
                  tx.height ?? '',
                  tx.time == null ? '' : new Date(tx.time * 1000).toISOString(),
                  tx.totalAtoms,
                  tx.fee,
                ]),
              ]}
            />
          </div>
          <Filters path="/transactions" query={query} />
          <TransactionRows transactions={data.entries} />
        </section>
        <Pagination
          path="/transactions"
          query={query}
          next={data.next}
          after={data.nextAfter}
        />
      </main>
      <Footer />
    </>
  );
}
