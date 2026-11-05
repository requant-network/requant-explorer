import { getAddress } from '../../../../src/chain.mjs';
import { readResponse } from '../../../../src/api.mjs';
export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  return readResponse(async () =>
    getAddress(
      (await params).address,
      Object.fromEntries(new URL(request.url).searchParams)
    )
  );
}
