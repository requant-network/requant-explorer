import { getBlock } from '../../../../src/chain.mjs';
import { readResponse } from '../../../../src/api.mjs';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  return readResponse(async () =>
    getBlock(
      (await params).key,
      Number(new URL(request.url).searchParams.get('offset') || 0)
    )
  );
}
