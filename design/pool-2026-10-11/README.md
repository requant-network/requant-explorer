# Mining pool: connection first

Retain Requant Signal: IBM Plex Sans, ivory, graphite and orange, 6 px corners. Put the pool endpoint, setup and miner lookup before the chart. Keep four real summary metrics and show when data was observed. Use three activity tabs to avoid a long stack of tables. Tables scroll within their panel on small screens.

The setup panel builds a one-line command for Windows or Linux from a public payout key hash and a worker name. Validate both before copying; never request a secret key or execute the command. Keep the selected platform and inputs during statistics refreshes. Show clipboard success and a manual-copy fallback.

Direct mining endpoint: `pool.requant.network:19340`. DNS must point directly to the existing pool server, without an HTTP CDN proxy. Existing pool state, payout balances and mining processes stay on the same node. Local loopback and bind addresses in operator examples remain local configuration.

Verification: read-only pool RPC through the domain, command validation, tabs and keyboard controls, miner lookup, refresh, stale/empty states, desktop and mobile screenshots, contract checks, tests and production builds. No test mining shares or transactions are submitted.

## Published and verified — 11 October 2026

- `/explorer/pool` and the site's mining, node, API and faucet instructions use public domains. The adapter's private upstream remains separate from the public miner endpoint.
- The explorer and website passed their checks, production builds and 24 tests in total. Isolated containers rendered the candidate pages before publication; they were then removed.
- Chrome checks covered Linux/Windows command generation, clipboard success, invalid payout key hashes, miner lookup, keyboard navigation between activity tabs, manual refresh and automatic refresh. Inputs, selected platform and activity tab survived refresh. The console reported no errors or warnings.
- Desktop 1440 px and mobile 390/320 px views had no page overflow. The graph sorts samples by timestamp, uses elapsed time for horizontal spacing, and labels both dates across midnight.
- The existing CMP 50HX service on the home server was changed to `pool.requant.network:19340`, with its payout hash and `home-cmp` worker preserved. At 12:15 UTC the restarted process reported 140 shares, 8 accepted blocks, no rejects and about 3.6M tickets/s. This is a short operational check, not a benchmark or performance guarantee.
- Source and image backups: `/opt/requant/deploy/backups/pool-domain-20261011`, `requant-web:before-pool-20261011`, `requant-explorer:before-pool-20261011`. The miner unit backup is `/etc/systemd/system/requant-miner.service.before-domain-20261011` on the home server.

Screenshots: [desktop](pool-desktop.png), [mobile](pool-mobile.png), [connection on a narrow screen](pool-setup-mobile.png), [chart on a narrow screen](pool-chart-mobile.png), [miner](miner-desktop.png).
