# Pool workspace

Daily monitoring leads the interface: Pool overview, My miner, Connect a GPU. The design keeps the approved Signal palette, IBM Plex Sans, six-pixel corners and restrained orange accents.

- Overview: compact public address lookup, live pool summary, interactive history, searchable/sortable miners and paginated block/payout views.
- Miner: remembered public address, exact reward stages, device activity/rejection filters, optional refresh, history and payout filters/export.
- Connection: address-to-key-hash conversion, Windows/Linux and CUDA/OpenCL commands, safe worker validation, copy feedback and a direct statistics link.
- Mobile: amount and payout status remain visible together; secondary columns move into row details. Controls wrap, tables fit the viewport, and chart observations can be inspected by touch or keyboard.
- Data honesty: sent includes pending; maturity depends on blocks; no guaranteed payout deadline. Collected history has explicit coverage limits and charts do not invent earlier samples.

Verification uses the real testnet through a read-only SSH bridge and an online-backup copy of the production explorer database. No mining, wallet or payout mutation is used. Unit tests cover large atom amounts, cursor boundaries, canonical branch changes, sample retention/gaps, cache sharing/outages and command validation.
