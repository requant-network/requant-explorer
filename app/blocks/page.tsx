import Link from 'next/link';
import { blockList } from '../../src/chain.mjs';
import { Header, Footer, Search, Blocks, Failure } from '../../src/ui';
import { WorkspaceNav } from '../../src/records';
import { Refresh } from '../../src/workspace';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Blocks' };
export default async function BlockList({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  let data;
  try {
    data = await blockList((await searchParams).before ?? null);
  } catch (error) {
    return <Failure error={error} />;
  }
  return (
    <>
      <Header />
      <main className="explorer-page">
        <WorkspaceNav />
        <div className="eyebrow">Requant testnet / Active chain</div>
        <h1>Blocks.</h1>
        <Search />
        <Refresh observedAt={data.observedAt} automatic={false} />
        <section className="records-panel">
          <Blocks blocks={data.blocks} />
        </section>
        <div className="actions">
          <Link prefetch={false} className="button" href="/blocks">
            Latest blocks
          </Link>
          {data.nextHeight !== null && (
            <Link
              prefetch={false}
              className="button primary"
              href={'/blocks?before=' + data.nextHeight}
            >
              Older blocks →
            </Link>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
