export function minerCommand({ endpoint, platform, payee = '', worker = '' }) {
  if (!/^[a-z0-9.-]+:[0-9]{1,5}$/i.test(endpoint))
    throw new Error('Invalid pool endpoint configuration.');
  const key = payee.trim();
  const name = worker.trim();
  const errors = {};
  if (key && !/^[0-9a-f]{64}$/i.test(key))
    errors.payee =
      'Use the 64-character key hash shown in your wallet, not the trq1 address.';
  if (name && !/^[a-z0-9_-]{1,32}$/i.test(name))
    errors.worker = 'Use up to 32 letters, numbers, underscores or hyphens.';
  const executable = platform === 'linux' ? './cppminer' : '.\\cppminer.exe';
  return {
    command: `${executable} --algo tnet --rpc ${endpoint} --payee ${key && !errors.payee ? key.toLowerCase() : 'YOUR_KEY_HASH'} --worker ${name && !errors.worker ? name : 'rig1'}`,
    errors,
    valid: Object.keys(errors).length === 0,
  };
}
