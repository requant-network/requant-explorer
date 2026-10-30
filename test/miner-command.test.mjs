import test from 'node:test';
import assert from 'node:assert/strict';
import { minerCommand } from '../src/miner-command.mjs';

test('miner commands use the public domain and platform executable', () => {
  const input = {
    endpoint: 'pool.requant.network:19340',
    payee: 'AB'.repeat(32),
    worker: 'rig_50-hx',
  };
  assert.equal(
    minerCommand({ ...input, platform: 'linux' }).command,
    `./cppminer --algo tnet --rpc pool.requant.network:19340 --payee ${'ab'.repeat(32)} --worker rig_50-hx`
  );
  assert.ok(
    minerCommand({ ...input, platform: 'windows' }).command.startsWith(
      '.\\cppminer.exe '
    )
  );
  assert.ok(
    minerCommand({ endpoint: input.endpoint }).command.includes('YOUR_KEY_HASH')
  );
  assert.equal(minerCommand({ endpoint: input.endpoint }).valid, false);
  assert.equal(
    minerCommand({ ...input, platform: 'linux', backend: 'opencl' }).command,
    `./cppminer --algo tnet --backend opencl --rpc pool.requant.network:19340 --payee ${'ab'.repeat(32)} --worker rig_50-hx`
  );
});

test('invalid addresses and shell syntax cannot enter a copied command', () => {
  for (const worker of [
    'rig; shutdown',
    '$(whoami)',
    'rig\n--payee other',
    'rig&echo',
  ]) {
    const result = minerCommand({
      endpoint: 'pool.requant.network:19340',
      payee: 'trq1address',
      worker,
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors.payee);
    assert.ok(result.errors.worker);
    assert.ok(result.command.endsWith('--worker rig1'));
  }
  assert.throws(() =>
    minerCommand({ endpoint: 'pool.test:19340; echo secret' })
  );
  assert.throws(() =>
    minerCommand({
      endpoint: 'pool.test:19340',
      backend: 'opencl; echo secret',
    })
  );
});
