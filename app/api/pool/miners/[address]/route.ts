import { poolMiner } from '../../../../../src/pool.mjs';
import { readResponse } from '../../../../../src/api.mjs';
export async function GET(
  _: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  return readResponse(async () => poolMiner((await params).address));
}
