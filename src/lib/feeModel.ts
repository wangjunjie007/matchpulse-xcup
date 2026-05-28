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

export type LiquidityBandQuote = {
  concentrationBps: number;
  tickLower: number;
  tickUpper: number;
  reason: string;
  bandWidth: number;
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

export function quoteLiquidityBand(state: MatchState): LiquidityBandQuote {
  let concentration = 1500;
  let halfWidth = 2400;
  let reason = "pre-match wide liquidity band";

  if (state.phase === "HalfTime") {
    concentration = 2600;
    halfWidth = 1800;
    reason = "half-time liquidity reset";
  } else if (state.phase === "Finalized") {
    concentration = 5200;
    halfWidth = 720;
    reason = "settlement redemption band";
  } else if (state.phase !== "Scheduled") {
    concentration = 3400;
    halfWidth = 1200;
    reason = "live balanced liquidity band";
  }

  const competitiveWindow = state.phase !== "Scheduled" && state.phase !== "Finalized";

  if (competitiveWindow && isLateMatch(state)) {
    concentration += 2200;
    halfWidth = Math.floor((halfWidth * 58) / 100);
    reason = "final-whistle squeeze";
  }
  if (competitiveWindow && isCloseScore(state)) {
    concentration += 1400;
    halfWidth = Math.floor((halfWidth * 70) / 100);
    reason = "close-score convergence";
  }
  if (competitiveWindow && state.redCards > 0) {
    concentration += state.redCards * 700;
    halfWidth -= state.redCards * 100;
    reason = "red-card concentration";
  }
  if (competitiveWindow && state.upsetSignal) {
    concentration += 1000;
    halfWidth -= 180;
    reason = "upset flow concentration";
  }
  if (competitiveWindow && state.minute >= 90) {
    concentration += 1200;
    halfWidth = Math.floor(halfWidth / 2);
    reason = "injury-time doom option";
  }

  concentration = Math.min(9800, concentration);
  halfWidth = Math.max(120, halfWidth);

  return {
    concentrationBps: concentration,
    tickLower: -halfWidth,
    tickUpper: halfWidth,
    reason,
    bandWidth: halfWidth * 2
  };
}

function isLateMatch(state: MatchState) {
  return state.minute >= 75 || state.phase === "ExtraTime" || state.phase === "Penalties";
}

function isCloseScore(state: MatchState) {
  return Math.abs(state.homeScore - state.awayScore) <= 1;
}
