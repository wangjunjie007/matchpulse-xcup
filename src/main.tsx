import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Bot,
  CircleDollarSign,
  Gauge,
  Landmark,
  Radio,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Zap
} from "lucide-react";
import { MatchState, baseFeeBps, quoteFee } from "./lib/feeModel";
import "./styles.css";

type Outcome = "Argentina" | "Draw" | "Brazil";

type EventLog = {
  id: number;
  label: string;
  detail: string;
  tone: "ok" | "warn" | "hot";
};

const timeline: Array<{ label: string; state: MatchState; detail: string }> = [
  {
    label: "Pre-match",
    detail: "Liquidity bootstrapping is cheap so makers can seed both sides.",
    state: {
      phase: "Scheduled",
      minute: 0,
      homeScore: 0,
      awayScore: 0,
      redCards: 0,
      upsetSignal: false
    }
  },
  {
    label: "Kickoff pressure",
    detail: "The first live swaps pay a higher protection premium.",
    state: {
      phase: "LiveFirstHalf",
      minute: 17,
      homeScore: 0,
      awayScore: 0,
      redCards: 0,
      upsetSignal: false
    }
  },
  {
    label: "Brazil scores",
    detail: "The underdog signal wakes up and arbitrage volume spikes.",
    state: {
      phase: "LiveSecondHalf",
      minute: 61,
      homeScore: 0,
      awayScore: 1,
      redCards: 0,
      upsetSignal: true
    }
  },
  {
    label: "Late red card",
    detail: "Close score, red card and late-game pressure stack into one Hook quote.",
    state: {
      phase: "LiveSecondHalf",
      minute: 84,
      homeScore: 1,
      awayScore: 1,
      redCards: 1,
      upsetSignal: true
    }
  },
  {
    label: "Final whistle",
    detail: "Settlement window stays protected while winning tokens are redeemed.",
    state: {
      phase: "Finalized",
      minute: 95,
      homeScore: 2,
      awayScore: 1,
      redCards: 1,
      upsetSignal: false
    }
  }
];

const initialBook: Record<Outcome, number> = {
  Argentina: 43,
  Draw: 24,
  Brazil: 33
};

function App() {
  const [step, setStep] = useState(0);
  const [book, setBook] = useState(initialBook);
  const [stake, setStake] = useState(150);
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome>("Argentina");
  const [logs, setLogs] = useState<EventLog[]>([
    {
      id: 1,
      label: "Market factory",
      detail: "ARG / DRAW / BRA prediction tokens are live on X Layer testnet.",
      tone: "ok"
    },
    {
      id: 2,
      label: "Hook bound",
      detail: "beforeSwap and afterSwap callbacks are returning deterministic dynamic fees.",
      tone: "ok"
    }
  ]);

  const match = timeline[step];
  const fee = useMemo(() => quoteFee(match.state), [match.state]);
  const impliedPrice = book[selectedOutcome] / 100;
  const feeCost = (stake * fee.feeBps) / 10_000;
  const tokens = (stake - feeCost) / Math.max(impliedPrice, 0.01);
  const maxOutcome = Object.entries(book).sort((a, b) => b[1] - a[1])[0][0] as Outcome;

  function advance() {
    const next = (step + 1) % timeline.length;
    setStep(next);
    const quote = quoteFee(timeline[next].state);
    const tone: EventLog["tone"] = quote.feeBps > 100 ? "hot" : quote.feeBps > baseFeeBps ? "warn" : "ok";
    setLogs((current) =>
      [
        {
          id: Date.now(),
          label: timeline[next].label,
          detail: `Hook fee ${quote.feeBps} bps: ${quote.reason}.`,
          tone
        },
        ...current
      ].slice(0, 6)
    );
  }

  function trade(outcome: Outcome) {
    setSelectedOutcome(outcome);
    const impact = Math.min(7, Math.max(1.4, stake / 75));
    const tone: EventLog["tone"] = fee.feeBps > 100 ? "hot" : "warn";
    setBook((current) => normalizeBook({ ...current, [outcome]: current[outcome] + impact }));
    setLogs((current) =>
      [
        {
          id: Date.now(),
          label: "Swap simulated",
          detail: `${outcome} buy routed through MatchPulseHook at ${fee.feeBps} bps.`,
          tone
        },
        ...current
      ].slice(0, 6)
    );
  }

  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <div className="eyebrow">
            <Radio size={15} />
            X Layer Hackathon MVP
          </div>
          <h1>MatchPulse</h1>
          <p>
            World Cup prediction markets with a Uniswap v4-style Hook that prices match volatility directly into
            swap fees.
          </p>
        </div>
        <div className="chainBadge">
          <Landmark size={18} />
          <span>X Layer testnet</span>
          <strong>Chain 1952</strong>
        </div>
      </section>

      <section className="mainGrid">
        <div className="matchBoard">
          <div className="boardHeader">
            <div>
              <span>Quarter Final</span>
              <h2>Argentina vs Brazil</h2>
            </div>
            <button type="button" className="iconButton" onClick={advance} aria-label="Advance match event">
              <RefreshCw size={18} />
            </button>
          </div>

          <div className="scoreStrip">
            <Team name="Argentina" score={match.state.homeScore} active={maxOutcome === "Argentina"} />
            <div className="clock">
              <strong>{match.state.minute || "00"}'</strong>
              <span>{phaseLabel(match.state.phase)}</span>
            </div>
            <Team name="Brazil" score={match.state.awayScore} active={maxOutcome === "Brazil"} />
          </div>

          <div className="eventCard">
            <div>
              <span>Current event</span>
              <strong>{match.label}</strong>
              <p>{match.detail}</p>
            </div>
            <Trophy size={28} />
          </div>

          <div className="outcomeGrid">
            {(["Argentina", "Draw", "Brazil"] as Outcome[]).map((outcome) => (
              <button
                key={outcome}
                type="button"
                className={`outcome ${selectedOutcome === outcome ? "selected" : ""}`}
                onClick={() => trade(outcome)}
              >
                <span>{outcome}</span>
                <strong>{book[outcome].toFixed(1)}%</strong>
                <small>Buy outcome</small>
              </button>
            ))}
          </div>
        </div>

        <aside className="hookPanel">
          <div className="panelTitle">
            <Zap size={18} />
            <span>Hook fee engine</span>
          </div>
          <div className="feeDial" style={{ "--angle": `${Math.min(300, fee.feeBps) * 1.2}deg` } as React.CSSProperties}>
            <div>
              <span>{fee.feeBps}</span>
              <small>bps</small>
            </div>
          </div>
          <dl className="metrics">
            <Metric label="Base fee" value={`${baseFeeBps} bps`} />
            <Metric label="Volatility premium" value={`${fee.premiumBps} bps`} />
            <Metric label="Volatility score" value={`${fee.volatilityScore}/100`} />
            <Metric label="Reason" value={fee.reason} />
          </dl>
          <div className="guardrail">
            <ShieldCheck size={18} />
            <span>LPs are protected when match state creates toxic flow.</span>
          </div>
        </aside>

        <section className="tradePanel">
          <div className="panelTitle">
            <CircleDollarSign size={18} />
            <span>Trade simulator</span>
          </div>
          <label className="stakeControl">
            <span>Stake USDC</span>
            <input
              type="range"
              min="25"
              max="500"
              step="25"
              value={stake}
              onChange={(event) => setStake(Number(event.target.value))}
            />
          </label>
          <div className="ticket">
            <div>
              <span>Selected</span>
              <strong>{selectedOutcome}</strong>
            </div>
            <div>
              <span>Stake</span>
              <strong>${stake.toFixed(0)}</strong>
            </div>
            <div>
              <span>Hook fee</span>
              <strong>${feeCost.toFixed(2)}</strong>
            </div>
            <div>
              <span>Outcome tokens</span>
              <strong>{tokens.toFixed(2)}</strong>
            </div>
          </div>
          <button type="button" className="primaryButton" onClick={() => trade(selectedOutcome)}>
            <Activity size={18} />
            Simulate swap
          </button>
        </section>

        <section className="agentPanel">
          <div className="panelTitle">
            <Bot size={18} />
            <span>Agent co-pilot</span>
          </div>
          <div className="agentBubble">
            {agentCopy(match.state, fee.feeBps, maxOutcome)}
          </div>
          <div className="agentActions">
            <span>Create match</span>
            <span>Explain fee</span>
            <span>Publish recap</span>
          </div>
        </section>

        <section className="logPanel">
          <div className="panelTitle">
            <Gauge size={18} />
            <span>Recent on-chain events</span>
          </div>
          <div className="logs">
            {logs.map((log) => (
              <div className={`log ${log.tone}`} key={log.id}>
                <strong>{log.label}</strong>
                <span>{log.detail}</span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function Team({ name, score, active }: { name: string; score: number; active: boolean }) {
  return (
    <div className={`team ${active ? "active" : ""}`}>
      <span>{name}</span>
      <strong>{score}</strong>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

function normalizeBook(next: Record<Outcome, number>) {
  const total = Object.values(next).reduce((sum, value) => sum + value, 0);
  return {
    Argentina: (next.Argentina / total) * 100,
    Draw: (next.Draw / total) * 100,
    Brazil: (next.Brazil / total) * 100
  };
}

function phaseLabel(phase: MatchState["phase"]) {
  return phase.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function agentCopy(state: MatchState, feeBps: number, leader: Outcome) {
  if (state.phase === "Scheduled") {
    return "Market is in bootstrap mode. I would ask LPs to seed both teams now because the Hook still quotes base fees.";
  }
  if (state.phase === "Finalized") {
    return `${leader} is the market leader after final whistle. I can settle the market, prepare redemption copy, and publish the proof links.`;
  }
  return `Live volatility is active at ${feeBps} bps. ${leader} has the strongest implied price, but the Hook is charging makers for close-score risk.`;
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
