import { pool } from '../../../src/pool.mjs';
import { readResponse } from '../../../src/api.mjs';
export async function GET() {
  return readResponse(pool);
}
