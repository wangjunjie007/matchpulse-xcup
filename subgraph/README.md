# MatchPulse Subgraph

This folder contains the indexing surface for MatchPulse Hook events:

- `DynamicFeeApplied`
- `LiquidityBandRebalanced`
- `ActiveLiquidityRebalanced`
- `SwapMeasured`

The current `subgraph.yaml` points at the TWCL-enabled public X Layer testnet Hook from the submitted demo. Set an exact start block before publishing the subgraph to a hosted indexer.

Production deployment notes:

1. Generate bindings with Graph CLI.
2. Replace `network: xlayer-testnet` with the network name used by the target indexer.
3. Deploy after the latest active-rebalance Hook address is finalized.
4. Use `PoolSnapshot` for realtime frontend dashboards and the immutable entities for audit trails.
