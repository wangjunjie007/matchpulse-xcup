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
  BrainCircuit,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileImage,
  Gauge,
  Landmark,
  Languages,
  Link2,
  LineChart as LineChartIcon,
  MessageCircle,
  Network,
  PlugZap,
  Radio,
  Radar,
  RefreshCw,
  ScanEye,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
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
import { MatchState, baseFeeBps, quoteFee, quoteLiquidityBand } from "./lib/feeModel";
import "./styles.css";
import type { LiquidityBandQuote } from "./lib/feeModel";

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

type WarRoomEvent = {
  agent: Record<Language, string>;
  role: Record<Language, string>;
  title: Record<Language, string>;
  detail: Record<Language, string>;
  signal: Record<Language, string>;
  metric: string;
  confidence: number;
  tone: "ok" | "warn" | "hot";
};

type OracleSignal = {
  label: Record<Language, string>;
  detail: Record<Language, string>;
  confidence: number;
  source: Record<Language, string>;
};

type AgentVault = {
  name: Record<Language, string>;
  persona: Record<Language, string>;
  thesis: Record<Language, string>;
  allocation: Record<Language, string>;
  risk: Record<Language, string>;
  nav: string;
  followers: string;
  tone: "ok" | "warn" | "hot";
};

type SocialMode = "farcaster" | "telegram";
type ExperienceMode = "fan" | "pro";

type PoolMetricsState = {
  totalVolumeUsd: string;
  swapCount: string;
  lastFeeBps: string;
  lastLiquidityConcentrationBps: string;
  lastTickLower: string;
  lastTickUpper: string;
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
      { name: "lastLiquidityConcentrationBps", type: "uint16" },
      { name: "lastTickLower", type: "int24" },
      { name: "lastTickUpper", type: "int24" },
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
const poolId = deployment.poolId as HexValue;
const simulationIntervalMs = 2_400;
const publicClient = createPublicClient({
  chain: xLayerTestnet,
  transport: http(deployment.rpcUrl)
});

const copy = {
  zh: {
    eyebrow: "X Layer 黑客松 MVP",
    intro: "国际足球杯赛预测市场控制台：把比赛波动、红牌和终场压力转化为 X Layer 上可验证的预测市场动作。",
    introPro: "国际足球杯赛预测市场控制台：用 v4-style Hook 同时调整动态 swap fee 与时间加权集中流动性 TWCL。",
    chainName: "X Layer 测试网",
    chainId: "Chain 1952",
    language: "语言",
    fanMode: "球迷模式",
    proMode: "专业模式",
    fanModeNote: "隐藏 Hook、Gas、流动性等术语，用球迷能理解的动作描述链上交互。",
    liveControls: "X Layer 链上控制",
    connectAndWrite: "连接钱包并写入测试网",
    stadiumSignal: "国际足球杯赛 · 夜场",
    broadcastMode: "实时比赛信号",
    liveMinute: "比赛时间",
    matchRisk: "胜率动力",
    matchRiskPro: "市场风险",
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
    warRoomTab: "AI 战情室",
    chainTab: "链上",
    judgeTab: "评委视图",
    quarterFinal: "四分之一决赛",
    matchTitle: "阿根廷 vs 巴西",
    advanceLabel: "推进比赛事件",
    currentEvent: "当前事件",
    buyOutcome: "买入结果",
    hookEngine: "胜率动力引擎",
    hookEnginePro: "Hook + TWCL 引擎",
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
    hookFee: "助威成本",
    hookFeePro: "Hook 费用",
    outcomeTokens: "结果 Token",
    simulateSwap: "模拟打 call",
    simulateSwapPro: "模拟 Swap",
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
    chainHookTest: "链上战况测试交易",
    chainHookTestPro: "链上 Hook 测试交易",
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
    twclBand: "终场冲刺带",
    twclBandPro: "TWCL Tick 区间",
    concentration: "胜率动力注入",
    concentrationPro: "流动性集中度",
    fanAction: "战队打 call",
    tweetToTrade: "推文即交易",
    vaults: "AI 策略池",
    oracleProof: "真实数据证明路径",
    disabledFeature: "演示占位，未接真实后端",
    whyItMatters: "为什么重要",
    whyText: "体育预测市场会在进球、红牌、点球和终场前反转时遭遇极高波动。MatchPulse 把这些信号放进 Hook 层，动态提高交易成本，降低 LP 被 toxic flow 冲击的风险。",
    validation: "验证结果",
    validationText: "合约测试 4/4 通过，新增 TWCL 流动性收敛断言；配置校验脚本检查 chainId/地址/bytes32/交易哈希类型，前端构建通过，X Layer testnet 合约已部署，GitHub Pages 可公开访问。",
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
    liquidityReasons: {
      "pre-match wide liquidity band": "赛前宽防守",
      "half-time liquidity reset": "中场重新排兵",
      "settlement redemption band": "赛后结算通道",
      "live balanced liquidity band": "直播攻防通道",
      "final-whistle squeeze": "终场前压缩",
      "close-score convergence": "胶着比分收敛",
      "red-card concentration": "红牌后收紧",
      "upset flow concentration": "冷门交易收敛",
      "injury-time doom option": "伤停补时极速收敛"
    },
    agentScheduled: "市场处于启动流动性阶段。此时 Hook 仍报价基础费率，适合 LP 先为两边结果注入流动性。",
    agentFinalized: "已进入赛后结算窗口。我可以结算市场、生成赎回说明，并整理链上证明链接。",
    agentLivePrefix: "当前直播波动费率为",
    agentLiveSuffix: "拥有最高隐含价格，但 Hook 正在对胶着比分风险收费。"
  },
  en: {
    eyebrow: "X Layer Hackathon MVP",
    intro: "An international football cup prediction-market console that turns match swings, red cards, and late pressure into verifiable X Layer actions.",
    introPro: "An international football cup prediction-market console where a v4-style Hook adjusts both dynamic swap fees and time-weighted concentrated liquidity.",
    chainName: "X Layer testnet",
    chainId: "Chain 1952",
    language: "Language",
    fanMode: "Fan mode",
    proMode: "Pro mode",
    fanModeNote: "Hides Hook, gas, and liquidity jargon behind fan-readable actions.",
    liveControls: "Live X Layer controls",
    connectAndWrite: "Connect wallet and write to testnet",
    stadiumSignal: "International football cup · Night match",
    broadcastMode: "Live match signal",
    liveMinute: "Match clock",
    matchRisk: "Win boost",
    matchRiskPro: "Market risk",
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
    warRoomTab: "AI War Room",
    chainTab: "On-chain",
    judgeTab: "Judge view",
    quarterFinal: "Quarter Final",
    matchTitle: "Argentina vs Brazil",
    advanceLabel: "Advance match event",
    currentEvent: "Current event",
    buyOutcome: "Buy outcome",
    hookEngine: "Win boost engine",
    hookEnginePro: "Hook + TWCL engine",
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
    hookFee: "Boost cost",
    hookFeePro: "Hook fee",
    outcomeTokens: "Outcome tokens",
    simulateSwap: "Boost team",
    simulateSwapPro: "Simulate swap",
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
    chainHookTest: "On-chain match test tx",
    chainHookTestPro: "On-chain Hook test tx",
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
    twclBand: "Final push lane",
    twclBandPro: "TWCL tick band",
    concentration: "Win boost injection",
    concentrationPro: "Liquidity concentration",
    fanAction: "Team boost",
    tweetToTrade: "Tweet-to-Trade",
    vaults: "AI strategy vaults",
    oracleProof: "Real data proof path",
    disabledFeature: "Demo placeholder, no backend action wired",
    whyItMatters: "Why it matters",
    whyText: "Sports prediction markets face extreme volatility during goals, red cards, penalties and late reversals. MatchPulse moves those signals into the Hook layer to reduce LP exposure to toxic flow.",
    validation: "Validation",
    validationText: "Contract tests pass 4/4 with TWCL convergence assertions, the config validator checks numeric chainId plus address / bytes32 / tx-hash formats, frontend build passes, X Layer testnet contracts are deployed, and GitHub Pages is publicly accessible.",
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
    liquidityReasons: {
      "pre-match wide liquidity band": "pre-match wide lane",
      "half-time liquidity reset": "half-time reset",
      "settlement redemption band": "settlement redemption lane",
      "live balanced liquidity band": "live balanced lane",
      "final-whistle squeeze": "final-whistle squeeze",
      "close-score convergence": "close-score convergence",
      "red-card concentration": "red-card concentration",
      "upset flow concentration": "upset flow concentration",
      "injury-time doom option": "injury-time doom option"
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

const warRoomEvents: WarRoomEvent[] = [
  {
    agent: { zh: "Agent A", en: "Agent A" },
    role: { zh: "突发情报抓取", en: "Breaking News Scraper" },
    title: { zh: "赛前社交信号升温", en: "Pre-match social signal detected" },
    detail: {
      zh: "演示适配器监听记者流、Farcaster 讨论和官方公告，识别到阿根廷首发确认后的积极情绪扩散。",
      en: "Demo adapter watches reporter feeds, Farcaster chatter, and official posts; Argentina lineup sentiment turns positive."
    },
    signal: { zh: "情绪: Bullish ARG", en: "Sentiment: Bullish ARG" },
    metric: "87%",
    confidence: 87,
    tone: "ok"
  },
  {
    agent: { zh: "Agent B", en: "Agent B" },
    role: { zh: "链上赔率分析", en: "On-chain Quant" },
    title: { zh: "赔率与流动性出现偏差", en: "Odds and liquidity diverge" },
    detail: {
      zh: "读取 X Layer Hook 报价、池指标和结果 Token 价格，发现巴西方向交易拥挤但费用保护仍可覆盖 LP 风险。",
      en: "Reads X Layer Hook quotes, pool metrics, and outcome-token prices; Brazil flow is crowded but fee protection still covers LP risk."
    },
    signal: { zh: "定价: 轻微错配", en: "Pricing: Mild dislocation" },
    metric: "+42 bps",
    confidence: 79,
    tone: "warn"
  },
  {
    agent: { zh: "Agent C", en: "Agent C" },
    role: { zh: "策略推演与执行", en: "Strategy & Execution" },
    title: { zh: "生成可审计策略动作", en: "Auditable strategy action prepared" },
    detail: {
      zh: "综合情报和链上数据后，给出小额跟随阿根廷、保留平局保护、等待链上 Hook 交易确认的执行计划。",
      en: "Combines intelligence and market data into a small Argentina-follow action with Draw protection and an on-chain Hook confirmation gate."
    },
    signal: { zh: "动作: 跟单 + 风险限额", en: "Action: Follow + risk cap" },
    metric: "0.31 OKB",
    confidence: 83,
    tone: "hot"
  }
];

const oracleSignals: OracleSignal[] = [
  {
    label: { zh: "文本报告", en: "Text report" },
    detail: {
      zh: "伤病、首发和官方公告由实时文本模型归一化为结构化 match signal。",
      en: "Injury, lineup, and official posts are normalized into structured match signals."
    },
    confidence: 91,
    source: { zh: "生产适配器: Kimi/Grok API", en: "Production adapter: Kimi/Grok API" }
  },
  {
    label: { zh: "图像证据", en: "Image evidence" },
    detail: {
      zh: "多模态模型验证比分牌、VAR 截图或伤病报告原图，输出可签名证据摘要。",
      en: "Multimodal model checks scoreboards, VAR screenshots, or medical images and emits a signable evidence digest."
    },
    confidence: 88,
    source: { zh: "当前演示: 本地证据流", en: "Current demo: local evidence stream" }
  },
  {
    label: { zh: "链上提交", en: "On-chain commit" },
    detail: {
      zh: "Oracle 结果进入 MatchOracleMock.updateMatch，再驱动 Factory settle/redeem 闭环。",
      en: "Oracle result flows into MatchOracleMock.updateMatch, then drives Factory settlement and redemption."
    },
    confidence: 100,
    source: { zh: "已部署: X Layer testnet", en: "Deployed: X Layer testnet" }
  }
];

const badgeLevels = [
  { label: { zh: "新秀分析员", en: "Rookie Analyst" }, score: 42 },
  { label: { zh: "战术大师", en: "Tactical Master" }, score: 76 },
  { label: { zh: "世界杯量化官", en: "World Cup Quant" }, score: 94 }
];

const agentVaults: AgentVault[] = [
  {
    name: { zh: "保守型教练", en: "Conservative Coach" },
    persona: { zh: "低回撤 · 防守优先", en: "Low drawdown · defense first" },
    thesis: {
      zh: "比分胶着时优先保留平局保护，只在 TWCL 收敛确认后小额跟单。",
      en: "Keeps draw protection during close scores and follows only after TWCL confirms convergence."
    },
    allocation: { zh: "ARG 42% / DRAW 38% / BRA 20%", en: "ARG 42% / DRAW 38% / BRA 20%" },
    risk: { zh: "低", en: "Low" },
    nav: "1.034",
    followers: "1,284",
    tone: "ok"
  },
  {
    name: { zh: "狂热型球迷", en: "Fanatic Fan" },
    persona: { zh: "高进攻 · 情绪动量", en: "High attack · sentiment momentum" },
    thesis: {
      zh: "社交热度爆发时放大胜率动力，红牌或伤停补时仍保留自动止损。",
      en: "Amplifies the win boost during social surges while keeping auto stop-loss near red cards or injury time."
    },
    allocation: { zh: "ARG 68% / DRAW 12% / BRA 20%", en: "ARG 68% / DRAW 12% / BRA 20%" },
    risk: { zh: "高", en: "High" },
    nav: "1.118",
    followers: "3,972",
    tone: "hot"
  },
  {
    name: { zh: "量化裁判", en: "Quant Referee" },
    persona: { zh: "赔率偏差 · 事件驱动", en: "Odds dislocation · event driven" },
    thesis: {
      zh: "只在链上报价、社交情报和 Oracle 证据三者一致时执行。",
      en: "Acts only when on-chain quotes, social intelligence, and oracle evidence align."
    },
    allocation: { zh: "ARG 35% / DRAW 28% / BRA 37%", en: "ARG 35% / DRAW 28% / BRA 37%" },
    risk: { zh: "中", en: "Medium" },
    nav: "1.076",
    followers: "2,406",
    tone: "warn"
  }
];

const initialBook: Record<Outcome, number> = { Argentina: 43, Draw: 24, Brazil: 33 };

function App() {
  const [language, setLanguage] = useState<Language>("zh");
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>("fan");
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
    lastLiquidityConcentrationBps: "--",
    lastTickLower: "--",
    lastTickUpper: "--",
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
  const [socialMode, setSocialMode] = useState<SocialMode>("farcaster");

  const t = copy[language];
  const match = dynamicMatch;
  const fee = useMemo(() => quoteFee(match.state), [match.state]);
  const liquidityBand = useMemo(() => quoteLiquidityBand(match.state), [match.state]);
  const feeSeries = useMemo(() => buildFeeSeries(language, match), [language, match]);
  const impliedPrice = book[selectedOutcome] / 100;
  const feeCost = (stake * fee.feeBps) / 10_000;
  const tokens = (stake - feeCost) / Math.max(impliedPrice, 0.01);
  const maxOutcome = Object.entries(book).sort((a, b) => b[1] - a[1])[0][0] as Outcome;
  const walletReady = Boolean(walletAddress && walletChainId === deployment.chainId);
  const providerName = getWalletProviderName();
  const explorerBase = deployment.explorer.replace(/\/$/, "");
  const intensityPercent = Math.max(8, Math.min(100, fee.volatilityScore));
  const activeAgentIndex = simPulse % warRoomEvents.length;
  const strategyConfidence = Math.min(99, Math.round((fee.volatilityScore + chainQuote.volatilityScore + warRoomEvents[activeAgentIndex].confidence) / 3));
  const autonomyScore = Math.min(100, 68 + activeAgentIndex * 8 + Math.round(fee.volatilityScore / 8));
  const fanMode = experienceMode === "fan";
  const introText = fanMode ? t.intro : t.introPro;
  const matchRiskLabel = fanMode ? t.matchRisk : t.matchRiskPro;
  const hookEngineLabel = fanMode ? t.hookEngine : t.hookEnginePro;
  const hookFeeLabel = fanMode ? t.hookFee : t.hookFeePro;
  const simulateSwapLabel = fanMode ? t.simulateSwap : t.simulateSwapPro;
  const chainHookTestLabel = fanMode ? t.chainHookTest : t.chainHookTestPro;
  const twclBandLabel = fanMode ? t.twclBand : t.twclBandPro;
  const concentrationLabel = fanMode ? t.concentration : t.concentrationPro;
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
        lastLiquidityConcentrationBps: metrics[4].toString(),
        lastTickLower: metrics[5].toString(),
        lastTickUpper: metrics[6].toString(),
        lastReason: metrics[8] || "--"
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
              <p>{introText}</p>
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
              <div className="experienceSwitch" aria-label={t.fanModeNote}>
                <Users size={16} />
                <button type="button" className={experienceMode === "fan" ? "active" : ""} onClick={() => setExperienceMode("fan")}>
                  {t.fanMode}
                </button>
                <button type="button" className={experienceMode === "pro" ? "active" : ""} onClick={() => setExperienceMode("pro")}>
                  {t.proMode}
                </button>
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
            </div>
          </div>

          <div className="broadcastRail">
            <StatTile label={t.broadcastMode} value={t.phase[match.state.phase]} />
            <StatTile label={t.liveMinute} value={`${match.state.minute || "00"}'`} />
            <StatTile label={matchRiskLabel} value={fanMode ? `${liquidityBand.concentrationBps / 100}%` : `${fee.feeBps} bps`} />
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
            <Tabs.Trigger value="warroom">{t.warRoomTab}</Tabs.Trigger>
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
                <PanelTitle icon={<Zap size={18} />} label={hookEngineLabel} />
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
                  <Metric label={concentrationLabel} value={`${(liquidityBand.concentrationBps / 100).toFixed(0)}%`} />
                  <Metric label={twclBandLabel} value={`${liquidityBand.tickLower} / ${liquidityBand.tickUpper}`} />
                </dl>
                <div className="twclBox">
                  <span>{twclBandLabel}</span>
                  <strong>{translateLiquidityReason(liquidityBand.reason, language)}</strong>
                  <div className="twclTrack">
                    <i style={{ width: `${Math.max(6, 100 - liquidityBand.bandWidth / 48)}%` }} />
                  </div>
                  <small>
                    {language === "zh"
                      ? `越接近终场，通道越窄；当前宽度 ${liquidityBand.bandWidth} ticks。`
                      : `The lane narrows near final whistle; current width is ${liquidityBand.bandWidth} ticks.`}
                  </small>
                </div>
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
                  <StatTile label={hookFeeLabel} value={`$${feeCost.toFixed(2)}`} />
                  <StatTile label={t.outcomeTokens} value={tokens.toFixed(2)} />
                </div>
                <button type="button" className="primaryButton" onClick={() => trade(selectedOutcome)}>
                  <Activity size={18} />
                  {t.localOnly}: {simulateSwapLabel}
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

          <Tabs.Content value="warroom" className="tabContent">
            <WarRoomPanel
              language={language}
              activeAgentIndex={activeAgentIndex}
              strategyConfidence={strategyConfidence}
              autonomyScore={autonomyScore}
              selectedOutcome={selectedOutcome}
              socialMode={socialMode}
              setSocialMode={setSocialMode}
              explorerBase={explorerBase}
              chainQuote={chainQuote}
              feeBps={fee.feeBps}
              liquidityBand={liquidityBand}
              intensityPercent={intensityPercent}
              walletReady={walletReady}
              fanMode={fanMode}
            />
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
                  {chainHookTestLabel}
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
                  <StatTile
                    label={concentrationLabel}
                    value={
                      poolMetricsState.lastLiquidityConcentrationBps === "--"
                        ? `${(liquidityBand.concentrationBps / 100).toFixed(0)}%`
                        : `${(Number(poolMetricsState.lastLiquidityConcentrationBps) / 100).toFixed(0)}%`
                    }
                  />
                </div>
                <p className="walletNote">
                  {poolMetricsState.lastReason === "--" ? t.chainHookTestNote : translateFeeReason(poolMetricsState.lastReason, language)}
                  {" · "}
                  {poolMetricsState.lastTickLower !== "--" && poolMetricsState.lastTickUpper !== "--"
                    ? `${twclBandLabel}: ${poolMetricsState.lastTickLower} / ${poolMetricsState.lastTickUpper}`
                    : language === "zh"
                      ? "新版 TWCL Hook 会在链上交易后写入集中度与 tick 区间。"
                      : "The TWCL Hook writes concentration and tick band after an on-chain Hook transaction."}
                </p>
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

function WarRoomPanel({
  language,
  activeAgentIndex,
  strategyConfidence,
  autonomyScore,
  selectedOutcome,
  socialMode,
  setSocialMode,
  explorerBase,
  chainQuote,
  feeBps,
  liquidityBand,
  intensityPercent,
  walletReady,
  fanMode
}: {
  language: Language;
  activeAgentIndex: number;
  strategyConfidence: number;
  autonomyScore: number;
  selectedOutcome: Outcome;
  socialMode: SocialMode;
  setSocialMode: (mode: SocialMode) => void;
  explorerBase: string;
  chainQuote: ChainQuote;
  feeBps: number;
  liquidityBand: LiquidityBandQuote;
  intensityPercent: number;
  walletReady: boolean;
  fanMode: boolean;
}) {
  const activeAgent = warRoomEvents[activeAgentIndex];
  const [selectedVaultIndex, setSelectedVaultIndex] = useState(1);
  const [tweetCommand, setTweetCommand] = useState("@MatchPulseAI follow ARG 25 OKB #ARGvBRA");
  const [tweetParsed, setTweetParsed] = useState(parseTweetCommand(tweetCommand));
  const selectedVault = agentVaults[selectedVaultIndex];
  const followCopy =
    socialMode === "farcaster"
      ? language === "zh"
        ? "Frame 内一键跟单 AI 策略"
        : "One-tap AI follow inside a Frame"
      : language === "zh"
        ? "Telegram 群内唤起小程序"
        : "Launch Mini App inside a Telegram chat";
  const explorerTx = deployment.transactions.verifiedSimulatedSwap;
  const badge = badgeLevels[Math.min(badgeLevels.length - 1, Math.floor(strategyConfidence / 34))];

  function followVault(index: number) {
    setSelectedVaultIndex(index);
    const vault = agentVaults[index];
    toast.success(language === "zh" ? "已生成跟单意图" : "Follow intent generated", {
      description:
        language === "zh"
          ? `${vault.name.zh} 策略进入钱包确认队列。`
          : `${vault.name.en} strategy moved into the wallet-confirmation queue.`
    });
  }

  function parseTweet() {
    const parsed = parseTweetCommand(tweetCommand);
    setTweetParsed(parsed);
    toast.message(language === "zh" ? "推文指令已解析" : "Tweet command parsed", {
      description: parsed.valid
        ? `${parsed.side} · ${parsed.amount} ${parsed.asset}`
        : language === "zh"
          ? "格式示例: @MatchPulseAI follow ARG 25 OKB #ARGvBRA"
          : "Example: @MatchPulseAI follow ARG 25 OKB #ARGvBRA"
    });
  }

  return (
    <section className="warRoomGrid">
      <section className="warHero panelSurface">
        <div className="warHeroHeader">
          <PanelTitle icon={<BrainCircuit size={18} />} label={language === "zh" ? "多智能体战情室" : "Multi-agent war room"} />
          <span>{language === "zh" ? "演示自治循环 · 生产可接 API 适配器" : "Demo autonomous loop · production API adapters ready"}</span>
        </div>
        <div className="warHeroBody">
          <div>
            <h2>{language === "zh" ? "AI 赛场决策引擎" : "AI match decision engine"}</h2>
            <p>
              {language === "zh"
                ? "Scraper、Quant、Strat & Exec 三个 Agent 持续交换情报、链上赔率和风险预算，最后把动作落到 X Layer 可验证交易。"
                : "Scraper, Quant, and Strat & Exec agents exchange intelligence, on-chain odds, and risk budget before committing actions to verifiable X Layer transactions."}
            </p>
          </div>
          <div className="warScoreDial" style={{ "--score": `${autonomyScore}%` } as React.CSSProperties}>
            <strong>{autonomyScore}</strong>
            <span>{language === "zh" ? "自治评分" : "autonomy"}</span>
          </div>
        </div>
      </section>

      <section className="agentMatrix panelSurface">
        <PanelTitle icon={<Network size={18} />} label={language === "zh" ? "Agent 协作日志" : "Agent collaboration log"} />
        <div className="agentRows">
          {warRoomEvents.map((event, index) => (
            <div className={`agentRow ${event.tone} ${index === activeAgentIndex ? "active" : ""}`} key={event.role.en}>
              <div className="agentNode">
                <strong>{event.agent[language]}</strong>
                <span>{event.role[language]}</span>
              </div>
              <div className="agentNarrative">
                <strong>{event.title[language]}</strong>
                <p>{event.detail[language]}</p>
              </div>
              <div className="agentSignal">
                <span>{event.signal[language]}</span>
                <strong>{event.metric}</strong>
                <small>{event.confidence}%</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="oraclePanel panelSurface">
        <PanelTitle icon={<ScanEye size={18} />} label={fanMode ? copy[language].oracleProof : language === "zh" ? "多模态 Oracle 验证" : "Multimodal oracle verification"} />
        <div className="oracleStrip">
          {oracleSignals.map((signal) => (
            <div className="oracleCard" key={signal.label.en}>
              <div className="oracleIcon">
                {signal.confidence >= 100 ? <Link2 size={18} /> : signal.label.en === "Image evidence" ? <FileImage size={18} /> : <Radar size={18} />}
              </div>
              <strong>{signal.label[language]}</strong>
              <p>{signal.detail[language]}</p>
              <span>{signal.source[language]}</span>
              <meter min="0" max="100" value={signal.confidence} />
            </div>
          ))}
        </div>
        <div className="proofPipeline">
          <div>
            <span>TLSNotary</span>
            <strong>{language === "zh" ? "权威体育 API 响应证明" : "Authoritative sports API response proof"}</strong>
          </div>
          <div>
            <span>ZK Adapter</span>
            <strong>{language === "zh" ? "隐藏 API Key，只公开比分承诺" : "Hide API key, publish score commitment"}</strong>
          </div>
          <div>
            <span>Oracle Adapter</span>
            <strong>{language === "zh" ? "替换 Mock，驱动 settle/redeem" : "Replace mock and drive settle/redeem"}</strong>
          </div>
        </div>
      </section>

      <section className="strategyPanel panelSurface">
        <PanelTitle icon={<Sparkles size={18} />} label={language === "zh" ? "策略推演与执行" : "Strategy simulation and execution"} />
        <div className="strategyTicket">
          <StatTile label={language === "zh" ? "当前 Agent" : "Active agent"} value={activeAgent.role[language]} />
          <StatTile label={language === "zh" ? "建议方向" : "Suggested side"} value={outcomeCopy[language][selectedOutcome]} />
          <StatTile
            label={fanMode ? (language === "zh" ? "胜率动力" : "Win boost") : language === "zh" ? "本地 Hook 费率" : "Local Hook fee"}
            value={fanMode ? `${(liquidityBand.concentrationBps / 100).toFixed(0)}%` : `${feeBps} bps`}
          />
          <StatTile
            label={fanMode ? (language === "zh" ? "终场通道" : "Final lane") : language === "zh" ? "链上 Hook 报价" : "On-chain Hook quote"}
            value={fanMode ? translateLiquidityReason(liquidityBand.reason, language) : `${chainQuote.feeBps} bps`}
          />
        </div>
        <div className="decisionBar">
          <span>{language === "zh" ? "策略置信度" : "Strategy confidence"}</span>
          <strong>{strategyConfidence}%</strong>
          <i style={{ width: `${strategyConfidence}%` }} />
        </div>
        <p className="walletNote">
          {language === "zh"
            ? "当前版本在前端演示自治决策链路；真实执行仍通过链上按钮和钱包确认完成，避免把未接入的后端 Agent 冒充为真实资金托管。"
            : "This version demonstrates the autonomous decision loop in the frontend; real execution still goes through the on-chain buttons and wallet confirmation, so no unwired backend agent is misrepresented as fund custody."}
        </p>
      </section>

      <section className="vaultPanel panelSurface">
        <PanelTitle icon={<Users size={18} />} label={copy[language].vaults} />
        <div className="vaultGrid">
          {agentVaults.map((vault, index) => (
            <button
              key={vault.name.en}
              type="button"
              className={`vaultCard ${vault.tone} ${index === selectedVaultIndex ? "active" : ""}`}
              onClick={() => followVault(index)}
            >
              <span>{vault.persona[language]}</span>
              <strong>{vault.name[language]}</strong>
              <p>{vault.thesis[language]}</p>
              <dl>
                <dt>{language === "zh" ? "仓位" : "Allocation"}</dt>
                <dd>{vault.allocation[language]}</dd>
                <dt>{language === "zh" ? "净值" : "NAV"}</dt>
                <dd>{vault.nav}</dd>
                <dt>{language === "zh" ? "风险" : "Risk"}</dt>
                <dd>{vault.risk[language]}</dd>
              </dl>
            </button>
          ))}
        </div>
        <div className="vaultIntent">
          <strong>
            {language === "zh" ? "已选策略池" : "Selected vault"}: {selectedVault.name[language]}
          </strong>
          <span>
            {language === "zh"
              ? `${selectedVault.followers} 人跟单，生产版会映射为可申购 Vault 合约和风控上限。`
              : `${selectedVault.followers} followers; production maps this to subscribable vault contracts with risk caps.`}
          </span>
        </div>
      </section>

      <section className="tweetPanel panelSurface">
        <PanelTitle icon={<MessageCircle size={18} />} label={copy[language].tweetToTrade} />
        <div className="tweetComposer">
          <input value={tweetCommand} onChange={(event) => setTweetCommand(event.target.value)} aria-label={copy[language].tweetToTrade} />
          <button type="button" onClick={parseTweet}>
            {language === "zh" ? "解析" : "Parse"}
          </button>
        </div>
        <div className={`tweetFlow ${tweetParsed.valid ? "valid" : "invalid"}`}>
          <div>
            <span>{language === "zh" ? "社交索引器" : "Social indexer"}</span>
            <strong>{tweetParsed.valid ? `#${tweetParsed.market}` : language === "zh" ? "等待有效格式" : "Waiting for valid format"}</strong>
          </div>
          <div>
            <span>{language === "zh" ? "会话授权" : "Session key"}</span>
            <strong>{walletReady ? (language === "zh" ? "可提交" : "Ready") : language === "zh" ? "等待钱包" : "Wallet gated"}</strong>
          </div>
          <div>
            <span>{language === "zh" ? "X Layer 动作" : "X Layer action"}</span>
            <strong>{tweetParsed.valid ? `${tweetParsed.side} ${tweetParsed.amount} ${tweetParsed.asset}` : "--"}</strong>
          </div>
        </div>
        <p className="walletNote">
          {language === "zh"
            ? "当前为前端解析器演示；生产版需要 X/Farcaster/Lens Indexer、反女巫校验、AA Session Key 和后端风控队列。"
            : "This is a frontend parser demo; production needs an X/Farcaster/Lens indexer, anti-sybil checks, AA session keys, and a backend risk queue."}
        </p>
      </section>

      <section className="growthPanel panelSurface">
        <PanelTitle icon={<MessageCircle size={18} />} label={language === "zh" ? "零摩擦流量入口" : "Zero-friction growth surface"} />
        <div className="modeSwitch">
          <button type="button" className={socialMode === "farcaster" ? "active" : ""} onClick={() => setSocialMode("farcaster")}>
            Farcaster
          </button>
          <button type="button" className={socialMode === "telegram" ? "active" : ""} onClick={() => setSocialMode("telegram")}>
            Telegram
          </button>
        </div>
        <div className="socialFrameMock">
          <div>
            <span>{socialMode === "farcaster" ? "Frame" : "Mini App"}</span>
            <strong>{followCopy}</strong>
            <p>
              {language === "zh"
                ? "用户不需要理解 RPC、Gas 或合约地址；AA 钱包和 Paymaster 让第一次点击就能产生 X Layer 行为。"
                : "Users do not need to understand RPCs, gas, or contract addresses; AA wallets and a Paymaster turn the first tap into X Layer activity."}
            </p>
          </div>
          <button type="button">{language === "zh" ? "跟单 AI 策略" : "Follow AI strategy"}</button>
        </div>
        <div className="aaChecklist">
          <StatusPill label={language === "zh" ? "社交登录钱包" : "Social-login wallet"} active />
          <StatusPill label={language === "zh" ? "Gas 代付" : "Gas sponsorship"} active={walletReady} />
          <StatusPill label={language === "zh" ? "动态徽章 NFT" : "Dynamic badge NFT"} active />
        </div>
      </section>

      <section className="badgePanel panelSurface">
        <PanelTitle icon={<Trophy size={18} />} label={language === "zh" ? "动态资产与战力榜" : "Dynamic assets and leaderboard"} />
        <div className="badgeCard">
          <span>{language === "zh" ? "当前头衔" : "Current title"}</span>
          <strong>{badge.label[language]}</strong>
          <p>
            {language === "zh"
              ? `预测战力 ${badge.score}/100，随跟单命中率、链上交易和 Oracle 结算结果动态升级。`
              : `Prediction power ${badge.score}/100, upgraded by follow accuracy, on-chain transactions, and oracle settlement results.`}
          </p>
        </div>
      </section>

      <section className="proofPanel panelSurface">
        <PanelTitle icon={<ExternalLink size={18} />} label={language === "zh" ? "链上证明闭环" : "On-chain proof loop"} />
        <div className="proofLinks">
          <a href={`${explorerBase}/tx/${explorerTx}`} target="_blank" rel="noreferrer">
            <span>{language === "zh" ? "已验证 Hook 测试交易" : "Verified Hook test transaction"}</span>
            <strong>{shortHash(explorerTx)}</strong>
            <ArrowUpRight size={16} />
          </a>
          <a href={`${explorerBase}/address/${deployment.contracts.WorldCupMarketFactory}`} target="_blank" rel="noreferrer">
            <span>{language === "zh" ? "市场工厂合约" : "Market factory contract"}</span>
            <strong>{shortHash(deployment.contracts.WorldCupMarketFactory)}</strong>
            <ArrowUpRight size={16} />
          </a>
        </div>
      </section>
    </section>
  );
}

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`statusPill ${active ? "active" : ""}`}>
      <span />
      <strong>{label}</strong>
    </div>
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

function translateLiquidityReason(reason: string, language: Language) {
  const reasons = copy[language].liquidityReasons as Record<string, string>;
  return reasons[reason] ?? reason;
}

function parseTweetCommand(raw: string) {
  const match = raw.match(/@MatchPulseAI\s+follow\s+(ARG|BRA|DRAW)\s+(\d+(?:\.\d+)?)\s+(OKB|USDC)\s+#([A-Za-z0-9]+)/i);
  if (!match) {
    return { valid: false, side: "--", amount: "--", asset: "--", market: "--" };
  }
  return {
    valid: true,
    side: match[1].toUpperCase(),
    amount: match[2],
    asset: match[3].toUpperCase(),
    market: match[4]
  };
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
