# MatchPulse Gas Report

Generated from `forge test -vvv` on May 29, 2026.

| Test | Current Gas | Previous Submitted Gas | Delta |
| --- | ---: | ---: | ---: |
| `testCannotSettleBeforeFinalWhistle()` | `233,106` | `233,084` | `+22` |
| `testDynamicFeeRisesDuringLateRedCardPressure()` | `369,178` | `343,275` | `+25,903` |
| `testMarketMintsCompleteSetsAndRedeemsWinner()` | `227,083` | `227,061` | `+22` |
| `testTwclConvergesLiquidityDuringInjuryTime()` | `45,404` | new | new |

## Interpretation

The TWCL upgrade increases the Hook lifecycle cost because `afterSwap` now records three extra pool fields and emits `LiquidityBandRebalanced`. The added cost is concentrated in the simulated Hook swap path, which is the expected tradeoff for making liquidity-band movement indexable and auditable.

The market mint / settle / redeem path is effectively unchanged. The small `+22` deltas come from interface/type changes and compiler layout differences, not additional state writes in the factory.

## Mainnet-Level Optimization Notes

- Keep `simulateSwap` return values ABI-compatible at three fields; TWCL data is emitted and stored instead of returned through the simulator.
- Use `uint16` for concentration and `int24` for ticks to match Uniswap tick-domain sizing.
- Store only the latest TWCL fields in `PoolMetrics`; historical TWCL movement is intended for the subgraph, not contract storage.
- In production, consider packing `lastFeeBps`, `lastLiquidityConcentrationBps`, `lastTickLower`, `lastTickUpper`, and `lastUpdated` into fewer storage slots if write cost becomes the dominant bottleneck.
