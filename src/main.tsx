import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Bot,
  CircleDollarSign,
  ExternalLink,
  Gauge,
  Landmark,
  PlugZap,
  Radio,
  RefreshCw,
  ShieldCheck,
  Wallet,
  Trophy,
  Zap
} from "lucide-react";
import { createWalletClient, custom, formatEther, parseEther } from "viem";
import deployment from "../deployments/xlayer-testnet-1952.json";
import { MatchState, baseFeeBps, quoteFee } from "./lib/feeModel";
import "./styles.css";

type Outcome = "Argentina" | "Draw" | "Brazil";
type HexAddress = `0x${string}`;
type HexValue = `0x${string}`;

type EventLog = {
  id: number;
  label: string;
  detail: string;
  tone: "ok" | "warn" | "hot";
};

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] | object[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    okxwallet?: EthereumProvider | { ethereum?: EthereumProvider };
    web3?: { currentProvider?: EthereumProvider };
  }
}

const xLayerTestnet = {
  id: 1952,
  name: "X Layer testnet",
  nativeCurrency: { decimals: 18, name: "OKB", symbol: "OKB" },
  rpcUrls: {
    default: { http: [deployment.rpcUrl] },
    public: { http: [deployment.rpcUrl] }
  },
  blockExplorers: {
    default: { name: "OKX Explorer", url: deployment.explorer }
  }
} as const;

const factoryAbi = [
  {
    type: "function",
    name: "mintCompleteSet",
    stateMutability: "payable",
    inputs: [{ name: "matchId", type: "bytes32" }],
    outputs: []
  }
] as const;

const mintValueEth = "0.001";

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
  const [walletAddress, setWalletAddress] = useState<HexAddress | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<string>("--");
  const [txHash, setTxHash] = useState<HexValue | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
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
  const walletReady = walletAddress && walletChainId === deployment.chainId;
  const providerName = getWalletProviderName();
  const explorerBase = deployment.explorer.replace(/\/$/, "");

  useEffect(() => {
    const provider = getWalletProvider();
    if (!provider) return;

    const handleAccounts = (accounts: unknown) => {
      const [first] = Array.isArray(accounts) ? accounts : [];
      setWalletAddress(typeof first === "string" ? (first as HexAddress) : null);
    };
    const handleChain = (chainId: unknown) => {
      if (typeof chainId === "string") {
        setWalletChainId(Number.parseInt(chainId, 16));
      }
    };

    provider
      .request({ method: "eth_accounts" })
      .then(handleAccounts)
      .catch(() => undefined);
    provider
      .request({ method: "eth_chainId" })
      .then(handleChain)
      .catch(() => undefined);
    provider.on?.("accountsChanged", handleAccounts);
    provider.on?.("chainChanged", handleChain);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccounts);
      provider.removeListener?.("chainChanged", handleChain);
    };
  }, []);

  useEffect(() => {
    const provider = getWalletProvider();
    if (!provider || !walletAddress) {
      setWalletBalance("--");
      return;
    }

    provider
      .request({ method: "eth_getBalance", params: [walletAddress, "latest"] })
      .then((balance) => {
        if (typeof balance === "string") {
          setWalletBalance(Number(formatEther(BigInt(balance))).toFixed(4));
        }
      })
      .catch(() => setWalletBalance("--"));
  }, [walletAddress, walletChainId]);

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

  async function connectWallet() {
    setWalletError(null);
    const provider = getWalletProvider();
    if (!provider) {
      setWalletError("No injected wallet found. Open this page in OKX Wallet browser, or install/enable OKX Wallet or MetaMask.");
      return;
    }
    setWalletBusy(true);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const chainId = (await provider.request({ method: "eth_chainId" })) as string;
      setWalletAddress((accounts[0] as HexAddress) ?? null);
      setWalletChainId(Number.parseInt(chainId, 16));
    } catch (error) {
      setWalletError(readError(error));
    } finally {
      setWalletBusy(false);
    }
  }

  async function switchToXLayer() {
    setWalletError(null);
    const provider = getWalletProvider();
    if (!provider) {
      setWalletError("No injected wallet found. Open this page in OKX Wallet browser, or install/enable OKX Wallet or MetaMask.");
      return;
    }
    setWalletBusy(true);
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x7a0" }]
      });
      setWalletChainId(deployment.chainId);
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? Number(error.code) : 0;
      if (code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: "0x7a0",
              chainName: "X Layer testnet",
              nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
              rpcUrls: [deployment.rpcUrl],
              blockExplorerUrls: [deployment.explorer]
            }
          ]
        });
        setWalletChainId(deployment.chainId);
      } else {
        setWalletError(readError(error));
      }
    } finally {
      setWalletBusy(false);
    }
  }

  async function mintOnXLayer() {
    setWalletError(null);
    setTxHash(null);
    const provider = getWalletProvider();
    if (!provider) {
      setWalletError("No injected wallet found. Open this page in OKX Wallet browser, or install/enable OKX Wallet or MetaMask.");
      return;
    }
    if (!walletAddress) {
      await connectWallet();
      return;
    }
    if (walletChainId !== deployment.chainId) {
      await switchToXLayer();
      return;
    }

    setWalletBusy(true);
    try {
      const client = createWalletClient({
        account: walletAddress,
        chain: xLayerTestnet,
        transport: custom(provider)
      });
      const hash = await client.writeContract({
        address: deployment.contracts.WorldCupMarketFactory as HexAddress,
        abi: factoryAbi,
        functionName: "mintCompleteSet",
        args: [deployment.matchId as HexValue],
        value: parseEther(mintValueEth)
      });
      setTxHash(hash);
      const tone: EventLog["tone"] = "ok";
      setLogs((current) =>
        [
          {
            id: Date.now(),
            label: "X Layer write",
            detail: `mintCompleteSet submitted: ${shortHash(hash)}.`,
            tone
          },
          ...current
        ].slice(0, 6)
      );
    } catch (error) {
      setWalletError(readError(error));
    } finally {
      setWalletBusy(false);
    }
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

      <section className="chainActionBar">
        <div className="chainActionCopy">
          <span>Live X Layer controls</span>
          <strong>{walletReady ? `Connected ${shortHash(walletAddress)}` : "Connect wallet and write to testnet"}</strong>
          <small>
            {walletError
              ? walletError
              : providerName
                ? `Detected ${providerName}`
                : "No wallet provider detected yet"}
          </small>
        </div>
        <a
          className="chainActionLink"
          href={`${explorerBase}/address/${deployment.contracts.WorldCupMarketFactory}`}
          target="_blank"
          rel="noreferrer"
        >
          Factory {shortHash(deployment.contracts.WorldCupMarketFactory)}
          <ExternalLink size={14} />
        </a>
        <div className="chainActionButtons">
          <button type="button" className="chainActionButton" onClick={connectWallet} disabled={walletBusy}>
            <PlugZap size={17} />
            {walletAddress ? "Reconnect" : "Connect"}
          </button>
          <button type="button" className="chainActionButton" onClick={switchToXLayer} disabled={walletBusy}>
            <Landmark size={17} />
            X Layer
          </button>
          <button type="button" className="chainActionButton hot" onClick={mintOnXLayer} disabled={walletBusy}>
            <Zap size={17} />
            {walletBusy ? "Waiting" : "Mint set"}
          </button>
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

        <section className="walletPanel">
          <div className="panelTitle">
            <Wallet size={18} />
            <span>X Layer wallet write</span>
          </div>
          <div className="walletStatus">
            <div>
              <span>Wallet</span>
              <strong>{walletAddress ? shortHash(walletAddress) : "Not connected"}</strong>
            </div>
            <div>
              <span>Chain</span>
              <strong>{walletChainId ? walletChainId : "--"}</strong>
            </div>
            <div>
              <span>Balance</span>
              <strong>{walletBalance} OKB</strong>
            </div>
          </div>
          <div className="walletActions">
            <button type="button" className="secondaryButton" onClick={connectWallet} disabled={walletBusy}>
              <PlugZap size={17} />
              {walletAddress ? "Reconnect" : "Connect wallet"}
            </button>
            <button type="button" className="secondaryButton" onClick={switchToXLayer} disabled={walletBusy}>
              <Landmark size={17} />
              Switch network
            </button>
          </div>
          <button type="button" className="primaryButton" onClick={mintOnXLayer} disabled={walletBusy}>
            <Zap size={18} />
            {walletBusy ? "Waiting for wallet" : `Mint complete set (${mintValueEth} OKB)`}
          </button>
          <p className="walletNote">
            Calls the deployed factory on X Layer testnet and mints ARG / DRAW / BRA outcome tokens.
          </p>
          {walletError ? <div className="walletError">{walletError}</div> : null}
          {txHash ? (
            <a className="txLink" href={`${explorerBase}/tx/${txHash}`} target="_blank" rel="noreferrer">
              View transaction <ExternalLink size={14} />
            </a>
          ) : null}
        </section>

        <section className="deployPanel">
          <div className="panelTitle">
            <Landmark size={18} />
            <span>Live deployment</span>
          </div>
          <div className="addressList">
            <AddressRow label="Factory" value={deployment.contracts.WorldCupMarketFactory} />
            <AddressRow label="Hook" value={deployment.contracts.MatchPulseHook} />
            <AddressRow label="Pool manager" value={deployment.contracts.SimulatedPoolManager} />
            <AddressRow label="ARG token" value={deployment.predictionTokens.Argentina} />
            <AddressRow label="DRAW token" value={deployment.predictionTokens.Draw} />
            <AddressRow label="BRA token" value={deployment.predictionTokens.Brazil} />
          </div>
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

function AddressRow({ label, value }: { label: string; value: string }) {
  const explorerBase = deployment.explorer.replace(/\/$/, "");
  return (
    <a className="addressRow" href={`${explorerBase}/address/${value}`} target="_blank" rel="noreferrer">
      <span>{label}</span>
      <strong>{shortHash(value)}</strong>
      <ExternalLink size={13} />
    </a>
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

function shortHash(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function readError(error: unknown) {
  if (typeof error === "object" && error && "shortMessage" in error && typeof error.shortMessage === "string") {
    return error.shortMessage;
  }
  if (error instanceof Error) return error.message;
  return "Wallet request failed.";
}

function getWalletProvider(): EthereumProvider | undefined {
  if (window.okxwallet && "request" in window.okxwallet) return window.okxwallet;
  if (window.okxwallet && "ethereum" in window.okxwallet) return window.okxwallet.ethereum;
  if (window.ethereum) return window.ethereum;
  return window.web3?.currentProvider;
}

function getWalletProviderName() {
  if (window.okxwallet) return "OKX Wallet";
  if (window.ethereum) return "injected wallet";
  if (window.web3?.currentProvider) return "legacy web3 wallet";
  return "";
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
