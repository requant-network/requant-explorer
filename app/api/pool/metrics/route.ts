import { poolMetrics } from '../../../../src/pool.mjs';
import { readResponse } from '../../../../src/api.mjs';
export async function GET(request: Request) {
  return readResponse(() =>
    poolMetrics(Object.fromEntries(new URL(request.url).searchParams))
  );
}
