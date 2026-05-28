# MatchPulse X Cup

MatchPulse is an AI match decision engine and international football cup prediction market MVP for X Layer. The product combines outcome tokens, a signed match-state oracle path, a Uniswap v4-style Hook that dynamically prices live match volatility into swap fees, active liquidity rebalancing, and a visible multi-agent war room that explains how intelligence, quant signals, and strategy execution converge.

Live demo: https://wangjunjie007.github.io/matchpulse-xcup/

Demo video: [1080p/60fps English narrated walkthrough](docs/matchpulse-xcup-demo.mp4)

## Why This Fits X Cup

- Football cup native: every pool is tied to a match and its live state.
- X Layer ready: contracts are Foundry-based and configured for X Layer mainnet/testnet RPCs.
- Hook-centered: `MatchPulseHook` exposes `beforeSwap`, `afterSwap`, and `beforeModifyPosition` callbacks, returns deterministic fee quotes from oracle state, and emits TWCL liquidity-band events.
- Active liquidity rebalancing: late-game, close-score, red-card, upset, and injury-time states automatically compress the liquidity band around an active tick and record a vault-credit accounting value.
- EIP-712 Oracle: `MatchPulseOracle` accepts trusted signed match-state payloads with replay protection and evidence hashes.
- Session-key execution: `AgentExecutor` validates a user authorization signature and a separate AI session-key signature before routing an intent.
- Gas abstraction path: `MatchPulsePaymaster` quotes token-denominated gas charges for an ERC-4337 style sponsorship flow.
- OKX mobile-first: the frontend prioritizes OKX Wallet injection and falls back to `@okxconnect/ui`.
- AI Agent angle: the UI includes an agent co-pilot flow for market creation, fee explanations, and post-match recaps.
- Agent Vaults: the war room turns adversarial agent personas into subscribable strategy-pool demos.
- Fan mode: the frontend can hide Hook / gas / liquidity jargon behind fan-readable actions such as team boost and final push lane.
- Tweet-to-Trade: a frontend parser demonstrates how a social command can flow into a session-key gated X Layer action.
- Growth surface: Farcaster / Telegram and account-abstraction flows are modeled in the UI as the planned zero-friction funnel into X Layer activity.

## Architecture

```text
MatchPulseOracle
  -> accepts EIP-712 signed phase, minute, score, red-card and upset payloads
  -> validates trusted signer, nonce, deadline and evidenceHash

MatchOracleMock
  -> deterministic test helper for local tests

WorldCupMarketFactory
  -> creates HOME / DRAW / AWAY prediction ERC20 tokens
  -> mints complete sets against ETH collateral
  -> settles final winner and redeems winning tokens

MatchPulseHook
  -> quoteFee(matchId, baseFeeBps)
  -> quoteLiquidityBand(matchId)
  -> beforeSwap returns the current dynamic fee
  -> afterSwap records volume, swap count, volatility reason and TWCL band
  -> beforeModifyPosition actively redirects liquidity to the current band
  -> emits LiquidityBandRebalanced for indexers

SimulatedPoolManager
  -> local hackathon stand-in for a real Uniswap v4 PoolManager
  -> validates hook callbacks in tests and deployment demo

TlsSportsOracleAdapter
  -> production adapter skeleton for TLSNotary / ZK proof verified sports data
  -> shares the IMatchOracle interface used by MatchPulseHook

AgentExecutor
  -> verifies EIP-712 user session authorization and AI session-key intent signatures

MatchPulsePaymaster
  -> quotes token-paid gas charges for AA sponsorship policy integration
```

Subgraph indexing artifacts live in `subgraph/` and cover `DynamicFeeApplied`, `LiquidityBandRebalanced`, `ActiveLiquidityRebalanced`, and `SwapMeasured`.

```text
subgraph/schema.graphql
subgraph/subgraph.yaml
subgraph/src/mapping.ts
```

The submitted MVP is intentionally self-contained so judges can run it without external protocol packages. For a production Uniswap v4 deployment, replace `SimulatedPoolManager` with the official PoolManager and adapt the hook permissions/address mining flow required by the deployed v4 environment.

## Fee Model

Base fee starts at `30 bps`.

| Signal | Premium |
| --- | ---: |
| Live match | `+25 bps` |
| Half-time rebalance | `+12 bps` |
| Late game or extra time | `+30 bps` |
| Close score | `+25 bps` |
| Red card | `+15 bps` each |
| Upset signal | `+20 bps` |
| Finalized settlement window | `+5 bps` |

Max fee is capped at `300 bps`.

## TWCL Model

TWCL means time-weighted concentrated liquidity. Instead of only raising swap fees, the Hook also computes a liquidity concentration band:

| State | Effect |
| --- | --- |
| Pre-match | Wide band, low concentration |
| Live match | Moderate band and concentration |
| Late game | Band compresses toward current price |
| Close score | Extra convergence around current price |
| Red card / upset | Additional concentration shock |
| Injury time | Minimum-width "doom option" band |

The TWCL values are returned by `quoteLiquidityBand(matchId)`, stored in `PoolMetrics`, and emitted through `LiquidityBandRebalanced`.

`beforeModifyPosition` uses the same TWCL quote to expose the active rebalance path a production PoolManager integration would use. The submitted demo uses `SimulatedPoolManager` so the lifecycle is inspectable without external protocol packages.

## Local Run

```bash
npm install
npm run validate:deployment
npm run test:contracts
npm run test:stress
npm run dev
```

Open the Vite URL printed by the dev server, normally `http://127.0.0.1:5178`.

## Contract Tests

```bash
npm run validate:deployment
forge test -vvv
npm run build
```

Covered cases:

- Deployment JSON validation for numeric `chainId`, EVM addresses, `bytes32` IDs, and transaction hashes.
- Scheduled markets quote baseline fee.
- Late-game close-score red-card pressure raises the Hook fee.
- Late-game close-score red-card pressure increases TWCL concentration and narrows the band.
- `beforeModifyPosition` records active liquidity rebalances around the active tick.
- EIP-712 signed oracle updates accept only trusted signers and enforce nonce replay protection.
- Agent session-key execution requires both user and session signatures.
- Paymaster token gas quotes are deterministic.
- Stress harness routes 240 agent session-key intents, 240 Hook swaps, and 20 active liquidity rebalances.
- Injury time compresses the band to the minimum tested width.
- Users can mint complete outcome sets.
- Markets cannot settle before the oracle finalizes the match.
- Winning outcome tokens redeem collateral after settlement.

## X Layer Deployment

Copy `.env.example` to a local `.env` or export the variables in your shell. Do not commit real keys.

```bash
export PRIVATE_KEY=...
export XLAYER_TESTNET_RPC_URL=https://testrpc.xlayer.tech
forge script script/Deploy.s.sol:Deploy --rpc-url "$XLAYER_TESTNET_RPC_URL" --broadcast
```

X Layer chain IDs:

- Mainnet: `196`
- Testnet: `1952`

## Demo Script For Judges

1. Open the live demo and let the dynamic match simulation run for a few seconds.
2. Show that the frontend labels the match animation as local-only simulation.
3. Open the Chain tab and connect a wallet on X Layer testnet.
4. Click `Mint complete set` to write to the deployed testnet factory.
5. Click the on-chain Hook test transaction to trigger `SimulatedPoolManager.simulateSwap`.
6. Click the active liquidity rebalance button to trigger `beforeModifyPosition`.
7. Review Hook quote, TWCL band, active tick, pool metrics, outcome-token balances, and market collateral.
8. For the trusted signer wallet, write the final signed score through `MatchPulseOracle.updateMatchState`.
9. Settle the market through `WorldCupMarketFactory.settle`.
10. Redeem the winning token through `WorldCupMarketFactory.redeem`.

## Next Production Steps

- Replace the single trusted signer with a decentralized sports oracle feed or signer quorum.
- Replace `SimulatedPoolManager` with real Uniswap v4 PoolManager integration or an X Layer-native equivalent.
- Publish the subgraph in `subgraph/` and add indexing for `BundleMinted`, `MarketSettled`, and `Redeemed`.
- Add owner-aware oracle controls and a portfolio view.
- See `ROADMAP.md` for the testnet beta and production MVP plan.
