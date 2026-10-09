import { getAddress } from '../../../../src/chain.mjs';
import { readResponse } from '../../../../src/api.mjs';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  return readResponse(async () => getAddress((await params).address));
}
