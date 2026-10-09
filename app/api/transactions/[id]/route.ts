import { getTransaction } from '../../../../src/chain.mjs';
import { readResponse } from '../../../../src/api.mjs';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return readResponse(async () => getTransaction((await params).id));
}
