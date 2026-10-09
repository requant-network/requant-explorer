import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const text = await readFile(
  new URL('../contracts/node-capabilities.json', import.meta.url),
  'utf8'
);
assert(
  !/[\u0400-\u04ff]/u.test(text),
  'Public explorer contract must be English'
);
const contract = JSON.parse(text);
assert.equal(contract.publicLocale, 'en');
assert.equal(contract.network, 'test');
assert.equal(contract.addressPrefix, 'trq1');
assert.equal(contract.rpcExposure, 'server-only');
assert.equal(contract.amountEncoding, 'decimal-string-of-integer-atoms');
assert.equal(contract.rateUnit, 'tickets/s');
for (const method of contract.allowedNodeMethods) {
  assert(
    ['getinfo', 'getblock', 'gettx', 'history', 'utxos'].includes(method),
    `Unexpected RPC capability: ${method}`
  );
  assert(
    !contract.forbiddenPublicMethods.includes(method),
    `Forbidden RPC capability: ${method}`
  );
}
for (const endpoint of contract.endpoints) assert.equal(endpoint.method, 'GET');
console.log(
  `Validated ${contract.endpoints.length} implemented read-only endpoints and testnet conventions.`
);
