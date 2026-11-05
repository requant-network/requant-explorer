import { RpcError } from './rpc.mjs';
export function publicError(error) {
  return error instanceof RpcError
    ? error.message
    : 'The explorer could not complete this request.';
}

export async function readResponse(operation) {
  try {
    return Response.json(await operation(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return Response.json(
      // the explorer's own texts only: SQLite and runtime errors can carry internals
      {
        error: publicError(error),
      },
      {
        status:
          error.kind === 'not-found'
            ? 404
            : error.kind === 'invalid'
              ? 400
              : error.kind === 'index-pending'
                ? 409
                : 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}
