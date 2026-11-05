# Requant explorer

Private English-language testnet explorer, served at `/explorer` on requant.network. It shares the approved ivory, graphite and orange identity with requant-web.

Use Node.js 24 or newer. Run `npm ci`, `npm run check`, `npm test`, then `npm run dev`. Copy `.env.example` to `.env.local` and configure RPC_URL and RPC_TOKEN. Open http://127.0.0.1:3311/explorer. Without a configured or reachable node, the interface displays unavailable data. It does not fabricate a live network.

## Read-only adapter

The server accepts only getinfo, getblock, gettx, history, utxos and getrawmempool. Public endpoints are fixed GET routes under `/explorer/api`; arbitrary JSON-RPC and mutation methods are never exposed. RPC is bounded by response size, concurrency and request timeout. Tokens stay on the server.

The node's JSON integers are parsed losslessly. Atom values remain decimal strings through API transport and persistence; display uses BigInt and eight decimal places. Addresses use testnet bech32m version 0 and a 32-byte key hash. Tests include the published development-fund address vector and the largest unsigned 64-bit amount.

The index advances in batches, checks the canonical branch and retains known orphan blocks. Hash lookup becomes available when indexing catches up. Blocks remain directly accessible by height. Recent cached blocks are reused only after checking canonical membership against the live node. Coherent overview and block-list snapshots verify the tip after reading. Instrumentation and route bundles share one in-flight snapshot and backfill job; data links do not prefetch node-heavy pages. Failures retain the last successful snapshot with an explicit stale label.

Network rate sums expected ticket work `floor(2^256/(target+1))` over a window of up to 120 block intervals and divides by elapsed block time. It is an estimate in tickets/s. Peer counts refer to the observed node. A collector runs every 30 seconds and keeps 30 days of measurements; the chart begins at deployment and needs two samples. Reorgs discard affected measurements.

## Mining pool

`/explorer/pool` shows the testnet mining pool: pool and network rate, found blocks, round effort, miners with their devices, balances and payouts; `/explorer/pool/miner/<address>` shows one miner. The data comes from the pool node's public JSON-RPC (`POOL_RPC_URL`), limited to its read-only `poolstats` and `minerstats` methods, with the same size and time bounds as the node adapter. The overview is cached for 15 seconds and a failed refresh keeps the last snapshot with a stale label. Atom values stay exact decimal strings; pool and network rates are estimates from shares and block targets, so their ratio can exceed 100% and is shown capped. `POOL_ENDPOINT` is the host and port miners connect to (default: the host of `POOL_RPC_URL`). Design screenshots are in `design/pool-2026-10-10`.

## Initial scope

Search supports block height, indexed block hash, transaction ID and testnet address. The workspace adds a transaction list and live mempool view, type and UTC-date filters, shareable cursors, exact CSV exports of the visible page, copy controls and a locally generated address QR. UTC/local time is a browser preference. Detail pages have optional live refresh; new overview records wait behind an explicit update button.

Transaction bodies, address movements and spending links are indexed in SQLite in canonical blocks. The background job uses one RPC at a time for transaction backfill, at most 64 transactions per pass. Before the index catches up, addresses retain the node's newest 100 history records and show coverage. Once complete, address history pages have 50 records and branch-checked cursors. Partial blocks never enter indexed history. Known orphan data stays stored but is excluded by canonical membership. A cursor whose block was reorganised is rejected with a restart message.

Block transaction details paginate in groups of 40. Miner and development-fund outputs, full-block indexed fees, parent interval and TNet header details are shown separately. Inputs link to source outputs; indexed spending transactions link back from outputs. Mining maturity uses testnet's 100-block height difference. UTXOs paginate in groups of 50. Public JSON endpoints remain GET-only with a fixed server-side RPC allowlist.

Charts offer 1h/24h/7d/30d periods with bounded buckets for rate, average block interval, transfer counts and exact daily fees. Fee and activity coverage follows the canonical index. Collected rate history cannot be reconstructed before collection began. Unknown orphan transaction bodies remain unavailable through active-chain RPC.

The source contract is pinned in `contracts/node-capabilities.json`. Testnet epoch length is 1440 blocks; the 272-byte claim excludes the 116-byte header and transaction data.

## Production

The requant-web repository owns the shared Docker Compose and Caddy configuration. This application listens on internal port 3311 and has a persistent SQLite volume. The reference node is pinned to commit `aad4772` and uses an RPC token. RPC is published only on server loopback for SSH diagnostics; the application ports are not published.

## Explorer update verification

Run npm run check, npm test and npm run build. Index tests cover histories over 100 entries, multiple pages within one block, 64-bit amounts, partial blocks, spending links, reorg rollback, replaced cursors and shared snapshots across bundles. UI verification uses the real testnet node through a read-only SSH bridge and an online-backup copy of the explorer database. Before a deployment, keep the previous application image and take a SQLite online backup; do not copy only a live .sqlite file without its WAL. Schema additions preserve existing blocks and measurements.
