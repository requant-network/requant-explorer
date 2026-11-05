import { metrics } from '../../../src/chain.mjs';
import { readResponse } from '../../../src/api.mjs';
export async function GET(request: Request) {
  return readResponse(() =>
    metrics(new URL(request.url).searchParams.get('period') || '24h')
  );
}
