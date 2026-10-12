# Requant explorer

- This repository owns the public explorer and a constrained read-only data adapter.
- All public UI, errors, metadata and accessibility text must be English. No Russian geographic branding or Russian UI.
- Follow the approved original Requant design; do not reuse MagnetGate assets.
- The initial public network is testnet. Display network identity and data freshness clearly. Mock data must say Demo data and never enter the live data source.
- Protect the node RPC token on the server. Do not expose arbitrary JSON-RPC or mutation methods.
- Express amounts as integer atoms in API transport and persistence; convert to RQT for display without floating-point loss.
- Estimated network rate uses tickets/s and a stated block window. Peer counts belong to the observed node, not the entire network.
- Account for reorgs, orphaned blocks, unconfirmed transactions, stale data and epoch boundaries.
- Treat contracts/node-capabilities.json as a draft adapter plan, not a claim that all endpoints already exist.
- Use CodeGraph for structural exploration. Keep indexes and credentials outside Git.
- Run npm run check before committing contract changes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
