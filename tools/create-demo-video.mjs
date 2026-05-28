import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const tmpRoot = path.join(root, "tmp", "video", "final-demo");
const edgeTts = path.join(root, "tmp", "edge-tts-venv", "bin", "edge-tts");
const docsDir = path.join(root, "docs");
const pageUrl = process.env.MATCHPULSE_DEMO_URL || "http://127.0.0.1:5180/matchpulse-xcup/";
const outputByLanguage = {
  en: {
    final: path.join(docsDir, "matchpulse-xcup-demo-en.mp4"),
    legacy: path.join(docsDir, "matchpulse-xcup-demo.mp4"),
    voice: process.env.MATCHPULSE_DEMO_EN_VOICE || "en-US-GuyNeural"
  },
  zh: {
    final: path.join(docsDir, "matchpulse-xcup-demo-zh.mp4"),
    voice: process.env.MATCHPULSE_DEMO_ZH_VOICE || "zh-CN-YunxiNeural"
  }
};

const variants = {
  en: {
    name: "English",
    uiButton: "EN",
    voiceRate: "+6%",
    overlayFontSize: 32,
    segments: [
      {
        tab: "market",
        selector: ".heroConsole",
        title: "MatchPulse: AI Match Decision Engine",
        subtitle: "A World Cup-style prediction market on X Layer with real testnet contracts.",
        narration:
          "This is MatchPulse, an AI match decision engine for X Layer. The demo is now built around real testnet contracts, a signed sports oracle, active liquidity rebalancing, and an AI war room."
      },
      {
        tab: "market",
        selector: ".broadcastRail",
        title: "Live Match Volatility",
        subtitle: "Clock, score, win boost, and crowd heat keep changing during the walkthrough.",
        narration:
          "The top broadcast rail makes the product feel like a live match. Score, match clock, crowd heat, and win boost keep moving, so judges see a dynamic sports market instead of a static dashboard.",
        action: "pulse"
      },
      {
        tab: "market",
        selector: ".hookPanel",
        title: "Dynamic Liquidity Rebalancing Hook",
        subtitle: "The Hook changes both fees and concentrated liquidity around the active tick.",
        narration:
          "The first core innovation is the Hook. It no longer only changes a fee. It also computes an active tick, narrows the tick band, and redirects liquidity toward the current market price during late-game pressure.",
        action: "lateGame"
      },
      {
        tab: "market",
        selector: ".twclBox",
        title: "Injury-Time Capital Efficiency",
        subtitle: "The band tightens as red cards, close scores, upset signals, and injury time stack together.",
        narration:
          "This is the financial edge. In the final minutes, the liquidity band tightens aggressively. That gives traders deeper execution and gives liquidity providers a more controlled risk surface.",
        action: "injuryTime"
      },
      {
        tab: "market",
        selector: ".outcomeGrid",
        title: "Outcome Market Interaction",
        subtitle: "Selecting Argentina, Draw, or Brazil moves odds, tokens, and the live event log.",
        narration:
          "The outcome market is interactive. When the user selects a side, odds, estimated tokens, and recent events update immediately while the Hook keeps pricing live risk.",
        action: "outcomes"
      },
      {
        tab: "warroom",
        selector: ".warHero",
        title: "Multi-Agent War Room",
        subtitle: "Scraper, Quant, and Strategy agents turn match intelligence into auditable actions.",
        narration:
          "The AI war room is the second innovation. A scraper agent reads breaking intelligence, a quant agent reads on-chain odds, and a strategy agent converts the combined signal into an auditable action path.",
        action: "warroom"
      },
      {
        tab: "warroom",
        selector: ".strategyPanel",
        title: "Session-Key Intent Execution",
        subtitle: "The user signs once; the AI session key can act inside strict match limits.",
        narration:
          "The autonomy layer is based on session keys. A user can authorize a bounded AI session before kickoff. The AgentExecutor contract then requires both the user authorization and the session-key intent signature.",
        action: "warroom"
      },
      {
        tab: "warroom",
        selector: ".vaultPanel",
        title: "Agent Vaults",
        subtitle: "Conservative coach, fanatic fan, and quant referee become subscribable strategies.",
        narration:
          "Agent Vaults turn different AI personalities into strategy products. A conservative coach, a fanatic fan, and a quant referee can each represent a different risk profile for one-tap following."
      },
      {
        tab: "warroom",
        selector: ".tweetPanel",
        title: "Tweet-to-Trade Funnel",
        subtitle: "A social command is parsed into market, session key, and X Layer action stages.",
        narration:
          "The social funnel is designed for growth. A Tweet-to-Trade command is parsed into a market, a session-key gate, and an X Layer action, which can convert social traffic into wallet activity."
      },
      {
        tab: "chain",
        selector: ".intentRail",
        title: "OKX Native Mobile UX",
        subtitle: "OKX Wallet injection is the fast path; OKX Connect is the fallback.",
        narration:
          "The frontend is mobile-first for OKX Wallet. It detects the OKX DApp browser, falls back to OKX Connect, and exposes the AI session authorization and Paymaster path in one compact rail."
      },
      {
        tab: "chain",
        selector: ".walletPanel",
        title: "Real X Layer Testnet Controls",
        subtitle: "Mint, Hook swap, active rebalance, refresh, settle, and redeem are visible on-chain flows.",
        narration:
          "The Chain tab is where the demo becomes verifiable. It contains wallet connection, minting, a Hook swap transaction, and an active liquidity rebalance transaction against the deployed X Layer contracts.",
        action: "chainButtons"
      },
      {
        tab: "chain",
        selector: ".chainReadPanel",
        title: "Live Chain Reads",
        subtitle: "The UI reads Hook fee, active tick, rebalance count, vault credit, balances, and collateral.",
        narration:
          "Live chain reads prove the system is not only a mock interface. The pool metrics show swap count, active rebalance count, active tick, narrowed tick range, fee, concentration, and vault credit.",
        action: "refresh"
      },
      {
        tab: "chain",
        selector: ".settlementPanel",
        title: "Signed Oracle Settlement Loop",
        subtitle: "The trusted signer writes an EIP-712 score update, then the market settles and redeems.",
        narration:
          "The oracle path is signed. A trusted signer submits an EIP-seven-twelve match state update, then the factory can settle the market and users can redeem winning tokens."
      },
      {
        tab: "chain",
        selector: ".deployPanel",
        title: "Explorer-Ready Proof",
        subtitle: "Oracle, Hook, AgentExecutor, Paymaster, factory, pool manager, and tokens are surfaced.",
        narration:
          "The deployment panel is there for judges. It exposes the oracle, Hook, AgentExecutor, Paymaster, factory, pool manager, and outcome-token addresses for direct explorer verification."
      },
      {
        tab: "judge",
        selector: ".judgeGrid",
        title: "Why It Wins",
        subtitle: "Innovation, market value, and completion are connected in one testnet story.",
        narration:
          "The final advantage is completeness. MatchPulse combines Hook-level financial engineering, multi-agent decisioning, OKX-native mobile UX, signed oracle updates, session keys, Paymaster design, Subgraph indexing, and stress tests."
      }
    ]
  },
  zh: {
    name: "中文",
    uiButton: "中文",
    voiceRate: "+10%",
    overlayFontSize: 30,
    segments: [
      {
        tab: "market",
        selector: ".heroConsole",
        title: "MatchPulse：AI 赛场决策引擎",
        subtitle: "基于 X Layer 真实测试网合约的世界杯氛围预测市场。",
        narration:
          "这是 MatchPulse，面向 X Layer 的 AI 赛场决策引擎。最终版已经接入真实测试网合约、签名体育预言机、主动流动性重调，以及可视化多智能体战情室。"
      },
      {
        tab: "market",
        selector: ".broadcastRail",
        title: "实时比赛波动",
        subtitle: "比分、时间、胜率动力和现场热度在演示中持续剧烈变化。",
        narration:
          "顶部比赛栏让产品更像真实直播。比分、比赛时间、现场热度和胜率动力会持续变化，评委看到的是动态体育市场，而不是静态页面。",
        action: "pulse"
      },
      {
        tab: "market",
        selector: ".hookPanel",
        title: "动态流动性重调 Hook",
        subtitle: "Hook 不只改手续费，还围绕现价 Tick 主动压缩集中流动性。",
        narration:
          "第一个核心创新是 Hook。它现在不只是调整手续费，还会计算现价 Tick、压缩 Tick 区间，并在终场压力下把流动性主动收敛到当前价格附近。",
        action: "lateGame"
      },
      {
        tab: "market",
        selector: ".twclBox",
        title: "伤停补时资本效率",
        subtitle: "红牌、胶着比分、冷门信号和伤停补时叠加后，流动性通道极速收窄。",
        narration:
          "这是金融层面的优势。比赛最后阶段，流动性通道会快速收窄，交易者获得更深的成交体验，LP 也获得更可控的风险边界。",
        action: "injuryTime"
      },
      {
        tab: "market",
        selector: ".outcomeGrid",
        title: "结果市场交互",
        subtitle: "选择阿根廷、平局或巴西，会同步改变赔率、Token 和事件日志。",
        narration:
          "结果市场是可交互的。用户选择不同结果时，隐含赔率、预计 Token 和最近事件都会立即更新，同时 Hook 持续为实时风险定价。",
        action: "outcomes"
      },
      {
        tab: "warroom",
        selector: ".warHero",
        title: "多智能体战情室",
        subtitle: "情报、量化和策略 Agent 把赛事情报变成可审计动作。",
        narration:
          "AI 战情室是第二个创新点。情报 Agent 读取突发信息，量化 Agent 读取链上赔率，策略 Agent 再把合成信号变成可审计的执行路径。",
        action: "warroom"
      },
      {
        tab: "warroom",
        selector: ".strategyPanel",
        title: "Session Key 意图执行",
        subtitle: "用户赛前签一次授权，AI 会话密钥只能在严格限制内执行。",
        narration:
          "自治执行层基于会话密钥。用户可以在开赛前授权一个有限额的 AI 会话，AgentExecutor 合约会同时校验用户授权签名和会话密钥意图签名。",
        action: "warroom"
      },
      {
        tab: "warroom",
        selector: ".vaultPanel",
        title: "AI 策略池",
        subtitle: "保守型教练、狂热型球迷和量化裁判，变成可跟单策略。",
        narration:
          "Agent Vault 把不同性格的 AI 变成策略产品。保守型教练、狂热型球迷和量化裁判分别代表不同风险偏好，适合一键跟单。"
      },
      {
        tab: "warroom",
        selector: ".tweetPanel",
        title: "推文即交易入口",
        subtitle: "社交指令会被解析成市场、会话授权和 X Layer 动作。",
        narration:
          "社交流量入口服务增长。推文指令会被解析成比赛市场、会话密钥门控和 X Layer 动作，把社交热度转成真实钱包活跃。"
      },
      {
        tab: "chain",
        selector: ".intentRail",
        title: "OKX 原生移动端体验",
        subtitle: "优先使用 OKX 钱包注入环境，未注入时使用 OKX Connect。",
        narration:
          "前端按 OKX 钱包移动端优先设计。它会优先检测 OKX DApp 浏览器，必要时回退到 OKX Connect，并把 AI 授权和 Paymaster 路径放在同一条操作栏里。"
      },
      {
        tab: "chain",
        selector: ".walletPanel",
        title: "真实 X Layer 测试网控制台",
        subtitle: "铸造、Hook 交易、主动重调、刷新、结算和赎回都在链上路径中展示。",
        narration:
          "链上页面是可验证部分。这里展示钱包连接、铸造结果 Token、Hook swap 交易，以及针对已部署 X Layer 合约的主动流动性重调交易。",
        action: "chainButtons"
      },
      {
        tab: "chain",
        selector: ".chainReadPanel",
        title: "实时链上读取",
        subtitle: "读取 Hook 费率、现价 Tick、重调次数、Vault 返点、余额和抵押池。",
        narration:
          "链上读取证明这不是空壳页面。池指标会显示 swap 次数、主动重调次数、现价 Tick、压缩后的 Tick 区间、费率、集中度和 Vault 记账返点。",
        action: "refresh"
      },
      {
        tab: "chain",
        selector: ".settlementPanel",
        title: "签名预言机结算闭环",
        subtitle: "可信 signer 写入 EIP-712 比分更新，然后市场结算并赎回。",
        narration:
          "预言机路径已经改为签名校验。可信 signer 提交 EIP 七一二比赛状态更新后，市场工厂可以结算，用户可以赎回赢家 Token。"
      },
      {
        tab: "chain",
        selector: ".deployPanel",
        title: "可验证部署证据",
        subtitle: "Oracle、Hook、AgentExecutor、Paymaster、Factory、PoolManager 和 Token 全部展示。",
        narration:
          "部署面板专门给评委核验。Oracle、Hook、AgentExecutor、Paymaster、Factory、PoolManager 和结果 Token 地址都可以直接跳到浏览器验证。"
      },
      {
        tab: "judge",
        selector: ".judgeGrid",
        title: "为什么这版更强",
        subtitle: "创新性、市场价值和完成度，被串成一个真实测试网故事。",
        narration:
          "最终优势在于完成度。MatchPulse 把 Hook 金融工程、多智能体决策、OKX 移动端体验、签名预言机、Session Key、Paymaster、Subgraph 和压力测试整合到同一个演示里。"
      }
    ]
  }
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
}

function ffmpeg(args, options = {}) {
  run("ffmpeg", ["-hide_banner", "-loglevel", "warning", ...args], options);
}

function capture(command, args) {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

function ffprobeDuration(file) {
  return Number(capture("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file]));
}

function findRecordedVideo(rawDir) {
  const videos = readdirSync(rawDir)
    .filter((file) => file.endsWith(".webm"))
    .map((file) => path.join(rawDir, file));
  if (!videos.length) return null;
  return videos
    .map((file) => ({ file, size: Number(capture("stat", ["-f", "%z", file])) }))
    .sort((a, b) => b.size - a.size)[0].file;
}

function escapeDrawText(value) {
  return value.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'").replace(/\n/g, " ");
}

function srtTimestamp(seconds) {
  const ms = Math.round((seconds % 1) * 1000);
  const total = Math.floor(seconds);
  const s = total % 60;
  const m = Math.floor(total / 60) % 60;
  const h = Math.floor(total / 3600);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function buildSrt(timings, outputFile) {
  const body = timings
    .map((segment, index) => {
      return `${index + 1}\n${srtTimestamp(segment.start)} --> ${srtTimestamp(segment.end)}\n${segment.subtitle}\n`;
    })
    .join("\n");
  writeFileSync(outputFile, body);
}

function prepareAudio(variantKey, tmpDir) {
  const variant = variants[variantKey];
  const audioDir = path.join(tmpDir, "audio");
  mkdirSync(audioDir, { recursive: true });

  return variant.segments.map((segment, index) => {
    const baseName = `${String(index).padStart(2, "0")}`;
    const mediaPath = path.join(audioDir, `${baseName}.mp3`);
    const fallbackPath = path.join(audioDir, `${baseName}.aiff`);

    if (existsSync(edgeTts)) {
      const result = spawnSync(edgeTts, [
        "--voice",
        outputByLanguage[variantKey].voice,
        "--rate",
        variant.voiceRate,
        "--text",
        segment.narration,
        "--write-media",
        mediaPath
      ], { stdio: "inherit" });
      if (result.status !== 0) {
        run("say", ["-v", variantKey === "zh" ? "Tingting" : "Samantha", "-r", variantKey === "zh" ? "205" : "210", "-o", fallbackPath, segment.narration], { stdio: "ignore" });
        return { ...segment, audioPath: fallbackPath, duration: ffprobeDuration(fallbackPath) + 0.7 };
      }
      return { ...segment, audioPath: mediaPath, duration: ffprobeDuration(mediaPath) + 0.6 };
    }

    run("say", ["-v", variantKey === "zh" ? "Tingting" : "Samantha", "-r", variantKey === "zh" ? "205" : "210", "-o", fallbackPath, segment.narration], { stdio: "ignore" });
    return { ...segment, audioPath: fallbackPath, duration: ffprobeDuration(fallbackPath) + 0.7 };
  });
}

function renderVoiceTrack(timings, tmpDir) {
  const output = path.join(tmpDir, "voice.m4a");
  const inputs = timings.flatMap((segment) => ["-i", segment.audioPath]);
  const delayedInputs = timings
    .map((segment, index) => {
      const delayMs = Math.max(0, Math.round(segment.start * 1000));
      return `[${index}:a]adelay=${delayMs}:all=1[v${index}]`;
    })
    .join(";");
  const mixInputs = timings.map((_, index) => `[v${index}]`).join("");
  ffmpeg([
    "-y",
    ...inputs,
    "-filter_complex",
    `${delayedInputs};${mixInputs}amix=inputs=${timings.length}:duration=longest:dropout_transition=0[voice]`,
    "-map",
    "[voice]",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    output
  ]);
  return output;
}

function renderMusicTrack(totalDuration, tmpDir) {
  const output = path.join(tmpDir, "music.m4a");
  ffmpeg([
    "-y",
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=82:duration=${totalDuration}:sample_rate=48000`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=164:duration=${totalDuration}:sample_rate=48000`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=246:duration=${totalDuration}:sample_rate=48000`,
    "-filter_complex",
    `[0:a]volume=0.012[a0];[1:a]volume=0.006[a1];[2:a]volume=0.004[a2];[a0][a1][a2]amix=inputs=3:duration=first,afade=t=in:st=0:d=2,afade=t=out:st=${Math.max(0, totalDuration - 3).toFixed(2)}:d=3[music]`,
    "-map",
    "[music]",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    output
  ]);
  return output;
}

async function switchTab(page, tabName) {
  await page.locator(`[role="tab"][aria-controls$="content-${tabName}"]`).click({ timeout: 10_000 });
  const visibleSelector = tabName === "chain" ? ".walletPanel" : tabName === "judge" ? ".judgeGrid" : tabName === "warroom" ? ".warHero" : ".outcomeGrid";
  await page.waitForSelector(visibleSelector, { state: "visible", timeout: 10_000 });
  await page.waitForTimeout(500);
}

async function scrollToTarget(page, selector, block = "center") {
  await page.waitForSelector(selector, { state: "visible", timeout: 10_000 });
  await page.evaluate(
    ({ selector: targetSelector, blockPosition }) => {
      document.querySelector(targetSelector)?.scrollIntoView({ block: blockPosition, inline: "nearest", behavior: "smooth" });
    },
    { selector, blockPosition: block }
  );
  await page.waitForTimeout(700);
}

async function runAction(page, action) {
  if (!action) return;
  if (action === "pulse") {
    await page.evaluate(() => {
      document.querySelectorAll(".timelineNode")[1]?.click();
      setTimeout(() => document.querySelectorAll(".timelineNode")[2]?.click(), 900);
      setTimeout(() => document.querySelectorAll(".timelineNode")[3]?.click(), 1800);
    });
    await page.waitForTimeout(2400);
  }
  if (action === "lateGame") {
    await page.evaluate(() => document.querySelectorAll(".timelineNode")[3]?.click());
    await page.waitForTimeout(1000);
  }
  if (action === "injuryTime") {
    await page.evaluate(() => {
      document.querySelectorAll(".timelineNode")[3]?.click();
      document.querySelector(".intensityTrack")?.animate([{ filter: "brightness(1)" }, { filter: "brightness(1.9)" }, { filter: "brightness(1)" }], { duration: 1600, iterations: 2 });
    });
    await page.waitForTimeout(1200);
  }
  if (action === "outcomes") {
    await page.evaluate(() => {
      const outcomes = Array.from(document.querySelectorAll(".outcome"));
      outcomes[2]?.click();
      setTimeout(() => outcomes[1]?.click(), 700);
      setTimeout(() => outcomes[0]?.click(), 1400);
    });
    await page.waitForTimeout(2100);
  }
  if (action === "warroom") {
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll(".agentRow"));
      rows.forEach((row, index) => setTimeout(() => row.animate([{ transform: "scale(1)" }, { transform: "scale(1.025)" }, { transform: "scale(1)" }], { duration: 650 }), index * 500));
    });
    await page.waitForTimeout(1500);
  }
  if (action === "chainButtons") {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll(".walletPanel button"));
      buttons.forEach((button, index) => setTimeout(() => button.animate([{ transform: "translateY(0)" }, { transform: "translateY(-5px)" }, { transform: "translateY(0)" }], { duration: 540 }), index * 260));
    });
    await page.waitForTimeout(1600);
  }
  if (action === "refresh") {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      buttons.find((button) => /刷新链上数据|Refresh chain data/.test(button.textContent || ""))?.click();
    }).catch(() => undefined);
    await page.waitForTimeout(1200);
  }
}

async function installOverlay(page, variantKey) {
  const fontSize = variants[variantKey].overlayFontSize;
  await page.evaluate(({ fontSize: overlayFontSize }) => {
    const root = document.createElement("div");
    root.id = "demo-pro-overlay";
    root.innerHTML = `
      <div class="demo-highlight"></div>
      <div class="demo-label"><strong></strong><span></span></div>
      <div class="demo-subtitle"></div>
      <div class="demo-step"></div>
    `;
    document.body.appendChild(root);
    const style = document.createElement("style");
    style.textContent = `
      #demo-pro-overlay { position: fixed; inset: 0; z-index: 999999; pointer-events: none; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      #demo-pro-overlay .demo-highlight { position: fixed; border: 5px solid #f7d95b; border-radius: 14px; box-shadow: 0 0 0 9999px rgba(0, 0, 0, .10), 0 0 42px rgba(247, 217, 91, .72); transition: all 420ms ease; opacity: 0; }
      #demo-pro-overlay .demo-label { position: fixed; max-width: 680px; padding: 16px 18px; border: 1px solid rgba(255,255,255,.26); border-radius: 10px; background: rgba(3, 13, 11, .90); color: #fff; box-shadow: 0 24px 60px rgba(0,0,0,.34); transition: all 420ms ease; opacity: 0; }
      #demo-pro-overlay .demo-label strong { display: block; color: #f7d95b; font-size: 28px; line-height: 1.12; }
      #demo-pro-overlay .demo-label span { display: block; margin-top: 8px; color: #e8f4ee; font-size: 20px; font-weight: 780; line-height: 1.28; }
      #demo-pro-overlay .demo-subtitle { position: fixed; left: 50%; bottom: 34px; width: min(1320px, calc(100vw - 260px)); transform: translateX(-50%); padding: 13px 18px; border-radius: 10px; background: rgba(0,0,0,.76); color: #fff; font-size: ${overlayFontSize}px; font-weight: 850; line-height: 1.22; text-align: center; text-shadow: 0 2px 8px rgba(0,0,0,.55); }
      #demo-pro-overlay .demo-step { position: fixed; right: 28px; bottom: 30px; padding: 10px 14px; border-radius: 999px; background: rgba(233,75,86,.96); color: #fff; font-size: 20px; font-weight: 950; letter-spacing: .02em; }
    `;
    document.head.appendChild(style);

    window.__demoMark = ({ selector, title, subtitle, step }) => {
      const box = root.querySelector(".demo-highlight");
      const label = root.querySelector(".demo-label");
      const subtitleNode = root.querySelector(".demo-subtitle");
      const stepNode = root.querySelector(".demo-step");
      label.querySelector("strong").textContent = title;
      label.querySelector("span").textContent = subtitle;
      subtitleNode.textContent = subtitle;
      stepNode.textContent = step;

      const target = selector ? document.querySelector(selector) : null;
      if (!target) {
        box.style.opacity = "0";
        label.style.opacity = "1";
        label.style.left = "48px";
        label.style.top = "44px";
        return;
      }
      const rect = target.getBoundingClientRect();
      const margin = 10;
      box.style.opacity = "1";
      box.style.left = `${Math.max(12, rect.left - margin)}px`;
      box.style.top = `${Math.max(12, rect.top - margin)}px`;
      box.style.width = `${Math.min(window.innerWidth - 24, rect.width + margin * 2)}px`;
      box.style.height = `${Math.min(window.innerHeight - 24, rect.height + margin * 2)}px`;

      const labelWidth = Math.min(680, Math.max(440, rect.width));
      const preferBelow = rect.bottom + 150 < window.innerHeight;
      let left = Math.min(window.innerWidth - labelWidth - 34, Math.max(34, rect.left));
      let top = preferBelow ? rect.bottom + 20 : rect.top - 160;
      if (top < 24) top = 24;
      label.style.width = `${labelWidth}px`;
      label.style.left = `${left}px`;
      label.style.top = `${top}px`;
      label.style.opacity = "1";
    };
  }, { fontSize });
}

async function recordSegmentAttempt(variantKey, segment, index, tmpDir, attempt) {
  const variant = variants[variantKey];
  const rawDir = path.join(tmpDir, "raw", `${String(index).padStart(2, "0")}-${attempt}`);
  const segmentVideo = path.join(tmpDir, "segments", `${String(index).padStart(2, "0")}.mp4`);
  rmSync(rawDir, { recursive: true, force: true });
  mkdirSync(rawDir, { recursive: true });
  mkdirSync(path.dirname(segmentVideo), { recursive: true });

  let browser;
  let context;
  let page;
  const errors = [];
  let recordStart = Date.now();
  let markOffset = 0;
  let closing = false;

  try {
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } }
    });
    page = await context.newPage();

    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("close", () => {
      if (!closing) errors.push("page closed during recording");
    });
    recordStart = Date.now();

    await page.goto(`${pageUrl}${pageUrl.includes("?") ? "&" : "?"}recording=${variantKey}-${index}-${attempt}-${Date.now()}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000
    });
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: variant.uiButton }).click({ timeout: 10_000 }).catch(() => undefined);
    await page.waitForTimeout(350);
    await installOverlay(page, variantKey);
    await switchTab(page, segment.tab);
    await scrollToTarget(page, segment.selector);
    await runAction(page, segment.action);
    await page.evaluate(
      (payload) => window.__demoMark?.(payload),
      {
        selector: segment.selector,
        title: segment.title,
        subtitle: segment.subtitle,
        step: `${index + 1}/${variants[variantKey].segments.length}`
      }
    );
    markOffset = Math.max(0, (Date.now() - recordStart) / 1000);
    await page.waitForTimeout(Math.ceil((segment.duration + 1.2) * 1000));
    await page.screenshot({ path: path.join(root, "output", "playwright", `demo-${variantKey}-${String(index).padStart(2, "0")}.png`), fullPage: false }).catch(() => undefined);
  } finally {
    closing = true;
    if (context) await context.close().catch(() => undefined);
    if (browser) await browser.close().catch(() => undefined);
  }

  const recorded = findRecordedVideo(rawDir);
  if (!recorded) throw new Error(`No Playwright video produced for ${variantKey} segment ${index + 1}`);
  ffmpeg([
    "-y",
    "-i",
    recorded,
    "-ss",
    markOffset.toFixed(3),
    "-t",
    segment.duration.toFixed(3),
    "-vf",
    "scale=1920:1080:flags=lanczos,fps=60,format=yuv420p",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    "-r",
    "60",
    segmentVideo
  ]);
  const segmentDuration = ffprobeDuration(segmentVideo);
  if (!Number.isFinite(segmentDuration) || segmentDuration < segment.duration - 0.4) {
    throw new Error(
      `Rendered segment too short for ${variantKey} segment ${index + 1}: ${segmentDuration.toFixed(2)}s, expected ${segment.duration.toFixed(2)}s`
    );
  }

  if (errors.length) console.warn(`Browser warnings while recording ${variantKey} segment ${index + 1}: ${errors.join(" | ")}`);
  return segmentVideo;
}

async function recordSegmentVideo(variantKey, segment, index, tmpDir) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      if (attempt > 1) console.log(`Retrying ${variants[variantKey].name} segment ${index + 1}, attempt ${attempt}/3`);
      return await recordSegmentAttempt(variantKey, segment, index, tmpDir, attempt);
    } catch (error) {
      lastError = error;
      console.warn(`Segment ${variantKey}-${index + 1} attempt ${attempt} failed: ${error.message}`);
    }
  }
  throw lastError;
}

function concatSegmentVideos(segmentVideos, tmpDir) {
  const sourceVideo = path.join(tmpDir, "source.mp4");
  const listFile = path.join(tmpDir, "segments.txt");
  writeFileSync(listFile, segmentVideos.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
  ffmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", sourceVideo]);
  return sourceVideo;
}

async function recordVideo(variantKey, timings, tmpDir) {
  rmSync(path.join(tmpDir, "raw"), { recursive: true, force: true });
  rmSync(path.join(tmpDir, "segments"), { recursive: true, force: true });
  mkdirSync(path.join(root, "output", "playwright"), { recursive: true });

  const segmentVideos = [];
  for (let index = 0; index < timings.length; index++) {
    console.log(`Recording ${variants[variantKey].name} segment ${index + 1}/${timings.length}: ${timings[index].title}`);
    segmentVideos.push(await recordSegmentVideo(variantKey, timings[index], index, tmpDir));
  }

  const sourceVideo = concatSegmentVideos(segmentVideos, tmpDir);
  let cursor = 0;
  const alignedTimings = timings.map((segment) => {
    const aligned = { ...segment, start: cursor, end: cursor + segment.duration };
    cursor += segment.duration;
    return aligned;
  });
  return { sourceVideo, timings: alignedTimings };
}

function renderFinal(variantKey, sourceVideo, voiceTrack, musicTrack, timings, tmpDir) {
  const target = outputByLanguage[variantKey].final;
  const srtPath = path.join(tmpDir, `${variantKey}.srt`);
  buildSrt(timings, srtPath);

  ffmpeg([
    "-y",
    "-i",
    sourceVideo,
    "-i",
    voiceTrack,
    "-i",
    musicTrack,
    "-filter_complex",
    "[0:v]scale=1920:1080:flags=lanczos,fps=60,format=yuv420p[v];[1:a]volume=1.0[voice];[2:a]volume=0.82[music];[voice][music]amix=inputs=2:duration=longest:dropout_transition=2[a]",
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "19",
    "-pix_fmt",
    "yuv420p",
    "-r",
    "60",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    "-shortest",
    target
  ]);

  if (outputByLanguage[variantKey].legacy) {
    ffmpeg(["-y", "-i", target, "-c", "copy", outputByLanguage[variantKey].legacy]);
  }
}

async function buildVariant(variantKey) {
  const tmpDir = path.join(tmpRoot, variantKey);
  mkdirSync(tmpDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  if (!process.env.MATCHPULSE_DEMO_REUSE_SOURCE) {
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
  }

  console.log(`Preparing ${variants[variantKey].name} narration...`);
  const preparedTimings = prepareAudio(variantKey, tmpDir);
  let sourceVideo;
  let timings;
  if (process.env.MATCHPULSE_DEMO_REUSE_SOURCE) {
    sourceVideo = path.join(tmpDir, "source.mp4");
    if (!existsSync(sourceVideo)) throw new Error(`Cannot reuse missing source video: ${sourceVideo}`);
    let cursor = 0;
    timings = preparedTimings.map((segment) => {
      const aligned = { ...segment, start: cursor, end: cursor + segment.duration };
      cursor += segment.duration;
      return aligned;
    });
  } else {
    console.log(`Recording ${variants[variantKey].name} frontend...`);
    const recorded = await recordVideo(variantKey, preparedTimings, tmpDir);
    sourceVideo = recorded.sourceVideo;
    timings = recorded.timings;
  }
  const sourceDuration = ffprobeDuration(sourceVideo);
  console.log(`Mixing ${variants[variantKey].name} audio...`);
  const voiceTrack = renderVoiceTrack(timings, tmpDir);
  const musicTrack = renderMusicTrack(sourceDuration, tmpDir);
  console.log(`Rendering ${variants[variantKey].name} final video...`);
  renderFinal(variantKey, sourceVideo, voiceTrack, musicTrack, timings, tmpDir);
  console.log(`Wrote ${outputByLanguage[variantKey].final}`);
}

if (!existsSync(path.join(root, "node_modules"))) throw new Error("node_modules not found. Run npm install first.");
if (!existsSync(edgeTts)) console.warn("edge-tts venv not found. Falling back to macOS say voices.");

const selectedVariantKeys = (process.env.MATCHPULSE_DEMO_VARIANTS || "en,zh")
  .split(",")
  .map((key) => key.trim())
  .filter(Boolean);

for (const variantKey of selectedVariantKeys) {
  if (!variants[variantKey]) throw new Error(`Unknown demo variant: ${variantKey}`);
  await buildVariant(variantKey);
}
