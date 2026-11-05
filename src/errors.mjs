export class RpcError extends Error {
  constructor(message, kind = 'unavailable') {
    super(message);
    this.kind = kind;
  }
}
export function publicError(error) {
  return error instanceof RpcError
    ? error.message
    : 'The explorer could not complete this request.';
}
