import { blockList } from '../../../src/chain.mjs';
import { readResponse } from '../../../src/api.mjs';
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  return readResponse(() =>
    blockList(
      query.get('before'),
      query.has('limit') ? Number(query.get('limit')) : 20
    )
  );
}
