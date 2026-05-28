import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Gauge,
  Landmark,
  Languages,
  LineChart as LineChartIcon,
  PlugZap,
  Radio,
  RefreshCw,
  ShieldCheck,
  Wallet,
  X,
  Zap
} from "lucide-react";
import { motion } from "motion/react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis
} from "recharts";
import { Toaster, toast } from "sonner";
import { createPublicClient, createWalletClient, custom, formatEther, formatUnits, http, parseEther } from "viem";
import deployment from "../deployments/xlayer-testnet-1952.json";
import stadiumNightUrl from "./assets/stadium-night.png";
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

type ChainQuote = {
  feeBps: number;
  volatilityScore: number;
  reason: string;
  source: "chain" | "local";
};

type TokenBalances = Record<Outcome, string>;
type TimelineEntry = {
  label: Record<Language, string>;
  state: MatchState;
  detail: Record<Language, string>;
};

type PoolMetricsState = {
  totalVolumeUsd: string;
  swapCount: string;
  lastFeeBps: string;
  lastReason: string;
};

type MarketState = {
  totalCollateral: string;
  winningSupplyAtSettlement: string;
  winner: number;
  settled: boolean;
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
    name: "markets",
    stateMutability: "view",
    inputs: [{ name: "matchId", type: "bytes32" }],
    outputs: [
      { name: "matchId", type: "bytes32" },
      { name: "homeToken", type: "address" },
      { name: "drawToken", type: "address" },
      { name: "awayToken", type: "address" },
      { name: "totalCollateral", type: "uint256" },
      { name: "winningSupplyAtSettlement", type: "uint256" },
      { name: "winner", type: "uint8" },
      { name: "exists", type: "bool" },
      { name: "settled", type: "bool" }
    ]
  },
  {
    type: "function",
    name: "mintCompleteSet",
    stateMutability: "payable",
    inputs: [{ name: "matchId", type: "bytes32" }],
    outputs: []
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [{ name: "matchId", type: "bytes32" }],
    outputs: []
  },
  {
    type: "function",
    name: "redeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "bytes32" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  }
] as const;

const oracleAbi = [
  {
    type: "function",
    name: "updateMatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "matchId", type: "bytes32" },
      { name: "phase", type: "uint8" },
      { name: "minute", type: "uint8" },
      { name: "homeScore", type: "uint8" },
      { name: "awayScore", type: "uint8" },
      { name: "redCards", type: "uint8" },
      { name: "upsetSignal", type: "bool" }
    ],
    outputs: []
  }
] as const;

const hookAbi = [
  {
    type: "function",
    name: "quoteFee",
    stateMutability: "view",
    inputs: [
      { name: "matchId", type: "bytes32" },
      { name: "baseFeeBps", type: "uint24" }
    ],
    outputs: [
      { name: "feeBps", type: "uint24" },
      { name: "volatilityScore", type: "uint256" },
      { name: "reason", type: "string" }
    ]
  },
  {
    type: "function",
    name: "poolMetrics",
    stateMutability: "view",
    inputs: [{ name: "poolId", type: "bytes32" }],
    outputs: [
      { name: "totalVolumeUsd", type: "uint256" },
      { name: "swapCount", type: "uint256" },
      { name: "lastFeeBps", type: "uint24" },
      { name: "lastVolatilityScore", type: "uint256" },
      { name: "lastUpdated", type: "uint64" },
      { name: "lastReason", type: "string" }
    ]
  }
] as const;

const poolManagerAbi = [
  {
    type: "function",
    name: "simulateSwap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "poolId", type: "bytes32" },
      { name: "zeroForOne", type: "bool" },
      { name: "amountSpecified", type: "int256" },
      { name: "volumeUsd", type: "uint256" }
    ],
    outputs: [
      { name: "feeBps", type: "uint24" },
      { name: "volatilityScore", type: "uint256" },
      { name: "reason", type: "string" }
    ]
  }
] as const;

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }]
  }
] as const;

const mintValueEth = "0.001";
const poolId = "0x0175cb519b77203a16fff09cd0e584e7432888376982fa289402b45b04507430" as HexValue;
const simulationIntervalMs = 2_400;
const publicClient = createPublicClient({
  chain: xLayerTestnet,
  transport: http(deployment.rpcUrl)
});

const copy = {
  zh: {
    eyebrow: "X Layer 黑客松 MVP",
    intro: "国际足球杯赛预测市场控制台：用 v4-style Hook 把比赛波动、红牌和比分压力直接转化为链上 swap fee。",
    chainName: "X Layer 测试网",
    chainId: "Chain 1952",
    language: "语言",
    liveControls: "X Layer 链上控制",
    connectAndWrite: "连接钱包并写入测试网",
    stadiumSignal: "国际足球杯赛 · 夜场",
    broadcastMode: "实时比赛信号",
    liveMinute: "比赛时间",
    matchRisk: "市场风险",
    crowdHeat: "现场热度",
    cupTicker: "杯赛控制台",
    matchTimeline: "比赛时间线",
    simulationMode: "动态比赛模拟",
    simulationRunning: "本地模拟运行中",
    simulationPaused: "本地模拟已暂停",
    simulationNote: "只驱动前端比赛强度、赔率和 Hook 费率展示；真实链上读写仍来自 X Layer testnet。",
    intensity: "激烈程度",
    pauseSimulation: "暂停模拟",
    resumeSimulation: "继续模拟",
    resetSimulation: "重置比赛",
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
    openDeployment: "查看部署",
    marketTab: "市场",
    chainTab: "链上",
    judgeTab: "评委视图",
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
    feeCurve: "费率曲线",
    volatilityCurve: "波动走势",
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
    copied: "已复制",
    copyAddress: "复制地址",
    localOnly: "本地模拟",
    localOnlyNote: "这个按钮只更新前端价格和日志，不发链上交易。",
    chainQuote: "链上 Hook 报价",
    chainQuoteSource: "数据来自 X Layer testnet 的 MatchPulseHook.quoteFee",
    refreshChainData: "刷新链上数据",
    chainHookTest: "链上 Hook 测试交易",
    chainHookTestNote: "调用 SimulatedPoolManager.simulateSwap，在链上触发 Hook beforeSwap / afterSwap。",
    hookTestSubmitted: "链上 Hook 测试交易已提交",
    settlementPanel: "Testnet 结算闭环",
    finalOracleWrite: "写入终场比分",
    finalOracleNote: "owner 钱包可调用 MatchOracleMock.updateMatch，把测试网比赛置为 2-1 终场。",
    settleMarket: "结算市场",
    redeemWinner: "赎回赢家 Token",
    settlementSubmitted: "结算交易已提交",
    redeemSubmitted: "赎回交易已提交",
    oracleSubmitted: "终场比分已写入",
    marketStatus: "市场状态",
    settled: "已结算",
    notSettled: "未结算",
    winner: "赢家",
    collateral: "抵押池",
    redeemable: "可赎回",
    tokenBalances: "用户结果 Token 余额",
    noWalletForBalances: "连接钱包后显示 ARG / DRAW / BRA 余额。",
    lastPoolMetrics: "链上池指标",
    swapCount: "Swap 次数",
    totalVolume: "累计量",
    lastFee: "最近费率",
    disabledFeature: "演示占位，未接真实后端",
    whyItMatters: "为什么重要",
    whyText: "体育预测市场会在进球、红牌、点球和终场前反转时遭遇极高波动。MatchPulse 把这些信号放进 Hook 层，动态提高交易成本，降低 LP 被 toxic flow 冲击的风险。",
    validation: "验证结果",
    validationText: "合约测试 3/3 通过，前端构建通过，X Layer testnet 合约已部署，GitHub Pages 可公开访问。",
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
    agentScheduled: "市场处于启动流动性阶段。此时 Hook 仍报价基础费率，适合 LP 先为两边结果注入流动性。",
    agentFinalized: "已进入赛后结算窗口。我可以结算市场、生成赎回说明，并整理链上证明链接。",
    agentLivePrefix: "当前直播波动费率为",
    agentLiveSuffix: "拥有最高隐含价格，但 Hook 正在对胶着比分风险收费。"
  },
  en: {
    eyebrow: "X Layer Hackathon MVP",
    intro: "An international football cup prediction-market console where a v4-style Hook converts match volatility into on-chain swap fees.",
    chainName: "X Layer testnet",
    chainId: "Chain 1952",
    language: "Language",
    liveControls: "Live X Layer controls",
    connectAndWrite: "Connect wallet and write to testnet",
    stadiumSignal: "International football cup · Night match",
    broadcastMode: "Live match signal",
    liveMinute: "Match clock",
    matchRisk: "Market risk",
    crowdHeat: "Crowd heat",
    cupTicker: "Cup control desk",
    matchTimeline: "Match timeline",
    simulationMode: "Dynamic match simulation",
    simulationRunning: "Local simulation running",
    simulationPaused: "Local simulation paused",
    simulationNote: "Drives frontend match intensity, odds and Hook fee display only; real chain reads/writes still come from X Layer testnet.",
    intensity: "Intensity",
    pauseSimulation: "Pause simulation",
    resumeSimulation: "Resume simulation",
    resetSimulation: "Reset match",
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
    openDeployment: "Open deployment",
    marketTab: "Market",
    chainTab: "On-chain",
    judgeTab: "Judge view",
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
    feeCurve: "Fee curve",
    volatilityCurve: "Volatility trend",
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
    copied: "Copied",
    copyAddress: "Copy address",
    localOnly: "Local simulation",
    localOnlyNote: "This button only updates frontend price and logs. It does not send a transaction.",
    chainQuote: "On-chain Hook quote",
    chainQuoteSource: "Read from MatchPulseHook.quoteFee on X Layer testnet",
    refreshChainData: "Refresh chain data",
    chainHookTest: "On-chain Hook test tx",
    chainHookTestNote: "Calls SimulatedPoolManager.simulateSwap and triggers Hook beforeSwap / afterSwap on-chain.",
    hookTestSubmitted: "On-chain Hook test submitted",
    settlementPanel: "Testnet settlement loop",
    finalOracleWrite: "Write final score",
    finalOracleNote: "Owner wallet can call MatchOracleMock.updateMatch to finalize the testnet match at 2-1.",
    settleMarket: "Settle market",
    redeemWinner: "Redeem winner tokens",
    settlementSubmitted: "Settlement submitted",
    redeemSubmitted: "Redemption submitted",
    oracleSubmitted: "Final score submitted",
    marketStatus: "Market status",
    settled: "Settled",
    notSettled: "Open",
    winner: "Winner",
    collateral: "Collateral",
    redeemable: "Redeemable",
    tokenBalances: "User outcome token balances",
    noWalletForBalances: "Connect wallet to show ARG / DRAW / BRA balances.",
    lastPoolMetrics: "On-chain pool metrics",
    swapCount: "Swap count",
    totalVolume: "Total volume",
    lastFee: "Last fee",
    disabledFeature: "Demo placeholder, no backend action wired",
    whyItMatters: "Why it matters",
    whyText: "Sports prediction markets face extreme volatility during goals, red cards, penalties and late reversals. MatchPulse moves those signals into the Hook layer to reduce LP exposure to toxic flow.",
    validation: "Validation",
    validationText: "Contract tests pass 3/3, frontend build passes, X Layer testnet contracts are deployed, and GitHub Pages is publicly accessible.",
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
    agentScheduled: "Market is in bootstrap mode. I would ask LPs to seed both teams now because the Hook still quotes base fees.",
    agentFinalized: "is the market leader after final whistle. I can settle the market, prepare redemption copy, and publish the proof links.",
    agentLivePrefix: "Live volatility is active at",
    agentLiveSuffix: "has the strongest implied price, but the Hook is charging makers for close-score risk."
  }
} as const;

const outcomeCopy: Record<Language, Record<Outcome, string>> = {
  zh: { Argentina: "阿根廷", Draw: "平局", Brazil: "巴西" },
  en: { Argentina: "Argentina", Draw: "Draw", Brazil: "Brazil" }
};

const timeline: TimelineEntry[] = [
  {
    label: { zh: "赛前准备", en: "Pre-match" },
    detail: {
      zh: "启动流动性的成本较低，做市者可以先为双方结果注入流动性。",
      en: "Liquidity bootstrapping is cheap so makers can seed both sides."
    },
    state: { phase: "Scheduled", minute: 0, homeScore: 0, awayScore: 0, redCards: 0, upsetSignal: false }
  },
  {
    label: { zh: "开赛压力", en: "Kickoff pressure" },
    detail: {
      zh: "进入直播阶段后，第一批交易会支付更高的保护溢价。",
      en: "The first live swaps pay a higher protection premium."
    },
    state: { phase: "LiveFirstHalf", minute: 17, homeScore: 0, awayScore: 0, redCards: 0, upsetSignal: false }
  },
  {
    label: { zh: "巴西进球", en: "Brazil scores" },
    detail: {
      zh: "冷门信号被触发，套利与再定价交易量快速上升。",
      en: "The underdog signal wakes up and arbitrage volume spikes."
    },
    state: { phase: "LiveSecondHalf", minute: 61, homeScore: 0, awayScore: 1, redCards: 0, upsetSignal: true }
  },
  {
    label: { zh: "终场前红牌", en: "Late red card" },
    detail: {
      zh: "胶着比分、红牌和终场前压力叠加到同一次 Hook 报价中。",
      en: "Close score, red card and late-game pressure stack into one Hook quote."
    },
    state: { phase: "LiveSecondHalf", minute: 84, homeScore: 1, awayScore: 1, redCards: 1, upsetSignal: true }
  },
  {
    label: { zh: "终场哨响", en: "Final whistle" },
    detail: {
      zh: "赢家 Token 开始赎回，结算窗口仍保持基础保护。",
      en: "Settlement window stays protected while winning tokens are redeemed."
    },
    state: { phase: "Finalized", minute: 95, homeScore: 2, awayScore: 1, redCards: 1, upsetSignal: false }
  }
];

const initialBook: Record<Outcome, number> = { Argentina: 43, Draw: 24, Brazil: 33 };

function App() {
  const [language, setLanguage] = useState<Language>("zh");
  const [step, setStep] = useState(0);
  const [dynamicMatch, setDynamicMatch] = useState<TimelineEntry>(timeline[0]);
  const [autoSimRunning, setAutoSimRunning] = useState(true);
  const [simPulse, setSimPulse] = useState(0);
  const [book, setBook] = useState(initialBook);
  const [stake, setStake] = useState(150);
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome>("Argentina");
  const [walletAddress, setWalletAddress] = useState<HexAddress | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<string>("--");
  const [txHash, setTxHash] = useState<HexValue | null>(null);
  const [hookTxHash, setHookTxHash] = useState<HexValue | null>(null);
  const [settlementTxHash, setSettlementTxHash] = useState<HexValue | null>(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [chainQuote, setChainQuote] = useState<ChainQuote>({ feeBps: 30, volatilityScore: 0, reason: "scheduled baseline", source: "local" });
  const [tokenBalances, setTokenBalances] = useState<TokenBalances>({ Argentina: "--", Draw: "--", Brazil: "--" });
  const [poolMetricsState, setPoolMetricsState] = useState<PoolMetricsState>({
    totalVolumeUsd: "--",
    swapCount: "--",
    lastFeeBps: "--",
    lastReason: "--"
  });
  const [marketState, setMarketState] = useState<MarketState>({
    totalCollateral: "--",
    winningSupplyAtSettlement: "--",
    winner: 0,
    settled: false
  });
  const [chainReadBusy, setChainReadBusy] = useState(false);
  const [logs, setLogs] = useState<EventLog[]>(initialLogs("zh"));

  const t = copy[language];
  const match = dynamicMatch;
  const fee = useMemo(() => quoteFee(match.state), [match.state]);
  const feeSeries = useMemo(() => buildFeeSeries(language, match), [language, match]);
  const impliedPrice = book[selectedOutcome] / 100;
  const feeCost = (stake * fee.feeBps) / 10_000;
  const tokens = (stake - feeCost) / Math.max(impliedPrice, 0.01);
  const maxOutcome = Object.entries(book).sort((a, b) => b[1] - a[1])[0][0] as Outcome;
  const walletReady = Boolean(walletAddress && walletChainId === deployment.chainId);
  const providerName = getWalletProviderName();
  const explorerBase = deployment.explorer.replace(/\/$/, "");
  const intensityPercent = Math.max(8, Math.min(100, fee.volatilityScore));
  const heroStyle = {
    "--stadium-image": `url(${stadiumNightUrl})`,
    "--intensity": `${intensityPercent}%`
  } as React.CSSProperties;

  useEffect(() => {
    const provider = getWalletProvider();
    if (!provider) return;

    const handleAccounts = (accounts: unknown) => {
      const [first] = Array.isArray(accounts) ? accounts : [];
      setWalletAddress(typeof first === "string" ? (first as HexAddress) : null);
    };
    const handleChain = (chainId: unknown) => {
      if (typeof chainId === "string") setWalletChainId(Number.parseInt(chainId, 16));
    };

    provider.request({ method: "eth_accounts" }).then(handleAccounts).catch(() => undefined);
    provider.request({ method: "eth_chainId" }).then(handleChain).catch(() => undefined);
    provider.on?.("accountsChanged", handleAccounts);
    provider.on?.("chainChanged", handleChain);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccounts);
      provider.removeListener?.("chainChanged", handleChain);
    };
  }, []);

  useEffect(() => {
    setLogs((current) => (current.length > 2 ? current : initialLogs(language)));
  }, [language]);

  useEffect(() => {
    void refreshChainData();
  }, []);

  useEffect(() => {
    if (!autoSimRunning) return;

    const interval = window.setInterval(() => {
      setDynamicMatch((current) => {
        const next = nextSimulatedMatch(current);
        const nextQuote = quoteFee(next.state);
        const tone: EventLog["tone"] = nextQuote.feeBps > 100 ? "hot" : nextQuote.feeBps > baseFeeBps ? "warn" : "ok";
        setStep(nearestTimelineIndex(next.state));
        setSimPulse((value) => value + 1);
        setBook((currentBook) => adjustBookForMatch(currentBook, next.state, nextQuote.volatilityScore));
        setLogs((currentLogs) =>
          [
            {
              id: Date.now(),
              label: next.label[language],
              detail: `${next.detail[language]} ${copy[language].hookFeeLog} ${nextQuote.feeBps} bps.`,
              tone
            },
            ...currentLogs
          ].slice(0, 6)
        );
        return next;
      });
    }, simulationIntervalMs);

    return () => window.clearInterval(interval);
  }, [autoSimRunning, language]);

  useEffect(() => {
    const provider = getWalletProvider();
    if (!provider || !walletAddress) {
      setWalletBalance("--");
      setTokenBalances({ Argentina: "--", Draw: "--", Brazil: "--" });
      return;
    }

    provider
      .request({ method: "eth_getBalance", params: [walletAddress, "latest"] })
      .then((balance) => {
        if (typeof balance === "string") setWalletBalance(Number(formatEther(BigInt(balance))).toFixed(4));
      })
      .catch(() => setWalletBalance("--"));
    void refreshTokenBalances(walletAddress);
  }, [walletAddress, walletChainId]);

  function advance() {
    const next = (step + 1) % timeline.length;
    setStep(next);
    setDynamicMatch(timeline[next]);
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

  function resetSimulation() {
    setStep(0);
    setDynamicMatch(timeline[0]);
    setBook(initialBook);
    setAutoSimRunning(true);
    setSimPulse((value) => value + 1);
    const log: EventLog = {
      id: Date.now(),
      label: t.simulationMode,
      detail: language === "zh" ? "比赛已回到赛前状态，动态模拟重新启动。" : "Match reset to pre-match and dynamic simulation restarted.",
      tone: "ok"
    };
    setLogs((current) =>
      [
        log,
        ...current
      ].slice(0, 6)
    );
  }

  function trade(outcome: Outcome) {
    setSelectedOutcome(outcome);
    const impact = Math.min(7, Math.max(1.4, stake / 75));
    const tone: EventLog["tone"] = fee.feeBps > 100 ? "hot" : "warn";
    setBook((current) => normalizeBook({ ...current, [outcome]: current[outcome] + impact }));
    toast.message(t.swapSimulated, {
      description:
        language === "zh"
          ? `${outcomeCopy.zh[outcome]} ${t.buyRouted} ${fee.feeBps} bps。`
          : `${outcomeCopy.en[outcome]} ${t.buyRouted} ${fee.feeBps} bps.`
    });
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

  async function refreshChainData() {
    setChainReadBusy(true);
    try {
      const [quote, metrics, market] = await Promise.all([
        publicClient.readContract({
          address: deployment.contracts.MatchPulseHook as HexAddress,
          abi: hookAbi,
          functionName: "quoteFee",
          args: [deployment.matchId as HexValue, baseFeeBps]
        }),
        publicClient.readContract({
          address: deployment.contracts.MatchPulseHook as HexAddress,
          abi: hookAbi,
          functionName: "poolMetrics",
          args: [poolId]
        }),
        publicClient.readContract({
          address: deployment.contracts.WorldCupMarketFactory as HexAddress,
          abi: factoryAbi,
          functionName: "markets",
          args: [deployment.matchId as HexValue]
        })
      ]);
      setChainQuote({
        feeBps: Number(quote[0]),
        volatilityScore: Number(quote[1]),
        reason: quote[2],
        source: "chain"
      });
      setPoolMetricsState({
        totalVolumeUsd: metrics[0].toString(),
        swapCount: metrics[1].toString(),
        lastFeeBps: metrics[2].toString(),
        lastReason: metrics[5] || "--"
      });
      setMarketState({
        totalCollateral: formatEther(market[4]),
        winningSupplyAtSettlement: formatEther(market[5]),
        winner: Number(market[6]),
        settled: Boolean(market[8])
      });
      if (walletAddress) await refreshTokenBalances(walletAddress);
    } catch (error) {
      toast.error(readError(error, language));
    } finally {
      setChainReadBusy(false);
    }
  }

  async function refreshTokenBalances(address: HexAddress) {
    try {
      const results = await publicClient.multicall({
        contracts: [
          {
            address: deployment.predictionTokens.Argentina as HexAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address]
          },
          {
            address: deployment.predictionTokens.Draw as HexAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address]
          },
          {
            address: deployment.predictionTokens.Brazil as HexAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [address]
          }
        ],
        allowFailure: false
      });
      setTokenBalances({
        Argentina: formatUnits(results[0], 18),
        Draw: formatUnits(results[1], 18),
        Brazil: formatUnits(results[2], 18)
      });
    } catch {
      setTokenBalances({ Argentina: "--", Draw: "--", Brazil: "--" });
    }
  }

  async function connectWallet() {
    setWalletError(null);
    const provider = getWalletProvider();
    if (!provider) {
      setWalletError(t.noWallet);
      toast.error(t.noWallet);
      return;
    }
    setWalletBusy(true);
    const id = toast.loading(t.connectWallet);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const chainId = (await provider.request({ method: "eth_chainId" })) as string;
      setWalletAddress((accounts[0] as HexAddress) ?? null);
      setWalletChainId(Number.parseInt(chainId, 16));
      if (accounts[0]) await refreshTokenBalances(accounts[0] as HexAddress);
      toast.success(t.connected, { id, description: shortHash(accounts[0] ?? "") });
    } catch (error) {
      const message = readError(error, language);
      setWalletError(message);
      toast.error(message, { id });
    } finally {
      setWalletBusy(false);
    }
  }

  async function switchToXLayer() {
    setWalletError(null);
    const provider = getWalletProvider();
    if (!provider) {
      setWalletError(t.noWallet);
      toast.error(t.noWallet);
      return;
    }
    setWalletBusy(true);
    const id = toast.loading(t.switchNetwork);
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x7a0" }] });
      setWalletChainId(deployment.chainId);
      toast.success(t.chainName, { id });
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
        toast.success(t.chainName, { id });
      } else {
        const message = readError(error, language);
        setWalletError(message);
        toast.error(message, { id });
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
      toast.error(t.noWallet);
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
    const id = toast.loading(t.waitingWallet);
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
      toast.success(t.submitted, { id, description: shortHash(hash) });
      await publicClient.waitForTransactionReceipt({ hash });
      await refreshChainData();
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
      const message = readError(error, language);
      setWalletError(message);
      toast.error(message, { id });
    } finally {
      setWalletBusy(false);
    }
  }

  async function simulateHookOnChain() {
    setWalletError(null);
    setHookTxHash(null);
    const provider = getWalletProvider();
    if (!provider) {
      setWalletError(t.noWallet);
      toast.error(t.noWallet);
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
    const id = toast.loading(t.chainHookTest);
    try {
      const client = createWalletClient({
        account: walletAddress,
        chain: xLayerTestnet,
        transport: custom(provider)
      });
      const hash = await client.writeContract({
        address: deployment.contracts.SimulatedPoolManager as HexAddress,
        abi: poolManagerAbi,
        functionName: "simulateSwap",
        args: [poolId, selectedOutcome !== "Brazil", parseEther("1"), BigInt(Math.max(1, Math.round(stake)))]
      });
      setHookTxHash(hash);
      toast.success(t.hookTestSubmitted, { id, description: shortHash(hash) });
      await publicClient.waitForTransactionReceipt({ hash });
      await refreshChainData();
      const tone: EventLog["tone"] = "ok";
      setLogs((current) =>
        [
          {
            id: Date.now(),
            label: t.chainHookTest,
            detail: `${t.hookTestSubmitted}: ${shortHash(hash)}.`,
            tone
          },
          ...current
        ].slice(0, 6)
      );
    } catch (error) {
      const message = readError(error, language);
      setWalletError(message);
      toast.error(message, { id });
    } finally {
      setWalletBusy(false);
    }
  }

  async function writeFinalScoreOnChain() {
    setWalletError(null);
    setSettlementTxHash(null);
    const provider = getWalletProvider();
    if (!provider) {
      setWalletError(t.noWallet);
      toast.error(t.noWallet);
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
    const id = toast.loading(t.finalOracleWrite);
    try {
      const client = createWalletClient({
        account: walletAddress,
        chain: xLayerTestnet,
        transport: custom(provider)
      });
      const hash = await client.writeContract({
        address: deployment.contracts.MatchOracleMock as HexAddress,
        abi: oracleAbi,
        functionName: "updateMatch",
        args: [deployment.matchId as HexValue, 6, 95, 2, 1, 0, false]
      });
      setSettlementTxHash(hash);
      toast.success(t.oracleSubmitted, { id, description: shortHash(hash) });
      await publicClient.waitForTransactionReceipt({ hash });
      await refreshChainData();
      const log: EventLog = {
        id: Date.now(),
        label: t.finalOracleWrite,
        detail: `${t.oracleSubmitted}: ${shortHash(hash)}.`,
        tone: "ok"
      };
      setLogs((current) =>
        [
          log,
          ...current
        ].slice(0, 6)
      );
    } catch (error) {
      const message = readError(error, language);
      setWalletError(message);
      toast.error(message, { id });
    } finally {
      setWalletBusy(false);
    }
  }

  async function settleOnXLayer() {
    setWalletError(null);
    setSettlementTxHash(null);
    const provider = getWalletProvider();
    if (!provider) {
      setWalletError(t.noWallet);
      toast.error(t.noWallet);
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
    const id = toast.loading(t.settleMarket);
    try {
      const client = createWalletClient({
        account: walletAddress,
        chain: xLayerTestnet,
        transport: custom(provider)
      });
      const hash = await client.writeContract({
        address: deployment.contracts.WorldCupMarketFactory as HexAddress,
        abi: factoryAbi,
        functionName: "settle",
        args: [deployment.matchId as HexValue]
      });
      setSettlementTxHash(hash);
      toast.success(t.settlementSubmitted, { id, description: shortHash(hash) });
      await publicClient.waitForTransactionReceipt({ hash });
      await refreshChainData();
      const log: EventLog = {
        id: Date.now(),
        label: t.settleMarket,
        detail: `${t.settlementSubmitted}: ${shortHash(hash)}.`,
        tone: "ok"
      };
      setLogs((current) =>
        [
          log,
          ...current
        ].slice(0, 6)
      );
    } catch (error) {
      const message = readError(error, language);
      setWalletError(message);
      toast.error(message, { id });
    } finally {
      setWalletBusy(false);
    }
  }

  async function redeemOnXLayer() {
    setWalletError(null);
    setSettlementTxHash(null);
    const provider = getWalletProvider();
    if (!provider) {
      setWalletError(t.noWallet);
      toast.error(t.noWallet);
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
    if (!marketState.settled) {
      toast.error(t.notSettled);
      return;
    }

    const winningOutcome = outcomeFromWinner(marketState.winner);
    const balance = tokenBalances[winningOutcome];
    if (balance === "--" || Number(balance) <= 0) {
      toast.error(language === "zh" ? "当前钱包没有赢家 Token 可赎回。" : "Current wallet has no winning tokens to redeem.");
      return;
    }

    setWalletBusy(true);
    const id = toast.loading(t.redeemWinner);
    try {
      const client = createWalletClient({
        account: walletAddress,
        chain: xLayerTestnet,
        transport: custom(provider)
      });
      const hash = await client.writeContract({
        address: deployment.contracts.WorldCupMarketFactory as HexAddress,
        abi: factoryAbi,
        functionName: "redeem",
        args: [deployment.matchId as HexValue, parseEther(balance)]
      });
      setSettlementTxHash(hash);
      toast.success(t.redeemSubmitted, { id, description: shortHash(hash) });
      await publicClient.waitForTransactionReceipt({ hash });
      await refreshChainData();
      const log: EventLog = {
        id: Date.now(),
        label: t.redeemWinner,
        detail: `${t.redeemSubmitted}: ${shortHash(hash)}.`,
        tone: "ok"
      };
      setLogs((current) =>
        [
          log,
          ...current
        ].slice(0, 6)
      );
    } catch (error) {
      const message = readError(error, language);
      setWalletError(message);
      toast.error(message, { id });
    } finally {
      setWalletBusy(false);
    }
  }

  return (
    <Tooltip.Provider delayDuration={160}>
      <main className="shell">
        <Toaster richColors position="top-right" />

        <motion.section
          className={`heroConsole ${autoSimRunning ? "simLive" : ""}`}
          style={heroStyle}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="stadiumWash" aria-hidden="true" />
          <div className="topbar">
            <div className="titleBlock">
              <div className="eyebrow">
                <Radio size={15} />
                {t.stadiumSignal}
              </div>
              <h1>MatchPulse</h1>
              <p>{t.intro}</p>
              <div className={`cupTicker ${autoSimRunning ? "isLive" : ""}`} aria-label={t.cupTicker}>
                <span>ARG</span>
                <strong>{match.state.homeScore}</strong>
                <i />
                <strong>{match.state.awayScore}</strong>
                <span>BRA</span>
                <em>{match.state.minute || "00"}'</em>
              </div>
            </div>

            <div className="topControls">
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
            </div>
          </div>

          <div className="broadcastRail">
            <StatTile label={t.broadcastMode} value={t.phase[match.state.phase]} />
            <StatTile label={t.liveMinute} value={`${match.state.minute || "00"}'`} />
            <StatTile label={t.matchRisk} value={`${fee.feeBps} bps`} />
            <StatTile label={t.crowdHeat} value={crowdHeatLabel(fee.volatilityScore, language)} />
          </div>

          <div className="simulationDeck">
            <div className="simulationCopy">
              <span>{t.simulationMode}</span>
              <strong>{autoSimRunning ? t.simulationRunning : t.simulationPaused}</strong>
              <small>{t.simulationNote}</small>
            </div>
            <div className="intensityBlock">
              <div className="intensityHeader">
                <span>{t.intensity}</span>
                <strong>{intensityPercent}%</strong>
              </div>
              <div className="intensityTrack" aria-hidden="true">
                <i key={simPulse} />
              </div>
            </div>
            <div className="simulationActions">
              <button type="button" className="secondaryButton" onClick={() => setAutoSimRunning((value) => !value)}>
                <Activity size={16} />
                {autoSimRunning ? t.pauseSimulation : t.resumeSimulation}
              </button>
              <button type="button" className="secondaryButton" onClick={resetSimulation}>
                <RefreshCw size={16} />
                {t.resetSimulation}
              </button>
            </div>
          </div>

          <div className="commandBar">
            <div className="commandStatus">
              <span>{t.liveControls}</span>
              <strong>{walletReady && walletAddress ? `${t.connected} ${shortHash(walletAddress)}` : t.connectAndWrite}</strong>
              <small>{walletError ? walletError : providerName ? `${t.detected} ${providerName}` : t.noWalletDetected}</small>
            </div>

            <a
              className="factoryPill"
              href={`${explorerBase}/address/${deployment.contracts.WorldCupMarketFactory}`}
              target="_blank"
              rel="noreferrer"
            >
              {t.factory} {shortHash(deployment.contracts.WorldCupMarketFactory)}
              <ArrowUpRight size={15} />
            </a>

            <div className="commandActions">
              <TipButton tip={t.connectWallet} onClick={connectWallet} disabled={walletBusy}>
                <PlugZap size={17} />
                {walletAddress ? t.reconnect : t.connect}
              </TipButton>
              <TipButton tip={t.switchNetwork} onClick={switchToXLayer} disabled={walletBusy}>
                <Landmark size={17} />
                {t.xLayer}
              </TipButton>
              <TipButton tip={t.mintCompleteSet} variant="hot" onClick={mintOnXLayer} disabled={walletBusy}>
                <Zap size={17} />
                {walletBusy ? t.waiting : t.mintSet}
              </TipButton>
            </div>
          </div>
        </motion.section>

        <Tabs.Root defaultValue="market" className="workspaceTabs">
          <Tabs.List className="tabList" aria-label="MatchPulse sections">
            <Tabs.Trigger value="market">{t.marketTab}</Tabs.Trigger>
            <Tabs.Trigger value="chain">{t.chainTab}</Tabs.Trigger>
            <Tabs.Trigger value="judge">{t.judgeTab}</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="market" className="tabContent">
            <section className="marketGrid">
              <motion.div className="matchArena panelSurface" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="boardHeader">
                  <div>
                    <span>{t.quarterFinal}</span>
                    <h2>{t.matchTitle}</h2>
                  </div>
                  <TipButton iconOnly tip={t.advanceLabel} onClick={advance}>
                    <RefreshCw size={18} />
                  </TipButton>
                </div>

                <div className="teamRibbon" aria-hidden="true">
                  <span className="ribbonArgentina" />
                  <span className="ribbonNeutral" />
                  <span className="ribbonBrazil" />
                </div>

                <div className="scoreStrip">
                  <Team name={outcomeCopy[language].Argentina} score={match.state.homeScore} active={maxOutcome === "Argentina"} />
                  <div className="clock">
                    <strong>{match.state.minute || "00"}'</strong>
                    <span>{t.phase[match.state.phase]}</span>
                  </div>
                  <Team name={outcomeCopy[language].Brazil} score={match.state.awayScore} active={maxOutcome === "Brazil"} />
                </div>

                <div className="matchTimeline">
                  <div className="timelineTitle">
                    <Clock3 size={15} />
                    <span>{t.matchTimeline}</span>
                  </div>
                  <div className="timelineTrack">
                    {timeline.map((item, index) => (
                      <button
                        key={item.label.en}
                        type="button"
                        className={`timelineNode ${index === step ? "active" : ""} ${index < step ? "passed" : ""}`}
                        onClick={() => {
                          setStep(index);
                          setDynamicMatch(timeline[index]);
                          const quote = quoteFee(timeline[index].state);
                          const tone: EventLog["tone"] = quote.feeBps > 100 ? "hot" : quote.feeBps > baseFeeBps ? "warn" : "ok";
                          setLogs((current) =>
                            [
                              {
                                id: Date.now(),
                                label: timeline[index].label[language],
                                detail: `${t.hookFeeLog} ${quote.feeBps} bps: ${translateFeeReason(quote.reason, language)}.`,
                                tone
                              },
                              ...current
                            ].slice(0, 6)
                          );
                        }}
                        aria-label={item.label[language]}
                      >
                        <span>{item.state.minute || 0}'</span>
                        <strong>{item.label[language]}</strong>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="eventCard">
                  <div>
                    <span>{t.currentEvent}</span>
                    <strong>{match.label[language]}</strong>
                    <p>{match.detail[language]}</p>
                  </div>
                  <Activity size={28} />
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
              </motion.div>

              <aside className="hookPanel panelSurface">
                <PanelTitle icon={<Zap size={18} />} label={t.hookEngine} />
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
                <div className="chainQuoteBox">
                  <span>{t.chainQuote}</span>
                  <strong>{chainQuote.feeBps} bps</strong>
                  <small>{translateFeeReason(chainQuote.reason, language)} · {t.chainQuoteSource}</small>
                </div>
                <div className="guardrail">
                  <ShieldCheck size={18} />
                  <span>{t.guardrail}</span>
                </div>
              </aside>

              <section className="chartPanel panelSurface">
                <PanelTitle icon={<LineChartIcon size={18} />} label={t.feeCurve} />
                <div className="chartBox">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={feeSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#dfe7de" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                      <YAxis width={38} tick={{ fontSize: 11 }} />
                      <ChartTooltip />
                      <Line type="monotone" dataKey="fee" stroke="#ef6a3a" strokeWidth={3} dot={{ r: 4 }} name="fee bps" />
                      <Line type="monotone" dataKey="volatility" stroke="#247c67" strokeWidth={2} dot={{ r: 3 }} name="volatility" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="tradePanel panelSurface">
                <PanelTitle icon={<CircleDollarSign size={18} />} label={t.tradeSimulator} />
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
                  <StatTile label={t.selected} value={outcomeCopy[language][selectedOutcome]} />
                  <StatTile label={t.stake} value={`$${stake.toFixed(0)}`} />
                  <StatTile label={t.hookFee} value={`$${feeCost.toFixed(2)}`} />
                  <StatTile label={t.outcomeTokens} value={tokens.toFixed(2)} />
                </div>
                <button type="button" className="primaryButton" onClick={() => trade(selectedOutcome)}>
                  <Activity size={18} />
                  {t.localOnly}: {t.simulateSwap}
                </button>
                <p className="walletNote">{t.localOnlyNote}</p>
              </section>

              <section className="agentPanel panelSurface">
                <PanelTitle icon={<Bot size={18} />} label={t.agent} />
                <div className="agentBubble">{agentCopy(match.state, fee.feeBps, maxOutcome, language)}</div>
                <div className="agentActions">
                  <button type="button" disabled title={t.disabledFeature}>{t.createMatch}</button>
                  <button type="button" disabled title={t.disabledFeature}>{t.explainFee}</button>
                  <button type="button" disabled title={t.disabledFeature}>{t.publishRecap}</button>
                </div>
              </section>

              <section className="logPanel panelSurface">
                <PanelTitle icon={<Gauge size={18} />} label={t.recentEvents} />
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
          </Tabs.Content>

          <Tabs.Content value="chain" className="tabContent">
            <section className="chainGrid">
              <section className="walletPanel panelSurface">
                <PanelTitle icon={<Wallet size={18} />} label={t.walletWrite} />
                <div className="walletStatus">
                  <StatTile label={t.wallet} value={walletAddress ? shortHash(walletAddress) : t.notConnected} />
                  <StatTile label={t.chain} value={walletChainId ? String(walletChainId) : "--"} />
                  <StatTile label={t.balance} value={`${walletBalance} OKB`} />
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
                <button type="button" className="secondaryButton fullWidth" onClick={simulateHookOnChain} disabled={walletBusy}>
                  <Activity size={17} />
                  {t.chainHookTest}
                </button>
                <button type="button" className="secondaryButton fullWidth" onClick={refreshChainData} disabled={chainReadBusy}>
                  <RefreshCw size={17} />
                  {chainReadBusy ? t.waiting : t.refreshChainData}
                </button>
                <p className="walletNote">{t.walletNote}</p>
                {walletError ? <div className="walletError">{walletError}</div> : null}
                {txHash ? (
                  <a className="txLink" href={`${explorerBase}/tx/${txHash}`} target="_blank" rel="noreferrer">
                    {t.viewTransaction} <ExternalLink size={14} />
                  </a>
                ) : null}
                {hookTxHash ? (
                  <a className="txLink" href={`${explorerBase}/tx/${hookTxHash}`} target="_blank" rel="noreferrer">
                    {t.chainHookTest} <ExternalLink size={14} />
                  </a>
                ) : null}
              </section>

              <section className="panelSurface chainReadPanel">
                <PanelTitle icon={<Gauge size={18} />} label={t.tokenBalances} />
                <div className="walletStatus">
                  <StatTile label={outcomeCopy[language].Argentina} value={tokenBalances.Argentina === "--" ? "--" : Number(tokenBalances.Argentina).toFixed(4)} />
                  <StatTile label={outcomeCopy[language].Draw} value={tokenBalances.Draw === "--" ? "--" : Number(tokenBalances.Draw).toFixed(4)} />
                  <StatTile label={outcomeCopy[language].Brazil} value={tokenBalances.Brazil === "--" ? "--" : Number(tokenBalances.Brazil).toFixed(4)} />
                </div>
                <p className="walletNote">{walletAddress ? t.chainQuoteSource : t.noWalletForBalances}</p>
              </section>

              <section className="panelSurface chainReadPanel">
                <PanelTitle icon={<BarChart3 size={18} />} label={t.lastPoolMetrics} />
                <div className="walletStatus">
                  <StatTile label={t.swapCount} value={poolMetricsState.swapCount} />
                  <StatTile label={t.totalVolume} value={poolMetricsState.totalVolumeUsd} />
                  <StatTile label={t.lastFee} value={poolMetricsState.lastFeeBps === "--" ? "--" : `${poolMetricsState.lastFeeBps} bps`} />
                </div>
                <p className="walletNote">{poolMetricsState.lastReason === "--" ? t.chainHookTestNote : translateFeeReason(poolMetricsState.lastReason, language)}</p>
              </section>

              <section className="panelSurface settlementPanel">
                <PanelTitle icon={<CheckCircle2 size={18} />} label={t.settlementPanel} />
                <div className="walletStatus">
                  <StatTile label={t.marketStatus} value={marketState.settled ? t.settled : t.notSettled} />
                  <StatTile label={t.collateral} value={marketState.totalCollateral === "--" ? "--" : `${formatDecimal(marketState.totalCollateral)} OKB`} />
                  <StatTile label={t.winner} value={marketState.settled ? outcomeCopy[language][outcomeFromWinner(marketState.winner)] : "--"} />
                </div>
                <div className="walletStatus settlementStats">
                  <StatTile label={t.redeemable} value={marketState.settled ? redeemableBalanceLabel(tokenBalances, marketState.winner) : "--"} />
                  <StatTile
                    label={t.outcomeTokens}
                    value={marketState.winningSupplyAtSettlement === "--" ? "--" : `${formatDecimal(marketState.winningSupplyAtSettlement)}`}
                  />
                </div>
                <div className="walletActions threeActions">
                  <button type="button" className="secondaryButton" onClick={writeFinalScoreOnChain} disabled={walletBusy}>
                    <Radio size={17} />
                    {t.finalOracleWrite}
                  </button>
                  <button type="button" className="secondaryButton" onClick={settleOnXLayer} disabled={walletBusy || marketState.settled}>
                    <CheckCircle2 size={17} />
                    {t.settleMarket}
                  </button>
                  <button type="button" className="primaryButton noTopMargin" onClick={redeemOnXLayer} disabled={walletBusy || !marketState.settled}>
                    <CircleDollarSign size={17} />
                    {t.redeemWinner}
                  </button>
                </div>
                <p className="walletNote">{t.finalOracleNote}</p>
                {settlementTxHash ? (
                  <a className="txLink" href={`${explorerBase}/tx/${settlementTxHash}`} target="_blank" rel="noreferrer">
                    {t.settlementPanel} <ExternalLink size={14} />
                  </a>
                ) : null}
              </section>

              <DeploymentPanel language={language} />
            </section>
          </Tabs.Content>

          <Tabs.Content value="judge" className="tabContent">
            <section className="judgeGrid">
              <div className="panelSurface judgePanel">
                <PanelTitle icon={<ShieldCheck size={18} />} label={t.whyItMatters} />
                <p>{t.whyText}</p>
              </div>
              <div className="panelSurface judgePanel">
                <PanelTitle icon={<CheckCircle2 size={18} />} label={t.validation} />
                <p>{t.validationText}</p>
              </div>
              <div className="panelSurface judgeChart">
                <PanelTitle icon={<BarChart3 size={18} />} label={t.volatilityCurve} />
                <div className="chartBox mini">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={feeSeries}>
                      <defs>
                        <linearGradient id="volatility" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#ef6a3a" stopOpacity={0.42} />
                          <stop offset="95%" stopColor="#ef6a3a" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                      <YAxis width={36} tick={{ fontSize: 11 }} />
                      <Area type="monotone" dataKey="fee" stroke="#ef6a3a" fill="url(#volatility)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          </Tabs.Content>
        </Tabs.Root>
      </main>
    </Tooltip.Provider>
  );
}

function DeploymentPanel({ language }: { language: Language }) {
  const t = copy[language];
  return (
    <section className="deployPanel panelSurface">
      <PanelTitle icon={<Landmark size={18} />} label={t.liveDeployment} />
      <div className="addressList">
        <AddressRow label={t.factory} value={deployment.contracts.WorldCupMarketFactory} language={language} />
        <AddressRow label="Hook" value={deployment.contracts.MatchPulseHook} language={language} />
        <AddressRow label={t.poolManager} value={deployment.contracts.SimulatedPoolManager} language={language} />
        <AddressRow label="ARG token" value={deployment.predictionTokens.Argentina} language={language} />
        <AddressRow label="DRAW token" value={deployment.predictionTokens.Draw} language={language} />
        <AddressRow label="BRA token" value={deployment.predictionTokens.Brazil} language={language} />
      </div>
      <Dialog.Root>
        <Dialog.Trigger asChild>
          <button type="button" className="secondaryButton fullWidth">
            <ExternalLink size={17} />
            {t.openDeployment}
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="dialogOverlay" />
          <Dialog.Content className="dialogContent">
            <div className="dialogHeader">
              <Dialog.Title>{t.liveDeployment}</Dialog.Title>
              <Dialog.Close className="dialogClose" aria-label="Close">
                <X size={18} />
              </Dialog.Close>
            </div>
            <pre>{JSON.stringify(deployment, null, 2)}</pre>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}

function AddressRow({ label, value, language }: { label: string; value: string; language: Language }) {
  const explorerBase = deployment.explorer.replace(/\/$/, "");
  function copyAddress(event: React.MouseEvent) {
    event.preventDefault();
    navigator.clipboard?.writeText(value);
    toast.success(copy[language].copied, { description: shortHash(value) });
  }
  return (
    <a className="addressRow" href={`${explorerBase}/address/${value}`} target="_blank" rel="noreferrer">
      <span>{label}</span>
      <strong>{shortHash(value)}</strong>
      <button type="button" onClick={copyAddress} aria-label={copy[language].copyAddress}>
        <ExternalLink size={13} />
      </button>
    </a>
  );
}

function TipButton({
  children,
  tip,
  onClick,
  disabled,
  variant,
  iconOnly
}: {
  children: React.ReactNode;
  tip: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "hot";
  iconOnly?: boolean;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          type="button"
          className={`${iconOnly ? "iconButton" : "chainActionButton"} ${variant === "hot" ? "hot" : ""}`}
          onClick={onClick}
          disabled={disabled}
          aria-label={tip}
        >
          {children}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltipContent" sideOffset={8}>
          {tip}
          <Tooltip.Arrow className="tooltipArrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function PanelTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="panelTitle">
      {icon}
      <span>{label}</span>
    </div>
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

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="statTile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function nextSimulatedMatch(current: TimelineEntry): TimelineEntry {
  const state = current.state;
  if (state.phase === "Finalized") {
    return {
      label: { zh: "新一场开赛", en: "New match kickoff" },
      detail: {
        zh: "新一轮杯赛模拟开始，比分和红牌状态已清零。",
        en: "A fresh cup simulation starts with score and red-card state reset."
      },
      state: { phase: "Scheduled", minute: 0, homeScore: 0, awayScore: 0, redCards: 0, upsetSignal: false }
    };
  }

  const minute = Math.min(95, state.minute + randomInt(4, 9));
  const phase = phaseForMinute(minute);
  const live = phase !== "Scheduled" && phase !== "Finalized" && phase !== "HalfTime";
  const late = minute >= 75;
  const close = Math.abs(state.homeScore - state.awayScore) <= 1;
  const goalChance = live ? (late && close ? 0.24 : 0.12) : 0;
  const redChance = live && state.redCards < 2 ? (late ? 0.08 : 0.04) : 0;
  let homeScore = state.homeScore;
  let awayScore = state.awayScore;
  let redCards = state.redCards;

  const eventRoll = Math.random();
  if (eventRoll < goalChance) {
    if (Math.random() < 0.53) homeScore += 1;
    else awayScore += 1;
  }
  if (Math.random() < redChance) redCards += 1;

  const upsetSignal = live && (awayScore > homeScore || (minute >= 58 && awayScore === homeScore && Math.random() < 0.52));
  const nextState: MatchState = {
    phase,
    minute,
    homeScore,
    awayScore,
    redCards,
    upsetSignal
  };

  return {
    label: simulatedLabel(nextState),
    detail: simulatedDetail(nextState),
    state: nextState
  };
}

function phaseForMinute(minute: number): MatchState["phase"] {
  if (minute <= 0) return "Scheduled";
  if (minute < 45) return "LiveFirstHalf";
  if (minute < 50) return "HalfTime";
  if (minute < 91) return "LiveSecondHalf";
  return "Finalized";
}

function simulatedLabel(state: MatchState): Record<Language, string> {
  if (state.phase === "Finalized") return { zh: "终场哨响", en: "Final whistle" };
  if (state.phase === "HalfTime") return { zh: "中场调整", en: "Half-time reset" };
  if (state.redCards > 0 && state.minute >= 70) return { zh: "红牌后高压", en: "Red-card pressure" };
  if (state.upsetSignal) return { zh: "冷门信号升温", en: "Upset signal rising" };
  if (state.minute >= 75) return { zh: "终场前冲刺", en: "Late match surge" };
  if (Math.abs(state.homeScore - state.awayScore) <= 1 && state.minute > 0) return { zh: "胶着拉锯", en: "Close-score tension" };
  return { zh: "比赛推进", en: "Match flow" };
}

function simulatedDetail(state: MatchState): Record<Language, string> {
  const score = `${state.homeScore}-${state.awayScore}`;
  if (state.phase === "Finalized") {
    return {
      zh: `终场比分 ${score}，市场进入结果赎回和结算观察。`,
      en: `Final score ${score}; the market moves into redemption and settlement watch.`
    };
  }
  if (state.redCards > 0) {
    return {
      zh: `${state.minute}' 出现红牌压力，比分 ${score}，LP 保护费率上调。`,
      en: `${state.minute}' red-card pressure at ${score}; LP protection fees step up.`
    };
  }
  if (state.upsetSignal) {
    return {
      zh: `${state.minute}' 冷门交易流升温，比分 ${score}，市场重新定价。`,
      en: `${state.minute}' upset flow is heating up at ${score}; markets reprice.`
    };
  }
  if (state.minute >= 75) {
    return {
      zh: `${state.minute}' 进入终场前窗口，比分 ${score}，交易强度抬升。`,
      en: `${state.minute}' enters the late window at ${score}; trading intensity rises.`
    };
  }
  return {
    zh: `${state.minute}' 比赛持续推进，比分 ${score}，动态费率跟随现场压力变化。`,
    en: `${state.minute}' match flow continues at ${score}; dynamic fees track live pressure.`
  };
}

function nearestTimelineIndex(state: MatchState) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  timeline.forEach((item, index) => {
    const distance = Math.abs(item.state.minute - state.minute);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function adjustBookForMatch(current: Record<Outcome, number>, state: MatchState, volatilityScore: number) {
  const pressure = 0.5 + volatilityScore / 38;
  const winner: Outcome = state.homeScore > state.awayScore ? "Argentina" : state.awayScore > state.homeScore ? "Brazil" : "Draw";
  const next = { ...current };

  if (winner === "Draw") {
    next.Draw += 1.4 * pressure;
    next.Argentina += state.upsetSignal ? 0.3 : 0.7;
    next.Brazil += state.upsetSignal ? 0.9 : 0.5;
  } else {
    next[winner] += 1.8 * pressure;
    next.Draw += Math.max(0.2, 0.8 - pressure * 0.08);
    const trailing = winner === "Argentina" ? "Brazil" : "Argentina";
    next[trailing] += state.minute >= 75 ? -0.6 : 0.2;
  }

  if (state.redCards > 0) next.Draw += 0.45 * state.redCards;
  return normalizeBook({
    Argentina: Math.max(6, next.Argentina),
    Draw: Math.max(5, next.Draw),
    Brazil: Math.max(6, next.Brazil)
  });
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function outcomeFromWinner(winner: number): Outcome {
  if (winner === 1) return "Draw";
  if (winner === 2) return "Brazil";
  return "Argentina";
}

function redeemableBalanceLabel(balances: TokenBalances, winner: number) {
  const outcome = outcomeFromWinner(winner);
  const balance = balances[outcome];
  return balance === "--" ? "--" : `${formatDecimal(balance)} ${outcome === "Argentina" ? "ARG" : outcome === "Brazil" ? "BRA" : "DRAW"}`;
}

function formatDecimal(value: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  if (numeric === 0) return "0";
  if (numeric < 0.0001) return numeric.toExponential(2);
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function crowdHeatLabel(score: number, language: Language) {
  if (language === "zh") return score > 60 ? "高热" : score > 20 ? "升温" : "平稳";
  return score > 60 ? "HOT" : score > 20 ? "ACTIVE" : "CALM";
}

function normalizeBook(next: Record<Outcome, number>) {
  const total = Object.values(next).reduce((sum, value) => sum + value, 0);
  return {
    Argentina: (next.Argentina / total) * 100,
    Draw: (next.Draw / total) * 100,
    Brazil: (next.Brazil / total) * 100
  };
}

function agentCopy(state: MatchState, feeBps: number, leader: Outcome, language: Language) {
  const t = copy[language];
  if (state.phase === "Scheduled") return t.agentScheduled;
  if (state.phase === "Finalized") {
    if (language === "zh") return `${outcomeCopy.zh[leader]} 是终场后的市场领先结果。${t.agentFinalized}`;
    return `${outcomeCopy.en[leader]} ${t.agentFinalized}`;
  }
  if (language === "zh") return `${t.agentLivePrefix} ${feeBps} bps。${outcomeCopy.zh[leader]} ${t.agentLiveSuffix}`;
  return `${t.agentLivePrefix} ${feeBps} bps. ${outcomeCopy.en[leader]} ${t.agentLiveSuffix}`;
}

function shortHash(value: string) {
  if (!value) return "--";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function readError(error: unknown, language: Language) {
  if (typeof error === "object" && error && "shortMessage" in error && typeof error.shortMessage === "string") {
    return error.shortMessage;
  }
  if (error instanceof Error) return error.message;
  return copy[language].walletFailed;
}

function translateFeeReason(reason: string, language: Language) {
  const reasons = copy[language].feeReasons as Record<string, string>;
  return reasons[reason] ?? reason;
}

function initialLogs(language: Language): EventLog[] {
  const t = copy[language];
  return [
    { id: 1, label: t.marketFactory, detail: t.marketFactoryDetail, tone: "ok" },
    { id: 2, label: t.hookBound, detail: t.hookBoundDetail, tone: "ok" }
  ];
}

function buildFeeSeries(language: Language, liveMatch: TimelineEntry) {
  const series = timeline.map((item) => {
    const quote = quoteFee(item.state);
    return {
      name: item.label[language],
      minute: item.state.minute,
      fee: quote.feeBps,
      volatility: quote.volatilityScore
    };
  });
  const liveQuote = quoteFee(liveMatch.state);
  if (!timeline.some((item) => item.state.minute === liveMatch.state.minute && item.state.phase === liveMatch.state.phase)) {
    series.push({
      name: language === "zh" ? `实时 ${liveMatch.state.minute}'` : `Live ${liveMatch.state.minute}'`,
      minute: liveMatch.state.minute,
      fee: liveQuote.feeBps,
      volatility: liveQuote.volatilityScore
    });
  }
  return series.sort((a, b) => a.minute - b.minute);
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
