# MatchPulse Subgraph

This folder contains the indexing surface for MatchPulse Hook events:

- `DynamicFeeApplied`
- `LiquidityBandRebalanced`
- `SwapMeasured`

The current `subgraph.yaml` points at the public X Layer testnet Hook from the submitted demo. After redeploying the TWCL-enabled Hook, update the address and start block before publishing the subgraph.

Production deployment notes:

1. Generate bindings with Graph CLI.
2. Replace `network: xlayer-testnet` with the network name used by the target indexer.
3. Deploy after the TWCL Hook address is finalized.
4. Use `PoolSnapshot` for realtime frontend dashboards and the immutable entities for audit trails.
