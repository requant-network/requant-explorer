import { Failure } from '../src/ui';
export default function NotFound() {
  return (
    <Failure
      error={{
        kind: 'not-found',
        message: 'The requested page does not exist.',
      }}
    />
  );
}
