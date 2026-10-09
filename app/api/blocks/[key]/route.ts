import { getBlock } from '../../../../src/chain.mjs';
import { readResponse } from '../../../../src/api.mjs';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  return readResponse(async () => getBlock((await params).key));
}
