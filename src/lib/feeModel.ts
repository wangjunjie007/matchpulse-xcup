export type MatchPhase =
  | "Scheduled"
  | "LiveFirstHalf"
  | "HalfTime"
  | "LiveSecondHalf"
  | "ExtraTime"
  | "Penalties"
  | "Finalized";

export type MatchState = {
  phase: MatchPhase;
  minute: number;
  homeScore: number;
  awayScore: number;
  redCards: number;
  upsetSignal: boolean;
};

export type FeeQuote = {
  feeBps: number;
  volatilityScore: number;
  reason: string;
  premiumBps: number;
};

export const baseFeeBps = 30;
const maxFeeBps = 300;

export function quoteFee(state: MatchState): FeeQuote {
  let premium = 0;
  let reason = "scheduled baseline";

  if (state.phase === "HalfTime") {
    premium += 12;
    reason = "half-time liquidity rebalance";
  } else if (state.phase === "Finalized") {
    premium += 5;
    reason = "finalized settlement window";
  } else if (state.phase !== "Scheduled") {
    premium += 25;
    reason = "live match volatility";
  }

  const competitiveWindow = state.phase !== "Scheduled" && state.phase !== "Finalized";

  if (competitiveWindow && isLateMatch(state)) {
    premium += 30;
    reason = "late-game volatility";
  }
  if (competitiveWindow && isCloseScore(state)) {
    premium += 25;
    reason = "close-score pressure";
  }
  if (competitiveWindow && state.redCards > 0) {
    premium += state.redCards * 15;
    reason = "red-card shock";
  }
  if (competitiveWindow && state.upsetSignal) {
    premium += 20;
    reason = "upset signal";
  }

  const feeBps = Math.min(baseFeeBps + premium, maxFeeBps);
  return {
    feeBps,
    volatilityScore: Math.floor((premium * 100) / maxFeeBps),
    reason,
    premiumBps: premium
  };
}

function isLateMatch(state: MatchState) {
  return state.minute >= 75 || state.phase === "ExtraTime" || state.phase === "Penalties";
}

function isCloseScore(state: MatchState) {
  return Math.abs(state.homeScore - state.awayScore) <= 1;
}
