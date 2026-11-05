import { parsePayee } from './format.mjs';
export function minerCommand({
  endpoint,
  platform,
  backend = 'cuda',
  payee = '',
  worker = '',
}) {
  if (!/^[a-z0-9.-]+:[0-9]{1,5}$/i.test(endpoint))
    throw new Error('Invalid pool endpoint configuration.');
  if (backend !== 'cuda' && backend !== 'opencl')
    throw new Error('Invalid mining backend.');
  const key = payee.trim();
  const name = worker.trim();
  const errors = {};
  let parsed;
  if (key) {
    try {
      parsed = parsePayee(key);
    } catch {
      errors.payee =
        'Use a valid trq1 testnet address or 64-character public key hash.';
    }
  }
  if (name && !/^[a-z0-9_.-]{1,32}$/i.test(name))
    errors.worker =
      'Use up to 32 letters, numbers, dots, underscores or hyphens.';
  const executable = platform === 'linux' ? './cppminer' : '.\\cppminer.exe';
  return {
    command: `${executable} --algo tnet${backend === 'opencl' ? ' --backend opencl' : ''} --rpc ${endpoint} --payee ${parsed ? parsed.owner : 'YOUR_KEY_HASH'} --worker ${name && !errors.worker ? name : 'rig1'}`,
    errors,
    valid: Boolean(parsed) && Object.keys(errors).length === 0,
    address: parsed?.address || '',
    keyHash: parsed?.owner || '',
  };
}
