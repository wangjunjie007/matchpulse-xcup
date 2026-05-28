# MatchPulse Stress Test

This directory contains the production-readiness stress harness for the X Layer hackathon demo.

Run:

```bash
forge test --match-path stress-test/AgentSessionStress.t.sol -vvv
```

What it simulates:

- 240 AI agent session-key intents inside a 10-second match window.
- Each intent requires a user EIP-712 authorization and a separate session-key EIP-712 intent signature.
- Every agent action also triggers Hook swap accounting.
- Every 12th agent triggers `beforeModifyPosition` through the simulated pool manager, producing an active liquidity rebalance event.

Why it matters:

- It tests the exact scoring narrative: multi-agent execution, session keys, active Hook rebalancing, and burst traffic after a high-volatility football event.
- It gives reviewers a deterministic local benchmark without requiring private keys or funded testnet wallets.
