import { redirect } from 'next/navigation';
import { search } from '../../src/chain.mjs';
import { Failure } from '../../src/ui';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Search' };
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  let target;
  try {
    target = await search((await searchParams).q || '');
  } catch (error) {
    return <Failure error={error} />;
  }
  redirect(target);
}
