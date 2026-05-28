# MatchPulse X Cup Submission

## One-line Pitch

MatchPulse is an AI match decision engine on X Layer where a visible multi-agent war room turns live football intelligence, on-chain odds, and match volatility into auditable prediction-market actions, dynamic Hook fees, and time-weighted concentrated liquidity.

## Links

- Live demo: https://wangjunjie007.github.io/matchpulse-xcup/
- Demo video: 1080p/60fps English narrated walkthrough with subtitles, feature callouts, and dynamic-state changes: https://github.com/wangjunjie007/matchpulse-xcup/blob/main/docs/matchpulse-xcup-demo.mp4
- GitHub: https://github.com/wangjunjie007/matchpulse-xcup
- X Layer testnet explorer: https://www.okx.com/web3/explorer/xlayer-test

## X Layer Testnet Deployment

- Chain ID: `1952`
- Deployer: `0x810958f166D388a19Aab9C145269954671C789b6`
- Match ID: `0xe3e84d73353db6ea0d3611f8ec51960d5b0e4355bb9b3d658156a3090882e479`

| Contract | Address |
| --- | --- |
| MatchOracleMock | `0xfEbDF3940b697eFa77B7163BC9ff3a0F30053dB4` |
| WorldCupMarketFactory | `0xf47AFa05191946cC5Ef2C0DA5a90b6B01ea7c121` |
| MatchPulseHook | `0x035983729d43e55A7E306C9cbE4c728262e3fE3e` |
| SimulatedPoolManager | `0x8AAf7914Cc6AAA2DB882024a6c61a580A7c50c1b` |

Outcome tokens:

| Outcome | Token |
| --- | --- |
| Argentina | `0x7B147331Ea313bf3B01f521b34bC5600aDd8cf96` |
| Draw | `0x7C852736C253D7Be0B0914eF1428eA3EF8B652D4` |
| Brazil | `0x2f57B338dAcEd5F200fb4033BB0350dc1598edF2` |

## What Was Built

- A football cup market factory that creates HOME / DRAW / AWAY prediction tokens.
- A match oracle mock that pushes phase, minute, score, red-card and upset signals.
- A Hook contract with `beforeSwap` and `afterSwap` callbacks.
- A dynamic fee engine that increases LP protection during live, late-game, close-score, red-card and upset windows.
- A TWCL engine that narrows the liquidity band as the match approaches final whistle, with extra convergence for close scores, red cards, upset flow, and injury time.
- A `LiquidityBandRebalanced` event and `quoteLiquidityBand(matchId)` function for indexers and dashboards.
- A production oracle adapter skeleton, `TlsSportsOracleAdapter`, sharing `IMatchOracle` with the mock and designed for TLSNotary / ZK-proof verified sports feeds.
- A deployed X Layer testnet market for Argentina vs Brazil.
- A React demo that reads deployment addresses from `deployments/xlayer-testnet-1952.json`.
- Wallet connection, X Layer testnet switching, and a live write button that calls `mintCompleteSet(matchId)` on the deployed factory.
- Live reads from `MatchPulseHook.quoteFee(matchId, 30)`, Hook `poolMetrics(poolId)`, and ERC20 `balanceOf` for the three outcome tokens.
- A real X Layer testnet Hook test transaction button that calls `SimulatedPoolManager.simulateSwap(poolId, ...)` and triggers Hook `beforeSwap` / `afterSwap` on-chain.
- A testnet settlement loop that can write the final mock score, call `settle(matchId)`, and redeem winning tokens through `redeem(matchId, amount)`.
- A clearly labeled local-only dynamic match simulation that changes frontend intensity, odds, and fee visuals without pretending to be the chain source of truth.
- A multi-agent war room that separates Scraper, Quant, and Strategy / Execution agents into visible decision logs.
- Agent Vault cards that turn adversarial agent personas into subscribable strategy-pool demos: conservative coach, fanatic fan, and quant referee.
- Fan / Pro mode: fan mode removes Hook/liquidity/gas jargon and reframes actions as team boost, win boost, and final push lane; pro mode exposes Hook/TWCL terminology for judges.
- Tweet-to-Trade parser demo: `@MatchPulseAI follow ARG 25 OKB #ARGvBRA` is parsed into social-indexer, session-key, and X Layer action stages.
- A multimodal oracle verification panel showing how text reports, image evidence, and on-chain commits become auditable settlement inputs.
- A TLSNotary / ZK oracle proof path panel that explains how the mock oracle is replaced in production without exposing API credentials.
- Farcaster Frame / Telegram Mini App and account-abstraction UX mockups for the planned zero-friction user funnel.
- Dynamic badge / leaderboard surfaces that convert repeated predictions into persistent X Layer user assets.
- A deployment config validator that checks numeric `chainId`, EVM addresses, `bytes32` IDs, and transaction hashes before tests/builds.
- A Subgraph skeleton under `subgraph/` indexing `DynamicFeeApplied`, `LiquidityBandRebalanced`, and `SwapMeasured`.
- CI/CD now installs Foundry, validates deployment config, runs contract tests, and builds the GitHub Pages site.
- A gas report in `docs/gas-report.md` comparing the TWCL upgrade against the previous submitted build.

## Implementation Boundary

- Real today: contracts, TWCL quote logic, TWCL tests, Hook quote reads, TWCL pool metrics reads, wallet connection, X Layer switching, minting, Hook test transaction, settlement/redeem UI, deployment explorer links, config validation, CI, Subgraph skeleton, gas report, and public GitHub Pages demo.
- Current deployed testnet address: upgraded TWCL Hook deployed on X Layer testnet. The verified Hook test transaction emits `LiquidityBandRebalanced` and records `8700 bps` concentration with `[-207, 207]` ticks under late red-card pressure.
- Demo autonomy today: multi-agent logs, Agent Vault cards, Tweet-to-Trade parser, multimodal evidence stream, Farcaster / Telegram entry surfaces, AA sponsorship state, and dynamic badge progression are frontend product simulations with explicit labels.
- Production next: redeploy the TWCL Hook, publish the subgraph, connect Scraper to Kimi/Grok/Neynar/Telegram APIs, run Quant/Strat agents in a backend worker, add an AA provider/paymaster, and submit TLSNotary / decentralized sports-oracle evidence on-chain.

## Hook Fee Model

Base fee starts at `30 bps` and is capped at `300 bps`.

| Signal | Fee Premium |
| --- | ---: |
| Live match | `+25 bps` |
| Half-time rebalance | `+12 bps` |
| Late game or extra time | `+30 bps` |
| Close score | `+25 bps` |
| Red card | `+15 bps` each |
| Upset signal | `+20 bps` |
| Finalized settlement window | `+5 bps` |

## TWCL Model

TWCL is now implemented in `MatchPulseHook.quoteLiquidityBand(matchId)`.

| Signal | Liquidity Behavior |
| --- | --- |
| Pre-match | Wide `[-2400, 2400]` band and `1500 bps` concentration |
| Live match | Moderate `[-1200, 1200]` band and `3400 bps` concentration |
| Late game | Band width multiplied down and concentration boosted |
| Close score | Extra convergence around current price |
| Red card / upset | Additional concentration shock |
| Injury time | Minimum-width `[-120, 120]` "doom option" band |

The late red-card pressure test verifies `8700 bps` concentration and `[-207, 207]` ticks. The injury-time test verifies minimum-width `[-120, 120]` ticks.

## Demo Flow

1. Open the live demo.
2. Let the dynamic match simulation run and show the local-only label.
3. Open the Chain tab and show deployment addresses, Hook quote, pool metrics, and token balances.
4. Connect a wallet on X Layer testnet.
5. Click `Mint complete set` to write to the deployed testnet factory.
6. Click the on-chain Hook test transaction to trigger `SimulatedPoolManager.simulateSwap`.
7. If using the owner wallet, write the final mock score.
8. Call `settle(matchId)` from the UI.
9. Redeem winning tokens with `redeem(matchId, amount)`.
10. Open the transactions in the OKX X Layer testnet explorer.
11. Open the AI War Room tab and inspect the multi-agent decision chain, Agent Vaults, Tweet-to-Trade parser, multimodal oracle evidence, social entry funnel, dynamic badge asset, and X Layer proof links.

Verified Hook test transaction:

`0xd882d17599427cab90c1becbe8b56683eb53f4eb868d45d56e15cb1e69302a72`

## Why It Matters

Prediction markets face toxic order flow when real-world events suddenly change the fair price. MatchPulse lets LPs keep markets open during high-volatility sports windows by pricing those events into swap fees directly at the Hook layer.

## Current Limitation

The MVP uses `SimulatedPoolManager` so judges can run and inspect the full Hook lifecycle without relying on an external Uniswap v4 deployment package. The Hook interface and flow are intentionally aligned with v4-style `beforeSwap` and `afterSwap` callbacks. The next production step is replacing the simulated manager with the official Uniswap v4 PoolManager and required hook permission address flow.

The frontend explicitly labels local-only simulation separately from real testnet writes. Real testnet writes currently include `mintCompleteSet`, `simulateSwap`, owner-gated mock oracle finalization, `settle`, and `redeem`; real reads include Hook quote, pool metrics, market collateral/settlement state, and outcome-token balances.

The mock oracle has not been falsely removed from the testnet MVP. It remains the deterministic hackathon settlement source. `TlsSportsOracleAdapter` is the production migration path for decentralized sports oracle or TLSNotary/ZK-proof verified authoritative feeds.

See `ROADMAP.md` for the remaining path from testnet beta to production MVP.

## Validation

- `forge test -vvv`: 4 tests passing.
- `npm run build`: passing.
- GitHub Pages deployment: passing.
- Browser validation: live page loads, Hook fee renders, no console errors.
