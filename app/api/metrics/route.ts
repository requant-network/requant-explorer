import { overview } from '../../../src/chain.mjs';
export async function GET() {
  const data = await overview();
  return Response.json(
    {
      status: data.status,
      observedAt: data.observedAt,
      unit: 'tickets/s',
      rateWindowBlocks: data.rateWindow || 0,
      series: data.series,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
