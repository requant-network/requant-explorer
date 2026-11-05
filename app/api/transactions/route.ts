import { getTransactions } from '../../../src/chain.mjs';
import { readResponse } from '../../../src/api.mjs';
export async function GET(request: Request) {
  return readResponse(() =>
    getTransactions(Object.fromEntries(new URL(request.url).searchParams))
  );
}
