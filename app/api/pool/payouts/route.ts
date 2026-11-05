import { pool, poolMiner, poolPayouts } from '../../../../src/pool.mjs';
import { readResponse } from '../../../../src/api.mjs';
export async function GET(request: Request) {
  return readResponse(async () => {
    const query = Object.fromEntries(new URL(request.url).searchParams);
    await pool();
    const miner = query.address ? await poolMiner(query.address) : null;
    return poolPayouts(miner?.address || 'pool', query);
  });
}
