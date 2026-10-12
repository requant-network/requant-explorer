# Requant explorer

Private English-language testnet explorer, served at `/explorer` on requant.network. It shares the approved ivory, graphite and orange identity with requant-web.

Use Node.js 24 or newer. Run `npm ci`, `npm run check`, `npm test`, then `npm run dev`. Copy `.env.example` to `.env.local` and configure RPC_URL and RPC_TOKEN. Open http://127.0.0.1:3311/explorer. Without a configured or reachable node, the interface displays unavailable data. It does not fabricate a live network.

## Read-only adapter

The server accepts only getinfo, getblock, gettx, history and utxos. Public endpoints are fixed GET routes under `/explorer/api`; arbitrary JSON-RPC and mutation methods are never exposed. RPC is bounded by response size, concurrency and request timeout. Tokens stay on the server.

The node's JSON integers are parsed losslessly. Atom values remain decimal strings through API transport and persistence; display uses BigInt and eight decimal places. Addresses use testnet bech32m version 0 and a 32-byte key hash. Tests include the published development-fund address vector and the largest unsigned 64-bit amount.

The index advances in batches, checks the canonical branch and retains known orphan blocks. Hash lookup becomes available when indexing catches up. Blocks remain directly accessible by height. Recent blocks and transactions are fetched from the live node; coherent overview and block-list snapshots verify the tip after reading. Failures retain the last successful snapshot with an explicit stale label.

Network rate sums expected ticket work `floor(2^256/(target+1))` over a window of up to 120 block intervals and divides by elapsed block time. It is an estimate in tickets/s. Peer counts refer to the observed node. A collector runs every 30 seconds and keeps 24 hours of measurements; the chart begins at deployment and needs two samples. Reorgs discard affected measurements.

## Mining pool

`/explorer/pool` shows the testnet mining pool: pool and network rate, found blocks, round effort, miners with their devices, balances and payouts; `/explorer/pool/miner/<address>` shows one miner. The data comes from the pool node's public JSON-RPC (`POOL_RPC_URL`), limited to its read-only `poolstats` and `minerstats` methods, with the same size and time bounds as the node adapter. The overview is cached for 15 seconds and a failed refresh keeps the last snapshot with a stale label. Atom values stay exact decimal strings; pool and network rates are estimates from shares and block targets, so their ratio can exceed 100% and is shown capped. `POOL_ENDPOINT` is the host and port miners connect to (default: the host of `POOL_RPC_URL`). Design screenshots are in `design/pool-2026-10-10`.

## Initial scope

Search: block height, indexed block hash, transaction ID and testnet address. Details include block links, confirmations, work-claim fields, transaction inputs and outputs, UTXO balance categories and address history. Block lists support height-based pagination. Address history is limited to the newest 100 records because the reference node has no cursor API. Block transaction summaries display the first 40 transactions and list remaining IDs. Unknown orphan transaction bodies cannot be retrieved through the node's current active-chain RPC.

The source contract is pinned in `contracts/node-capabilities.json`. Testnet epoch length is 1440 blocks; the 272-byte claim excludes the 116-byte header and transaction data.

## Production

The requant-web repository owns the shared Docker Compose and Caddy configuration. This application listens on internal port 3311 and has a persistent SQLite volume. The reference node is pinned to commit `aad4772` and uses an RPC token. RPC is published only on server loopback for SSH diagnostics; the application ports are not published.

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE). IBM Plex Sans is under the SIL Open Font License 1.1.
