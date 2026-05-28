import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  Bot,
  CircleDollarSign,
  ExternalLink,
  Gauge,
  Landmark,
  Languages,
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
type Language = "zh" | "en";
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

const copy = {
  zh: {
    eyebrow: "X Layer 黑客松 MVP",
    intro:
      "面向世界杯预测市场的动态费率 Hook：把比赛波动、红牌、比分压力直接计入 swap fee。",
    chainName: "X Layer 测试网",
    chainId: "Chain 1952",
    language: "语言",
    liveControls: "X Layer 链上控制",
    connectAndWrite: "连接钱包并写入测试网",
    connected: "已连接",
    noWallet: "未检测到钱包，请在 OKX Wallet 浏览器打开，或安装并启用 OKX Wallet / MetaMask。",
    noWalletDetected: "暂未检测到钱包 Provider",
    detected: "已检测到",
    factory: "Factory",
    connect: "连接",
    reconnect: "重连",
    xLayer: "X Layer",
    mintSet: "铸造一组",
    waiting: "等待中",
    quarterFinal: "四分之一决赛",
    matchTitle: "阿根廷 vs 巴西",
    advanceLabel: "推进比赛事件",
    currentEvent: "当前事件",
    buyOutcome: "买入结果",
    hookEngine: "Hook 费率引擎",
    bps: "bps",
    baseFee: "基础费率",
    volatilityPremium: "波动溢价",
    volatilityScore: "波动分",
    reason: "原因",
    guardrail: "比赛状态产生 toxic flow 时，LP 会通过动态费率获得保护。",
    tradeSimulator: "交易模拟器",
    stake: "投入 USDC",
    selected: "选择结果",
    hookFee: "Hook 费用",
    outcomeTokens: "结果 Token",
    simulateSwap: "模拟 Swap",
    walletWrite: "X Layer 钱包写入",
    wallet: "钱包",
    notConnected: "未连接",
    chain: "链",
    balance: "余额",
    connectWallet: "连接钱包",
    switchNetwork: "切换网络",
    waitingWallet: "等待钱包确认",
    mintCompleteSet: "链上铸造一组结果 Token",
    walletNote: "调用已部署在 X Layer testnet 的 Factory，铸造 ARG / DRAW / BRA 三种预测结果 Token。",
    viewTransaction: "查看交易",
    liveDeployment: "链上部署",
    poolManager: "Pool manager",
    agent: "Agent 助手",
    createMatch: "创建比赛",
    explainFee: "解释费率",
    publishRecap: "发布战报",
    recentEvents: "最近链上事件",
    marketFactory: "市场工厂",
    marketFactoryDetail: "ARG / DRAW / BRA 三种预测 Token 已部署在 X Layer testnet。",
    hookBound: "Hook 已绑定",
    hookBoundDetail: "beforeSwap 和 afterSwap 回调会返回确定性的动态费率。",
    hookFeeLog: "Hook 费率",
    swapSimulated: "Swap 已模拟",
    buyRouted: "买入通过 MatchPulseHook 路由，当前费率",
    xLayerWrite: "X Layer 写入",
    submitted: "mintCompleteSet 已提交",
    walletFailed: "钱包请求失败。",
    phase: {
      Scheduled: "赛前",
      LiveFirstHalf: "上半场直播",
      HalfTime: "中场",
      LiveSecondHalf: "下半场直播",
      ExtraTime: "加时赛",
      Penalties: "点球大战",
      Finalized: "已完赛"
    },
    feeReasons: {
      "scheduled baseline": "赛前基础费率",
      "half-time liquidity rebalance": "中场流动性再平衡",
      "finalized settlement window": "赛后结算窗口",
      "live match volatility": "直播比赛波动",
      "late-game volatility": "终场前高波动",
      "close-score pressure": "比分胶着压力",
      "red-card shock": "红牌冲击",
      "upset signal": "冷门信号"
    },
    agentScheduled:
      "市场处于启动流动性阶段。此时 Hook 仍报价基础费率，适合 LP 先为两边结果注入流动性。",
    agentFinalized:
      "已进入赛后结算窗口。我可以结算市场、生成赎回说明，并整理链上证明链接。",
    agentLivePrefix: "当前直播波动费率为",
    agentLiveSuffix: "拥有最高隐含价格，但 Hook 正在对胶着比分风险收费。"
  },
  en: {
    eyebrow: "X Layer Hackathon MVP",
    intro:
      "World Cup prediction markets with a Uniswap v4-style Hook that prices match volatility directly into swap fees.",
    chainName: "X Layer testnet",
    chainId: "Chain 1952",
    language: "Language",
    liveControls: "Live X Layer controls",
    connectAndWrite: "Connect wallet and write to testnet",
    connected: "Connected",
    noWallet: "No injected wallet found. Open this page in OKX Wallet browser, or install/enable OKX Wallet or MetaMask.",
    noWalletDetected: "No wallet provider detected yet",
    detected: "Detected",
    factory: "Factory",
    connect: "Connect",
    reconnect: "Reconnect",
    xLayer: "X Layer",
    mintSet: "Mint set",
    waiting: "Waiting",
    quarterFinal: "Quarter Final",
    matchTitle: "Argentina vs Brazil",
    advanceLabel: "Advance match event",
    currentEvent: "Current event",
    buyOutcome: "Buy outcome",
    hookEngine: "Hook fee engine",
    bps: "bps",
    baseFee: "Base fee",
    volatilityPremium: "Volatility premium",
    volatilityScore: "Volatility score",
    reason: "Reason",
    guardrail: "LPs are protected when match state creates toxic flow.",
    tradeSimulator: "Trade simulator",
    stake: "Stake USDC",
    selected: "Selected",
    hookFee: "Hook fee",
    outcomeTokens: "Outcome tokens",
    simulateSwap: "Simulate swap",
    walletWrite: "X Layer wallet write",
    wallet: "Wallet",
    notConnected: "Not connected",
    chain: "Chain",
    balance: "Balance",
    connectWallet: "Connect wallet",
    switchNetwork: "Switch network",
    waitingWallet: "Waiting for wallet",
    mintCompleteSet: "Mint complete set",
    walletNote: "Calls the deployed factory on X Layer testnet and mints ARG / DRAW / BRA outcome tokens.",
    viewTransaction: "View transaction",
    liveDeployment: "Live deployment",
    poolManager: "Pool manager",
    agent: "Agent co-pilot",
    createMatch: "Create match",
    explainFee: "Explain fee",
    publishRecap: "Publish recap",
    recentEvents: "Recent on-chain events",
    marketFactory: "Market factory",
    marketFactoryDetail: "ARG / DRAW / BRA prediction tokens are live on X Layer testnet.",
    hookBound: "Hook bound",
    hookBoundDetail: "beforeSwap and afterSwap callbacks are returning deterministic dynamic fees.",
    hookFeeLog: "Hook fee",
    swapSimulated: "Swap simulated",
    buyRouted: "buy routed through MatchPulseHook at",
    xLayerWrite: "X Layer write",
    submitted: "mintCompleteSet submitted",
    walletFailed: "Wallet request failed.",
    phase: {
      Scheduled: "Scheduled",
      LiveFirstHalf: "Live First Half",
      HalfTime: "Half Time",
      LiveSecondHalf: "Live Second Half",
      ExtraTime: "Extra Time",
      Penalties: "Penalties",
      Finalized: "Finalized"
    },
    feeReasons: {
      "scheduled baseline": "scheduled baseline",
      "half-time liquidity rebalance": "half-time liquidity rebalance",
      "finalized settlement window": "finalized settlement window",
      "live match volatility": "live match volatility",
      "late-game volatility": "late-game volatility",
      "close-score pressure": "close-score pressure",
      "red-card shock": "red-card shock",
      "upset signal": "upset signal"
    },
    agentScheduled:
      "Market is in bootstrap mode. I would ask LPs to seed both teams now because the Hook still quotes base fees.",
    agentFinalized:
      "is the market leader after final whistle. I can settle the market, prepare redemption copy, and publish the proof links.",
    agentLivePrefix: "Live volatility is active at",
    agentLiveSuffix: "has the strongest implied price, but the Hook is charging makers for close-score risk."
  }
} as const;

const outcomeCopy: Record<Language, Record<Outcome, string>> = {
  zh: {
    Argentina: "阿根廷",
    Draw: "平局",
    Brazil: "巴西"
  },
  en: {
    Argentina: "Argentina",
    Draw: "Draw",
    Brazil: "Brazil"
  }
};

const timeline: Array<{ label: Record<Language, string>; state: MatchState; detail: Record<Language, string> }> = [
  {
    label: { zh: "赛前准备", en: "Pre-match" },
    detail: {
      zh: "启动流动性的成本较低，做市者可以先为双方结果注入流动性。",
      en: "Liquidity bootstrapping is cheap so makers can seed both sides."
    },
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
    label: { zh: "开赛压力", en: "Kickoff pressure" },
    detail: {
      zh: "进入直播阶段后，第一批交易会支付更高的保护溢价。",
      en: "The first live swaps pay a higher protection premium."
    },
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
    label: { zh: "巴西进球", en: "Brazil scores" },
    detail: {
      zh: "冷门信号被触发，套利与再定价交易量快速上升。",
      en: "The underdog signal wakes up and arbitrage volume spikes."
    },
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
    label: { zh: "终场前红牌", en: "Late red card" },
    detail: {
      zh: "胶着比分、红牌和终场前压力叠加到同一次 Hook 报价中。",
      en: "Close score, red card and late-game pressure stack into one Hook quote."
    },
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
    label: { zh: "终场哨响", en: "Final whistle" },
    detail: {
      zh: "赢家 Token 开始赎回，结算窗口仍保持基础保护。",
      en: "Settlement window stays protected while winning tokens are redeemed."
    },
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
  const [language, setLanguage] = useState<Language>("zh");
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
      label: "市场工厂",
      detail: "ARG / DRAW / BRA 三种预测 Token 已部署在 X Layer testnet。",
      tone: "ok"
    },
    {
      id: 2,
      label: "Hook 已绑定",
      detail: "beforeSwap 和 afterSwap 回调会返回确定性的动态费率。",
      tone: "ok"
    }
  ]);

  const t = copy[language];
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
    setLogs((current) => {
      if (current.length > 2) return current;
      return initialLogs(language);
    });
  }, [language]);

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
          label: timeline[next].label[language],
          detail: `${t.hookFeeLog} ${quote.feeBps} bps: ${translateFeeReason(quote.reason, language)}.`,
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
          label: t.swapSimulated,
          detail:
            language === "zh"
              ? `${outcomeCopy.zh[outcome]} ${t.buyRouted} ${fee.feeBps} bps。`
              : `${outcomeCopy.en[outcome]} ${t.buyRouted} ${fee.feeBps} bps.`,
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
      setWalletError(t.noWallet);
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
      setWalletError(t.noWallet);
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
      setWalletError(t.noWallet);
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
            label: t.xLayerWrite,
            detail: `${t.submitted}: ${shortHash(hash)}.`,
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
            {t.eyebrow}
          </div>
          <h1>MatchPulse</h1>
          <p>{t.intro}</p>
        </div>
        <div className="languageSwitch" aria-label={t.language}>
          <Languages size={16} />
          <button type="button" className={language === "zh" ? "active" : ""} onClick={() => setLanguage("zh")}>
            中文
          </button>
          <button type="button" className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>
            EN
          </button>
        </div>
        <div className="chainBadge">
          <Landmark size={18} />
          <span>{t.chainName}</span>
          <strong>{t.chainId}</strong>
        </div>
      </section>

      <section className="chainActionBar">
        <div className="chainActionCopy">
          <span>{t.liveControls}</span>
          <strong>{walletReady ? `${t.connected} ${shortHash(walletAddress)}` : t.connectAndWrite}</strong>
          <small>
            {walletError
              ? walletError
              : providerName
                ? `${t.detected} ${providerName}`
                : t.noWalletDetected}
          </small>
        </div>
        <a
          className="chainActionLink"
          href={`${explorerBase}/address/${deployment.contracts.WorldCupMarketFactory}`}
          target="_blank"
          rel="noreferrer"
        >
          {t.factory} {shortHash(deployment.contracts.WorldCupMarketFactory)}
          <ExternalLink size={14} />
        </a>
        <div className="chainActionButtons">
          <button type="button" className="chainActionButton" onClick={connectWallet} disabled={walletBusy}>
            <PlugZap size={17} />
            {walletAddress ? t.reconnect : t.connect}
          </button>
          <button type="button" className="chainActionButton" onClick={switchToXLayer} disabled={walletBusy}>
            <Landmark size={17} />
            {t.xLayer}
          </button>
          <button type="button" className="chainActionButton hot" onClick={mintOnXLayer} disabled={walletBusy}>
            <Zap size={17} />
            {walletBusy ? t.waiting : t.mintSet}
          </button>
        </div>
      </section>

      <section className="mainGrid">
        <div className="matchBoard">
          <div className="boardHeader">
            <div>
              <span>{t.quarterFinal}</span>
              <h2>{t.matchTitle}</h2>
            </div>
            <button type="button" className="iconButton" onClick={advance} aria-label={t.advanceLabel}>
              <RefreshCw size={18} />
            </button>
          </div>

          <div className="scoreStrip">
            <Team name={outcomeCopy[language].Argentina} score={match.state.homeScore} active={maxOutcome === "Argentina"} />
            <div className="clock">
              <strong>{match.state.minute || "00"}'</strong>
              <span>{t.phase[match.state.phase]}</span>
            </div>
            <Team name={outcomeCopy[language].Brazil} score={match.state.awayScore} active={maxOutcome === "Brazil"} />
          </div>

          <div className="eventCard">
            <div>
              <span>{t.currentEvent}</span>
              <strong>{match.label[language]}</strong>
              <p>{match.detail[language]}</p>
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
                <span>{outcomeCopy[language][outcome]}</span>
                <strong>{book[outcome].toFixed(1)}%</strong>
                <small>{t.buyOutcome}</small>
              </button>
            ))}
          </div>
        </div>

        <aside className="hookPanel">
          <div className="panelTitle">
            <Zap size={18} />
            <span>{t.hookEngine}</span>
          </div>
          <div className="feeDial" style={{ "--angle": `${Math.min(300, fee.feeBps) * 1.2}deg` } as React.CSSProperties}>
            <div>
              <span>{fee.feeBps}</span>
              <small>{t.bps}</small>
            </div>
          </div>
          <dl className="metrics">
            <Metric label={t.baseFee} value={`${baseFeeBps} bps`} />
            <Metric label={t.volatilityPremium} value={`${fee.premiumBps} bps`} />
            <Metric label={t.volatilityScore} value={`${fee.volatilityScore}/100`} />
            <Metric label={t.reason} value={translateFeeReason(fee.reason, language)} />
          </dl>
          <div className="guardrail">
            <ShieldCheck size={18} />
            <span>{t.guardrail}</span>
          </div>
        </aside>

        <section className="tradePanel">
          <div className="panelTitle">
            <CircleDollarSign size={18} />
            <span>{t.tradeSimulator}</span>
          </div>
          <label className="stakeControl">
            <span>{t.stake}</span>
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
              <span>{t.selected}</span>
              <strong>{outcomeCopy[language][selectedOutcome]}</strong>
            </div>
            <div>
              <span>{t.stake}</span>
              <strong>${stake.toFixed(0)}</strong>
            </div>
            <div>
              <span>{t.hookFee}</span>
              <strong>${feeCost.toFixed(2)}</strong>
            </div>
            <div>
              <span>{t.outcomeTokens}</span>
              <strong>{tokens.toFixed(2)}</strong>
            </div>
          </div>
          <button type="button" className="primaryButton" onClick={() => trade(selectedOutcome)}>
            <Activity size={18} />
            {t.simulateSwap}
          </button>
        </section>

        <section className="walletPanel">
          <div className="panelTitle">
            <Wallet size={18} />
            <span>{t.walletWrite}</span>
          </div>
          <div className="walletStatus">
            <div>
              <span>{t.wallet}</span>
              <strong>{walletAddress ? shortHash(walletAddress) : t.notConnected}</strong>
            </div>
            <div>
              <span>{t.chain}</span>
              <strong>{walletChainId ? walletChainId : "--"}</strong>
            </div>
            <div>
              <span>{t.balance}</span>
              <strong>{walletBalance} OKB</strong>
            </div>
          </div>
          <div className="walletActions">
            <button type="button" className="secondaryButton" onClick={connectWallet} disabled={walletBusy}>
              <PlugZap size={17} />
              {walletAddress ? t.reconnect : t.connectWallet}
            </button>
            <button type="button" className="secondaryButton" onClick={switchToXLayer} disabled={walletBusy}>
              <Landmark size={17} />
              {t.switchNetwork}
            </button>
          </div>
          <button type="button" className="primaryButton" onClick={mintOnXLayer} disabled={walletBusy}>
            <Zap size={18} />
            {walletBusy ? t.waitingWallet : `${t.mintCompleteSet} (${mintValueEth} OKB)`}
          </button>
          <p className="walletNote">{t.walletNote}</p>
          {walletError ? <div className="walletError">{walletError}</div> : null}
          {txHash ? (
            <a className="txLink" href={`${explorerBase}/tx/${txHash}`} target="_blank" rel="noreferrer">
              {t.viewTransaction} <ExternalLink size={14} />
            </a>
          ) : null}
        </section>

        <section className="deployPanel">
          <div className="panelTitle">
            <Landmark size={18} />
            <span>{t.liveDeployment}</span>
          </div>
          <div className="addressList">
            <AddressRow label={t.factory} value={deployment.contracts.WorldCupMarketFactory} />
            <AddressRow label="Hook" value={deployment.contracts.MatchPulseHook} />
            <AddressRow label={t.poolManager} value={deployment.contracts.SimulatedPoolManager} />
            <AddressRow label="ARG token" value={deployment.predictionTokens.Argentina} />
            <AddressRow label="DRAW token" value={deployment.predictionTokens.Draw} />
            <AddressRow label="BRA token" value={deployment.predictionTokens.Brazil} />
          </div>
        </section>

        <section className="agentPanel">
          <div className="panelTitle">
            <Bot size={18} />
            <span>{t.agent}</span>
          </div>
          <div className="agentBubble">
            {agentCopy(match.state, fee.feeBps, maxOutcome, language)}
          </div>
          <div className="agentActions">
            <span>{t.createMatch}</span>
            <span>{t.explainFee}</span>
            <span>{t.publishRecap}</span>
          </div>
        </section>

        <section className="logPanel">
          <div className="panelTitle">
            <Gauge size={18} />
            <span>{t.recentEvents}</span>
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

function agentCopy(state: MatchState, feeBps: number, leader: Outcome, language: Language) {
  const t = copy[language];
  if (state.phase === "Scheduled") {
    return t.agentScheduled;
  }
  if (state.phase === "Finalized") {
    if (language === "zh") {
      return `${outcomeCopy.zh[leader]} 是终场后的市场领先结果。${t.agentFinalized}`;
    }
    return `${outcomeCopy.en[leader]} ${t.agentFinalized}`;
  }
  if (language === "zh") {
    return `${t.agentLivePrefix} ${feeBps} bps。${outcomeCopy.zh[leader]} ${t.agentLiveSuffix}`;
  }
  return `${t.agentLivePrefix} ${feeBps} bps. ${outcomeCopy.en[leader]} ${t.agentLiveSuffix}`;
}

function shortHash(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function readError(error: unknown) {
  if (typeof error === "object" && error && "shortMessage" in error && typeof error.shortMessage === "string") {
    return error.shortMessage;
  }
  if (error instanceof Error) return error.message;
  return copy.zh.walletFailed;
}

function translateFeeReason(reason: string, language: Language) {
  const reasons = copy[language].feeReasons as Record<string, string>;
  return reasons[reason] ?? reason;
}

function initialLogs(language: Language): EventLog[] {
  const t = copy[language];
  return [
    {
      id: 1,
      label: t.marketFactory,
      detail: t.marketFactoryDetail,
      tone: "ok"
    },
    {
      id: 2,
      label: t.hookBound,
      detail: t.hookBoundDetail,
      tone: "ok"
    }
  ];
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
