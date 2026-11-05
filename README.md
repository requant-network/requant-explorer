# Requant explorer

Private English-language testnet explorer, served at `/explorer` on requant.network. It shares the approved ivory, graphite and orange identity with requant-web.

Use Node.js 24 or newer. Run `npm ci`, `npm run check`, `npm test`, then `npm run dev`. Copy `.env.example` to `.env.local` and configure RPC_URL and RPC_TOKEN. Open http://127.0.0.1:3311/explorer. Without a configured or reachable node, the interface displays unavailable data. It does not fabricate a live network.

## Read-only adapter

The server accepts only getinfo, getblock, gettx, history, utxos and getrawmempool. Public endpoints are fixed GET routes under `/explorer/api`; arbitrary JSON-RPC and mutation methods are never exposed. RPC is bounded by response size, concurrency and request timeout. Tokens stay on the server.

The node's JSON integers are parsed losslessly. Atom values remain decimal strings through API transport and persistence; display uses BigInt and eight decimal places. Addresses use testnet bech32m version 0 and a 32-byte key hash. Tests include the published development-fund address vector and the largest unsigned 64-bit amount.

The index advances in batches, checks the canonical branch and retains known orphan blocks. Hash lookup becomes available when indexing catches up. Blocks remain directly accessible by height. Recent cached blocks are reused only after checking canonical membership against the live node. Coherent overview and block-list snapshots verify the tip after reading. Instrumentation and route bundles share one in-flight snapshot and backfill job; data links do not prefetch node-heavy pages. Failures retain the last successful snapshot with an explicit stale label.

Network rate sums expected ticket work `floor(2^256/(target+1))` over a window of up to 120 block intervals and divides by elapsed block time. It is an estimate in tickets/s. Peer counts refer to the observed node. A collector runs every 30 seconds and keeps 30 days of measurements; the chart begins at deployment and needs two samples. Reorgs discard affected measurements.

## Mining pool

`/explorer/pool` is the daily pool overview; `/explorer/pool/miner` looks up a miner and `/explorer/pool/miner/<address>` shows devices, reward stages and payout history. `/explorer/pool/connect` builds a Windows/Linux CUDA/OpenCL command from a public `trq1` address or key hash. The generated command contains the decoded public key hash; private keys and recovery phrases must never be supplied. Public miner addresses can be remembered in browser storage and removed by the user.

Pool data comes from `POOL_RPC_URL`, restricted to read-only `poolstats` and `minerstats`, with bounded response size and concurrency. `POOL_ENDPOINT` is the separate public mining endpoint, defaulting to `pool.requant.network:19340`. Overview and miner snapshots share one cache across Next bundles, deduplicate in-flight requests, retain the last successful observation during outages and cap the in-memory cache at 64 entries. Unknown miners do not enter persistent storage. Both overview and miner pages offer optional 30-second refresh and UTC/local time.

The collector stores pool samples, per-miner observations, recent pool blocks and payout records in `DATA_DIR/pool.sqlite`. It runs every 30 seconds and queries at most two miner histories per pass. Pool samples include the node's retained 24-hour history; visiting a known miner also imports its retained history and up to 100 payouts. Charts offer 1h/6h/24h/7d/30d with at most 240 buckets and 30-day sample retention. Zero rate is preserved; missing intervals stay gaps. Share-based estimates use a 10-minute window; the separately selected hourly block-work estimate is historical and covers the last 24 hours. Recorded averages cover available samples, not an assumed complete time range.

The collected archive seeds at most 50 pool blocks/payouts and 100 payouts per miner from the upstream RPC. It retains newly observed records across restarts and pages them in groups of 20, with status/UTC-date filters and same-time-safe cursors. It cannot reconstruct older omitted payouts or guarantee coverage if the upstream window rolls over during an outage. Payout status is explicitly the last reported observation; transaction links show current chain confirmations. Pool block maturity/orphan state is reconciled with the canonical explorer index when chain observations are fresh. Sent totals include pending payouts and are never labelled received or confirmed totals. Atom values and CSV amounts remain exact decimal strings.

Device activity means accepted shares within the reporting window, not a direct GPU connection. The pool drops device counters after an hour without shares; session counters may reset. Temperature and power telemetry are unavailable. The UI explains stalled blocks, maturity, payout thresholds and confirmation separately and does not promise an exact payment time. All public pool endpoints are fixed GET routes under `/explorer/api/pool`; no mining or payment mutation method is exposed.

Before deployment, preserve both `explorer.sqlite` and `pool.sqlite` using SQLite online backups, along with the previous image. Designs and verification notes for the pool workspace are in `design/pool-2026-11-05`.

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
