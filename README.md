# MatchPulse X Cup

MatchPulse is a World Cup prediction market MVP for X Layer. The product combines outcome tokens, a match-state oracle, and a Uniswap v4-style Hook that dynamically prices live match volatility into swap fees.

## Why This Fits X Cup

- World Cup native: every pool is tied to a match and its live state.
- X Layer ready: contracts are Foundry-based and configured for X Layer mainnet/testnet RPCs.
- Hook-centered: `MatchPulseHook` exposes `beforeSwap` and `afterSwap` callbacks and returns deterministic fee quotes from oracle state.
- AI Agent angle: the UI includes an agent co-pilot flow for market creation, fee explanations, and post-match recaps.

## Architecture

```text
MatchOracleMock
  -> pushes phase, minute, score, red cards and upset signal

WorldCupMarketFactory
  -> creates HOME / DRAW / AWAY prediction ERC20 tokens
  -> mints complete sets against ETH collateral
  -> settles final winner and redeems winning tokens

MatchPulseHook
  -> quoteFee(matchId, baseFeeBps)
  -> beforeSwap returns the current dynamic fee
  -> afterSwap records volume, swap count and volatility reason

SimulatedPoolManager
  -> local hackathon stand-in for a real Uniswap v4 PoolManager
  -> validates hook callbacks in tests and deployment demo
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

## Local Run

```bash
npm install
npm run test:contracts
npm run dev
```

Open the Vite URL printed by the dev server, normally `http://127.0.0.1:5178`.

## Contract Tests

```bash
forge test -vvv
```

Covered cases:

- Scheduled markets quote baseline fee.
- Late-game close-score red-card pressure raises the Hook fee.
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

1. Start on pre-match state: baseline fee is `30 bps`.
2. Click the refresh icon to advance match events.
3. Show that kickoff, close-score, red-card and upset events raise Hook fees.
4. Simulate a swap and point to the event log.
5. Explain the contract test proving final settlement and winner redemption.

## Next Production Steps

- Replace `MatchOracleMock` with a signed oracle feed or UMA-style optimistic oracle.
- Replace `SimulatedPoolManager` with real Uniswap v4 PoolManager integration.
- Add wallet connection and X Layer transaction writes in the UI.
- Add agent-run market creation and social recap posting.
- Add liquidity incentives for LPs who stay active through high-volatility windows.
