export async function readResponse(operation) {
  try {
    return Response.json(await operation(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return Response.json(
      { error: error.message },
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
