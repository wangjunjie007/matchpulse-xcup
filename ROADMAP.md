# MatchPulse Production Roadmap

## Current State

MatchPulse is currently a hackathon-grade X Layer testnet MVP:

- Contracts are deployed on X Layer testnet.
- The frontend reads real deployment addresses from `deployments/xlayer-testnet-1952.json`.
- Wallet connection, network switching, `mintCompleteSet`, Hook test swaps, market settlement, and winner redemption are exposed in the UI.
- Dynamic match intensity in the hero is a frontend simulation and is explicitly labeled as local-only.
- The deployed oracle is `MatchPulseOracle` with one trusted signer for testnet operation.
- Hook lifecycle is exercised through `SimulatedPoolManager`, not an official production AMM pool manager.
- The repository now includes the next upgrade contracts: `MatchPulseOracle`, `AgentExecutor`, `MatchPulsePaymaster`, and `MatchPulseHook.beforeModifyPosition`.
- The frontend includes an OKX mobile-first connection path and a bounded AI session authorization signing flow.

This is suitable for judging, demos, and testnet experimentation. It is not yet suitable for real-money public usage.

## Phase 1: Testnet Beta

Target: 3-7 days.

Goal: make the current MVP usable as a coherent testnet beta from market creation to redemption.

Required work:

- Add a simple admin route or panel for creating new testnet matches.
- Replace hard-coded Argentina vs Brazil copy with match metadata read from the oracle.
- Add a safer testnet oracle operator flow:
  - show current oracle owner;
  - show whether the connected wallet can update scores;
  - support scheduled, live, half-time, finalized states;
  - prevent accidental finalization copy when user is not owner.
- Improve settlement UX:
  - show market `settled` state;
  - show winner token;
  - show collateral pool;
  - show user redeemable balance;
  - show redemption transaction and balance refresh.
- Add event indexing or lightweight log reads for:
  - `BundleMinted`;
  - `MarketSettled`;
  - `Redeemed`;
  - `DynamicFeeApplied`.
- Add wallet compatibility checks for OKX Wallet and MetaMask on desktop/mobile.
- Add explicit testnet warnings and expected gas/cost copy.
- Add signer-operator UX for `MatchPulseOracle` and expose current nonce/deadline/evidence hash.
- Keep `ActiveLiquidityRebalanced` visible through frontend reads and the Subgraph.

Exit criteria:

- A judge or tester can connect a wallet, mint a complete set, finalize a signed score with the trusted signer wallet, settle the market, and redeem the winning token without reading code.
- Browser checks pass on desktop and mobile.
- `forge test -vvv` and `npm run build` pass.

## Phase 2: Production MVP

Target: 4-8 weeks after testnet beta scope is frozen.

Goal: make the protocol safe enough for a small, capped real-money pilot.

Required work:

- Replace `SimulatedPoolManager` with the production AMM integration selected for X Layer:
  - official Uniswap v4 PoolManager if available and appropriate;
  - otherwise a documented equivalent pool manager with the same Hook lifecycle guarantees.
- Upgrade `MatchPulseOracle` operations from one trusted signer to a signed oracle adapter:
  - one primary data source;
  - one fallback source;
  - signer quorum or admin delay for final settlement;
  - replay protection;
  - event auditability.
- Add market-level risk controls:
  - max collateral per market;
  - emergency pause;
  - cancel/void match path;
  - delayed settlement window;
  - disputed settlement path.
- Harden contracts:
  - full unit tests for redemption edge cases;
  - fuzz tests for mint/redeem accounting;
  - invariant tests for collateral conservation;
  - access-control tests;
  - CEI review on all value transfers.
- Add production frontend flows:
  - portfolio view;
  - user transaction history;
  - PnL and redeemable value;
  - clear market status and risk labels;
  - pending transaction recovery.
- Add backend or indexer:
  - event ingestion;
  - public API for match and market state;
  - monitoring dashboards;
  - RPC fallback and alerting.
- Wire `AgentExecutor` to audited routing and ERC-4337 account flows:
  - short-lived session keys;
  - per-match spend caps;
  - strategy allowlists;
  - cancellation path;
  - monitoring for stale or abused keys.
- Wire `MatchPulsePaymaster` to an EntryPoint-compatible sponsorship service.

Exit criteria:

- All value-moving flows are covered by tests.
- Market accounting can be independently reconstructed from events.
- A capped pilot can be run with clear operator controls and incident response.

## Phase 3: Public Launch

Target: 8-12+ weeks, depending on audit and oracle/data partnerships.

Goal: operate a real public prediction-market product.

Required work:

- External smart contract audit.
- Oracle/data-provider agreement or durable decentralized oracle design.
- Legal and compliance review for target jurisdictions.
- Liquidity strategy and market-maker operations.
- Production monitoring:
  - chain events;
  - oracle delays;
  - abnormal fee spikes;
  - collateral and redemption health;
  - frontend errors;
  - RPC degradation.
- Incident playbooks:
  - wrong score;
  - postponed/cancelled match;
  - oracle outage;
  - stuck settlement;
  - UI/RPC failure;
  - discovered contract issue.
- Progressive rollout:
  - internal testnet;
  - public testnet;
  - capped mainnet pilot;
  - expanded market support.

## Known Gaps

- Current market buy/sell behavior is not a full production prediction-market AMM.
- Current Hook demo is v4-style but not yet bound to a production Uniswap v4 PoolManager deployment.
- Current match intensity animation is local UX simulation, not the source of truth.
- Current deployed oracle uses one trusted EIP-712 signer. Production still needs signer quorum, dispute rules, and monitored data-source operations.
- Current contracts have focused test coverage, not a full audit-grade suite.

## Recommended Next Step

Finish Phase 1 first. It creates a complete testnet story without pretending the protocol is production-ready.

The highest leverage next implementation tasks are:

1. Add match metadata reads to remove hard-coded team labels.
2. Add event history from testnet logs and the Subgraph.
3. Add trusted-signer oracle controls.
4. Add portfolio/redeemable state for the connected wallet.
