import { pool, poolBlockPage } from '../../../../src/pool.mjs';
import { readResponse } from '../../../../src/api.mjs';
export async function GET(request: Request) {
  return readResponse(async () =>
    poolBlockPage(
      Object.fromEntries(new URL(request.url).searchParams),
      await pool()
    )
  );
}
