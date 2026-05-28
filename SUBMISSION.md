# MatchPulse X Cup Submission

## One-line Pitch

MatchPulse is a World Cup prediction market on X Layer where a Uniswap v4-style Hook turns live match volatility into dynamic swap fees.

## Links

- Live demo: https://wangjunjie007.github.io/matchpulse-xcup/
- GitHub: https://github.com/wangjunjie007/matchpulse-xcup
- X Layer testnet explorer: https://www.okx.com/web3/explorer/xlayer-test

## X Layer Testnet Deployment

- Chain ID: `1952`
- Deployer: `0x810958f166D388a19Aab9C145269954671C789b6`
- Match ID: `0xe3e84d73353db6ea0d3611f8ec51960d5b0e4355bb9b3d658156a3090882e479`

| Contract | Address |
| --- | --- |
| MatchOracleMock | `0x033de6d9ead7ea61e38e455f11cdbc300b528ae9` |
| WorldCupMarketFactory | `0x4b24eb9ae137eccd17bf3b653caa6a303156c40f` |
| MatchPulseHook | `0x0a3f08bf50ac0c2dc82e3c759afd3ceb2634ef9b` |
| SimulatedPoolManager | `0x6f349a7fe7307f9ec90dd4654cb0ca531e99e59c` |

Outcome tokens:

| Outcome | Token |
| --- | --- |
| Argentina | `0xc77B4B3559Cf4C651422f0A14ca427bc05Dd673B` |
| Draw | `0xB15099Af359E652C542C4d895afEf827Bc5D70E9` |
| Brazil | `0xDFA804f82AB6ad7aAE54f7c05927C75bc067934e` |

## What Was Built

- A World Cup market factory that creates HOME / DRAW / AWAY prediction tokens.
- A match oracle mock that pushes phase, minute, score, red-card and upset signals.
- A Hook contract with `beforeSwap` and `afterSwap` callbacks.
- A dynamic fee engine that increases LP protection during live, late-game, close-score, red-card and upset windows.
- A deployed X Layer testnet market for Argentina vs Brazil.
- A React demo that reads deployment addresses from `deployments/xlayer-testnet-1952.json`.
- Wallet connection, X Layer testnet switching, and a live write button that calls `mintCompleteSet(matchId)` on the deployed factory.
- Live reads from `MatchPulseHook.quoteFee(matchId, 30)`, Hook `poolMetrics(poolId)`, and ERC20 `balanceOf` for the three outcome tokens.
- A real X Layer testnet Hook test transaction button that calls `SimulatedPoolManager.simulateSwap(poolId, ...)` and triggers Hook `beforeSwap` / `afterSwap` on-chain.

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

## Demo Flow

1. Open the live demo.
2. Show the X Layer deployment panel and contract addresses.
3. Click the refresh button to advance match events.
4. Watch the Hook fee move from pre-match baseline to live volatility pricing.
5. Use the local simulation button only to show frontend market movement.
6. Connect a wallet on X Layer testnet.
7. Click `Mint complete set` to write to the deployed testnet factory.
8. Click the on-chain Hook test transaction to trigger `SimulatedPoolManager.simulateSwap`.
9. Open the transactions in the OKX X Layer testnet explorer.

Verified Hook test transaction:

`0x26f4ca83e5898034a046ecb2f35b5a1192fe24eaec53a9d393a7d8d4c123892b`

## Why It Matters

Prediction markets face toxic order flow when real-world events suddenly change the fair price. MatchPulse lets LPs keep markets open during high-volatility sports windows by pricing those events into swap fees directly at the Hook layer.

## Current Limitation

The MVP uses `SimulatedPoolManager` so judges can run and inspect the full Hook lifecycle without relying on an external Uniswap v4 deployment package. The Hook interface and flow are intentionally aligned with v4-style `beforeSwap` and `afterSwap` callbacks. The next production step is replacing the simulated manager with the official Uniswap v4 PoolManager and required hook permission address flow.

The frontend explicitly labels local-only simulation separately from real testnet writes. Real testnet writes currently include `mintCompleteSet` and `simulateSwap`; real reads include Hook quote, pool metrics and outcome-token balances.

## Validation

- `forge test -vvv`: 3 tests passing.
- `npm run build`: passing.
- GitHub Pages deployment: passing.
- Browser validation: live page loads, Hook fee renders, no console errors.
