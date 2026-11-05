# Explorer workspace

Keep Requant's ivory, graphite and orange identity and IBM Plex Sans. Use compact
tables with right-aligned exact amounts and secondary technical details. The
workspace navigation is Overview / Blocks / Transactions / Pool. On mobile keep
the identity, status and amount visible; let large tables scroll inside their panel.

Overview: search, health and last-block age; height, ticket rate, average interval,
pending count and epoch progress; interactive activity chart; recent records.
New records wait behind an explicit update button so reading positions stay stable.

Address: full address with copy and QR, balance categories, paginated history with
received/sent/net and time, and a separate UTXO tab. Transaction: status, time,
confirmations, fee density, linked inputs/outputs and expandable raw data. Block:
miner and reward, interval, size, transaction pagination and expandable TNet data.

The read-only SQLite index adds transaction bodies, per-address movements and
spending links. Only complete canonical blocks enter history; reorgs exclude the
old branch. Until backfill completes, clearly state coverage. Persist 30 days of
measurements; never fabricate a past series. Public copy remains English.

Verification: exact amounts, pagination without skips, reorg rollback, partial
index coverage, stale node, filters, copy/QR, live updates, desktop and mobile.
