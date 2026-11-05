import { Failure } from '../src/ui';
import { RpcError } from '../src/rpc.mjs';
export default function NotFound() {
  return (
    <Failure
      error={new RpcError('The requested page does not exist.', 'not-found')}
    />
  );
}
