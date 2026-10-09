import { overview } from '../src/chain.mjs';
import { Header, Footer } from '../src/ui';
import Overview from './overview';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const data = await overview();
  return (
    <>
      <Header />
      <Overview initial={data} />
      <Footer />
    </>
  );
}
