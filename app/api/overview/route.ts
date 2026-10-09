import { overview } from '../../../src/chain.mjs';
export const dynamic = 'force-dynamic';
export async function GET() {
  return Response.json(await overview(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
