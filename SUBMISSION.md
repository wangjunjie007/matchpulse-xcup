# MatchPulse X Cup Submission

## One-line Pitch

MatchPulse is an AI match decision engine on X Layer where a visible multi-agent war room turns live football intelligence, on-chain odds, and match volatility into auditable prediction-market actions, dynamic Hook fees, active liquidity rebalancing, and session-key AI execution.

## Links

- Live demo: https://wangjunjie007.github.io/matchpulse-xcup/
- English demo video: GitHub-preview 720p/30fps English frontend, subtitles, narration, feature callouts, and dynamic-state changes: https://github.com/wangjunjie007/matchpulse-xcup/blob/main/docs/matchpulse-xcup-demo-en.mp4
- Chinese demo video: GitHub-preview 720p/30fps Chinese frontend, subtitles, narration, feature callouts, and dynamic-state changes: https://github.com/wangjunjie007/matchpulse-xcup/blob/main/docs/matchpulse-xcup-demo-zh.mp4
- Legacy/default video path: https://github.com/wangjunjie007/matchpulse-xcup/blob/main/docs/matchpulse-xcup-demo.mp4
- GitHub: https://github.com/wangjunjie007/matchpulse-xcup
- X Layer testnet explorer: https://www.okx.com/web3/explorer/xlayer-test

## X Layer Testnet Deployment

- Chain ID: `1952`
- Deployer: `0x810958f166D388a19Aab9C145269954671C789b6`
- Match ID: `0xe3e84d73353db6ea0d3611f8ec51960d5b0e4355bb9b3d658156a3090882e479`
- Pool ID: `0xc424c82650d041cc4977797800beddd2fc8c0f999a463ee2ecddce8eb13dcf15`

| Contract | Address |
| --- | --- |
| MatchPulseOracle | `0x76f5A4F0Ca59f1ce183e87F7Df1E6bc5609adD25` |
| WorldCupMarketFactory | `0x186226e6057bbA043D765d8427f80Bc5D633E167` |
| MatchPulseHook | `0xcD2c3598A23B27E17107f0dCe61B29eE20eEbCAE` |
| SimulatedPoolManager | `0xF17e874e55d0fFEd5928625911Ab7175A6248c40` |
| AgentExecutor | `0xFf76612d0B15f9ff8147eff8E424a25BFa12160c` |
| MatchPulsePaymaster | `0x75867841b5E85675089876D1AC7A585366f38748` |

Outcome tokens:

| Outcome | Token |
| --- | --- |
| Argentina | `0x951451867D8f0A95316ff055C9488A43133C7E1F` |
| Draw | `0x5A3d814D90961D0382D1e77E1cF0cbbC4B5d0D3F` |
| Brazil | `0x9a40bc258D507569dA7f8979238Bd98464A0dccA` |

## What Was Built

- A football cup market factory that creates HOME / DRAW / AWAY prediction tokens.
- A signed sports oracle receiver that pushes phase, minute, score, red-card and upset signals after EIP-712 verification.
- A Hook contract with `beforeSwap` and `afterSwap` callbacks.
- A Hook `beforeModifyPosition` path that records active liquidity rebalancing around an active tick.
- A dynamic fee engine that increases LP protection during live, late-game, close-score, red-card and upset windows.
- A TWCL engine that narrows the liquidity band around active tick as the match approaches final whistle, with extra convergence for close scores, red cards, upset flow, and injury time.
- `LiquidityBandRebalanced` and `ActiveLiquidityRebalanced` events for indexers and dashboards.
- `MatchPulseOracle`, an EIP-712 signed sports oracle receiver with trusted signers, nonce replay protection, deadlines, and `evidenceHash` commitments.
- `AgentExecutor`, an intent executor requiring both user session authorization and AI session-key signatures before routing a strategy action.
- `MatchPulsePaymaster`, a token-denominated gas quote contract for the ERC-4337 sponsorship path.
- A production oracle adapter skeleton, `TlsSportsOracleAdapter`, sharing `IMatchOracle` and designed for TLSNotary / ZK-proof verified sports feeds.
- A deployed X Layer testnet market for Argentina vs Brazil.
- A React demo that reads deployment addresses from `deployments/xlayer-testnet-1952.json`.
- Wallet connection, X Layer testnet switching, and a live write button that calls `mintCompleteSet(matchId)` on the deployed factory.
- OKX Wallet mobile-first connection path: injected `window.okxwallet` first, `@okxconnect/ui` modal / QR fallback second.
- A visible AI session authorization button that signs a bounded session-key intent message before the AI custody flow.
- Live reads from `MatchPulseHook.quoteFee(matchId, 30)`, Hook `poolMetrics(poolId)`, and ERC20 `balanceOf` for the three outcome tokens.
- A real X Layer testnet Hook test transaction button that calls `SimulatedPoolManager.simulateSwap(poolId, ...)` and triggers Hook `beforeSwap` / `afterSwap` on-chain.
- A Hook rebalance button that calls `SimulatedPoolManager.simulateModifyPosition(poolId, ...)` and triggers `beforeModifyPosition`.
- A testnet settlement loop that can write a signed final score, call `settle(matchId)`, and redeem winning tokens through `redeem(matchId, amount)`.
- A clearly labeled local-only dynamic match simulation that changes frontend intensity, odds, and fee visuals without pretending to be the chain source of truth.
- A multi-agent war room that separates Scraper, Quant, and Strategy / Execution agents into visible decision logs.
- Agent Vault cards that turn adversarial agent personas into subscribable strategy-pool demos: conservative coach, fanatic fan, and quant referee.
- Fan / Pro mode: fan mode removes Hook/liquidity/gas jargon and reframes actions as team boost, win boost, and final push lane; pro mode exposes Hook/TWCL terminology for judges.
- Tweet-to-Trade parser demo: `@MatchPulseAI follow ARG 25 OKB #ARGvBRA` is parsed into social-indexer, session-key, and X Layer action stages.
- A multimodal oracle verification panel showing how text reports, image evidence, and on-chain commits become auditable settlement inputs.
- A TLSNotary / ZK oracle proof path panel that explains how signed oracle evidence can be upgraded to decentralized proof verification without exposing API credentials.
- Farcaster Frame / Telegram Mini App and account-abstraction UX mockups for the planned zero-friction user funnel.
- Dynamic badge / leaderboard surfaces that convert repeated predictions into persistent X Layer user assets.
- A deployment config validator that checks numeric `chainId`, EVM addresses, `bytes32` IDs, and transaction hashes before tests/builds.
- A Subgraph skeleton under `subgraph/` indexing `DynamicFeeApplied`, `LiquidityBandRebalanced`, `ActiveLiquidityRebalanced`, and `SwapMeasured`.
- A stress test harness under `stress-test/` that simulates 240 agent session-key intents, 240 Hook swaps, and 20 active liquidity rebalances in a burst window.
- CI/CD now installs Foundry, validates deployment config, runs contract tests, and builds the GitHub Pages site.
- A gas report in `docs/gas-report.md` comparing the TWCL upgrade against the previous submitted build.

## Implementation Boundary

- Real in code today: active Hook rebalance logic, EIP-712 Oracle receiver, AgentExecutor session-key verifier, Paymaster quote contract, Foundry tests, stress harness, OKX mobile connection path, Hook quote reads, TWCL pool metrics reads, wallet connection, X Layer switching, minting, Hook test transaction, settlement/redeem UI, deployment explorer links, config validation, CI, Subgraph skeleton, gas report, and public GitHub Pages demo.
- Current deployed testnet address: the upgraded contract set is deployed on X Layer testnet. The verified Hook test transaction emits `LiquidityBandRebalanced`, and the verified active rebalance transaction emits `ActiveLiquidityRebalanced` with active tick and narrowed tick range.
- Demo autonomy today: session authorization signing, multi-agent logs, Agent Vault cards, Tweet-to-Trade parser, multimodal evidence stream, Farcaster / Telegram entry surfaces, AA sponsorship state, and dynamic badge progression are frontend product simulations with explicit labels unless they call the deployed X Layer buttons.
- Production next: publish the subgraph, connect Scraper to Kimi/Grok/Neynar/Telegram APIs, run Quant/Strat agents in a backend worker, wire the Paymaster to an ERC-4337 EntryPoint, and submit TLSNotary / decentralized sports-oracle evidence on-chain.

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

TWCL is implemented in `MatchPulseHook.quoteLiquidityBand(matchId)` and exposed to the active rebalance path through `beforeModifyPosition`.

| Signal | Liquidity Behavior |
| --- | --- |
| Pre-match | Wide `[-2400, 2400]` band and `1500 bps` concentration |
| Live match | Moderate `[-1200, 1200]` band and `3400 bps` concentration |
| Late game | Band width multiplied down and concentration boosted |
| Close score | Extra convergence around current price |
| Red card / upset | Additional concentration shock |
| Injury time | Minimum-width `[-120, 120]` "doom option" band |

The late red-card pressure test verifies `8700 bps` concentration around active tick. The injury-time test verifies minimum-width `240` total ticks and active-tick convergence.

## Demo Flow

1. Open the live demo.
2. Let the dynamic match simulation run and show the local-only label.
3. Open the Chain tab and show deployment addresses, Hook quote, pool metrics, and token balances.
4. Connect a wallet on X Layer testnet.
5. Click `Mint complete set` to write to the deployed testnet factory.
6. Click the on-chain Hook test transaction to trigger `SimulatedPoolManager.simulateSwap`.
7. Click the active liquidity rebalance action to trigger the `beforeModifyPosition` path when deployed with the latest contracts.
8. If using the trusted signer wallet, write the final signed score.
9. Call `settle(matchId)` from the UI.
10. Redeem winning tokens with `redeem(matchId, amount)`.
11. Open the transactions in the OKX X Layer testnet explorer.
12. Open the AI War Room tab and inspect the multi-agent decision chain, Session Key authorization, Agent Vaults, Tweet-to-Trade parser, multimodal oracle evidence, social entry funnel, dynamic badge asset, and X Layer proof links.

Verified Hook test transaction:

`0xd882d17599427cab90c1becbe8b56683eb53f4eb868d45d56e15cb1e69302a72`

## Why It Matters

Prediction markets face toxic order flow when real-world events suddenly change the fair price. MatchPulse lets LPs keep markets open during high-volatility sports windows by pricing those events into swap fees directly at the Hook layer.

## Current Limitation

The MVP uses `SimulatedPoolManager` so judges can run and inspect the full Hook lifecycle without relying on an external Uniswap v4 deployment package. The Hook interface and flow are intentionally aligned with v4-style `beforeSwap` and `afterSwap` callbacks. The next production step is replacing the simulated manager with the official Uniswap v4 PoolManager and required hook permission address flow.

The frontend explicitly labels local-only simulation separately from real testnet writes. Real testnet writes currently include `mintCompleteSet`, `simulateSwap`, signed oracle finalization, active liquidity rebalance, `settle`, and `redeem`; real reads include Hook quote, pool metrics, market collateral/settlement state, and outcome-token balances.

`MatchPulseOracle` is deployed for EIP-712 signed updates. `TlsSportsOracleAdapter` remains the production migration path for decentralized sports oracle or TLSNotary/ZK-proof verified authoritative feeds.

See `ROADMAP.md` for the remaining path from testnet beta to production MVP.

## Validation

- `forge test -vvv`: 8 core tests passing.
- `npm run test:stress`: 240 agent session-key intents, 240 Hook swaps, and 20 active rebalance operations passing.
- `npm run build`: passing.
- GitHub Pages deployment: passing.
- Browser validation: live page loads, Hook fee renders, no console errors.
