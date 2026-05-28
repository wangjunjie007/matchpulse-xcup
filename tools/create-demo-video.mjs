import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const tmpDir = path.join(root, "tmp", "video", "pro-demo");
const audioDir = path.join(tmpDir, "audio");
const rawDir = path.join(tmpDir, "raw");
const sourceVideo = path.join(tmpDir, "source.webm");
const voiceTrack = path.join(tmpDir, "voice.m4a");
const musicTrack = path.join(tmpDir, "music.m4a");
const finalVideo = path.join(root, "docs", "matchpulse-xcup-demo.mp4");

const pageUrl = process.env.MATCHPULSE_DEMO_URL || "http://127.0.0.1:5178/matchpulse-xcup/";
const voice = process.env.MATCHPULSE_DEMO_VOICE || "Samantha";
const voiceRate = process.env.MATCHPULSE_DEMO_VOICE_RATE || "205";

const segments = [
  {
    selector: ".heroConsole",
    title: "Product overview",
    subtitle: "X Layer testnet prediction market with dynamic Hook fees.",
    narration:
      "MatchPulse X Cup is an X Layer testnet prediction market for football matches. It combines outcome tokens, a match oracle, and a v4 style Hook that prices live match volatility into swap fees.",
    before: async (page) => {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await switchTab(page, "market");
    }
  },
  {
    selector: ".broadcastRail",
    title: "Live match intensity",
    subtitle: "Clock, score, market risk, and crowd heat change continuously.",
    narration:
      "The broadcast rail is alive. The match clock, score, market risk, and crowd heat keep changing, so judges see a live sports market instead of a static dashboard."
  },
  {
    selector: ".simulationDeck",
    title: "Local simulation is clearly labeled",
    subtitle: "Frontend simulation is separated from real X Layer reads and writes.",
    narration:
      "The dynamic match engine is labeled as local simulation. It drives the front end experience, while real testnet reads and writes stay separate and verifiable on X Layer.",
    before: async (page) => {
      const pauseButton = page.locator(".simulationActions button").first();
      await page.evaluate(() => document.querySelector(".simulationActions button")?.click());
      await page.waitForTimeout(600);
      await page.evaluate(() => document.querySelector(".simulationActions button")?.click());
    }
  },
  {
    selector: ".hookPanel",
    title: "Core innovation: Hook fee engine",
    subtitle: "Live, close-score, red-card, and upset signals raise LP protection fees.",
    narration:
      "The core innovation is the Hook fee engine. Live pressure, close scores, red cards, late-game volatility, and upset signals raise fees to protect liquidity providers from toxic event flow.",
    before: async (page) => {
      await switchTab(page, "market");
      await scrollToTarget(page, ".hookPanel");
    }
  },
  {
    selector: ".outcomeGrid",
    title: "Outcome market interaction",
    subtitle: "Selecting an outcome updates odds, tokens, and the event log.",
    narration:
      "The outcome cards show market interaction. Selecting a side updates implied odds, estimated outcome tokens, and the live event log while the fee model keeps responding to match state.",
    before: async (page) => {
      await switchTab(page, "market");
      await page.evaluate(() => document.querySelectorAll(".outcome")[2]?.click());
      await page.waitForTimeout(500);
      await page.evaluate(() => document.querySelectorAll(".outcome")[0]?.click());
      await scrollToTarget(page, ".outcomeGrid");
    }
  },
  {
    selector: ".walletPanel",
    title: "Real testnet control surface",
    subtitle: "Wallet connection, X Layer switching, minting, and Hook test transactions.",
    narration:
      "The Chain tab is the real testnet control surface. It exposes wallet connection, X Layer switching, minting a complete set, and an on-chain Hook test transaction.",
    before: async (page) => {
      await switchTab(page, "chain");
      await scrollToTarget(page, ".walletPanel", "start");
    }
  },
  {
    selector: ".chainReadPanel",
    title: "Live chain reads",
    subtitle: "Hook quote, pool metrics, token balances, and market collateral are read from X Layer.",
    narration:
      "The app reads live chain state from X Layer testnet: Hook quotes, pool metrics, token balances, market collateral, settlement status, and winner data.",
    before: async (page) => {
      await switchTab(page, "chain");
      await scrollToTarget(page, ".chainReadPanel", "center");
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"));
        buttons.find((button) => /刷新链上数据|Refresh chain data/.test(button.textContent || ""))?.click();
      }).catch(() => undefined);
      await page.waitForTimeout(1100);
    }
  },
  {
    selector: ".settlementPanel",
    title: "Complete settlement loop",
    subtitle: "Write final score, settle the market, then redeem winning tokens.",
    narration:
      "The testnet settlement loop is visible. The owner wallet writes the final mock score, anyone can settle the market, and users can redeem winning tokens through the deployed factory.",
    before: async (page) => {
      await switchTab(page, "chain");
      await scrollToTarget(page, ".settlementPanel", "center");
    }
  },
  {
    selector: ".deployPanel",
    title: "Auditable deployment evidence",
    subtitle: "Every contract and token address links to the X Layer testnet explorer.",
    narration:
      "The deployment panel makes the demo auditable. Every core contract and token address is surfaced in the UI and linked to the OKX X Layer testnet explorer.",
    before: async (page) => {
      await switchTab(page, "chain");
      await scrollToTarget(page, ".deployPanel", "center");
    }
  },
  {
    selector: ".judgeGrid",
    title: "Judge view and production path",
    subtitle: "The demo is testnet-ready, with a clear roadmap toward production.",
    narration:
      "The judge view explains why dynamic fees matter. MatchPulse is ready for hackathon judging and testnet beta iteration, with a roadmap toward production oracle, pool manager integration, and audit-grade controls.",
    before: async (page) => {
      await switchTab(page, "judge");
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      await page.waitForTimeout(600);
    }
  }
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function capture(command, args) {
  return execFileSync(command, args, { encoding: "utf8" }).trim();
}

function ffprobeDuration(file) {
  return Number(capture("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file]));
}

async function switchTab(page, tabName) {
  await page.locator(`[role="tab"][aria-controls$="content-${tabName}"]`).click({ timeout: 10_000 });

  const visibleSelector =
    tabName === "chain" ? ".walletPanel" : tabName === "judge" ? ".judgeGrid" : ".outcomeGrid";
  await page.waitForSelector(visibleSelector, { state: "visible", timeout: 10_000 });
  await page.waitForTimeout(450);
}

async function scrollToTarget(page, selector, block = "center") {
  await page.waitForSelector(selector, { state: "visible", timeout: 10_000 });
  await page.evaluate(
    ({ selector: targetSelector, blockPosition }) => {
      document.querySelector(targetSelector)?.scrollIntoView({ block: blockPosition, inline: "nearest", behavior: "smooth" });
    },
    { selector, blockPosition: block }
  );
  await page.waitForTimeout(750);
}

function prepareAudio() {
  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(audioDir, { recursive: true });
  mkdirSync(rawDir, { recursive: true });
  mkdirSync(path.join(root, "docs"), { recursive: true });

  return segments.map((segment, index) => {
    const audioPath = path.join(audioDir, `${String(index).padStart(2, "0")}.aiff`);
    run("say", ["-v", voice, "-r", voiceRate, "-o", audioPath, segment.narration], { stdio: "ignore" });
    const duration = ffprobeDuration(audioPath);
    return { ...segment, audioPath, duration };
  });
}

function renderVoiceTrack(timings) {
  const inputs = timings.flatMap((segment) => ["-i", segment.audioPath]);
  const delayedInputs = timings
    .map((segment, index) => {
      const delayMs = Math.max(0, Math.round(segment.start * 1000));
      return `[${index}:a]adelay=${delayMs}:all=1[v${index}]`;
    })
    .join(";");
  const mixInputs = timings.map((_, index) => `[v${index}]`).join("");
  run("ffmpeg", [
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
    voiceTrack
  ]);
}

function renderMusicTrack(totalDuration) {
  run("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=110:duration=${totalDuration}:sample_rate=48000`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=220:duration=${totalDuration}:sample_rate=48000`,
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=330:duration=${totalDuration}:sample_rate=48000`,
    "-filter_complex",
    "[0:a]volume=0.018[a0];[1:a]volume=0.010[a1];[2:a]volume=0.006[a2];[a0][a1][a2]amix=inputs=3:duration=first,afade=t=in:st=0:d=2,afade=t=out:st=" +
      Math.max(0, totalDuration - 3).toFixed(2) +
      ":d=3[music]",
    "-map",
    "[music]",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    musicTrack
  ]);
}

async function installOverlay(page) {
  await page.evaluate(() => {
    const root = document.createElement("div");
    root.id = "demo-pro-overlay";
    root.innerHTML = `
      <div class="demo-highlight"></div>
      <div class="demo-label">
        <strong></strong>
        <span></span>
      </div>
      <div class="demo-subtitle"></div>
      <div class="demo-step"></div>
    `;
    document.body.appendChild(root);
    const style = document.createElement("style");
    style.textContent = `
      #demo-pro-overlay { position: fixed; inset: 0; z-index: 999999; pointer-events: none; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      #demo-pro-overlay .demo-highlight { position: fixed; border: 5px solid #f7d95b; border-radius: 14px; box-shadow: 0 0 0 9999px rgba(0, 0, 0, .12), 0 0 38px rgba(247, 217, 91, .62); transition: all 420ms ease; opacity: 0; }
      #demo-pro-overlay .demo-label { position: fixed; max-width: 620px; padding: 16px 18px; border: 1px solid rgba(255,255,255,.24); border-radius: 10px; background: rgba(3, 13, 11, .88); color: #fff; box-shadow: 0 24px 60px rgba(0,0,0,.32); transition: all 420ms ease; opacity: 0; }
      #demo-pro-overlay .demo-label strong { display: block; color: #f7d95b; font-size: 28px; line-height: 1.1; }
      #demo-pro-overlay .demo-label span { display: block; margin-top: 8px; color: #e8f4ee; font-size: 20px; font-weight: 780; line-height: 1.28; }
      #demo-pro-overlay .demo-subtitle { position: fixed; left: 50%; bottom: 34px; width: min(1320px, calc(100vw - 260px)); transform: translateX(-50%); padding: 13px 18px; border-radius: 10px; background: rgba(0,0,0,.72); color: #fff; font-size: 34px; font-weight: 850; line-height: 1.22; text-align: center; text-shadow: 0 2px 8px rgba(0,0,0,.5); }
      #demo-pro-overlay .demo-step { position: fixed; right: 28px; bottom: 30px; padding: 10px 14px; border-radius: 999px; background: rgba(233,75,86,.94); color: #fff; font-size: 20px; font-weight: 950; letter-spacing: .02em; }
    `;
    document.head.appendChild(style);

    window.__demoMark = ({ selector, title, subtitle, step }) => {
      const box = root.querySelector(".demo-highlight");
      const label = root.querySelector(".demo-label");
      const subtitleNode = root.querySelector(".demo-subtitle");
      const stepNode = root.querySelector(".demo-step");
      const strong = label.querySelector("strong");
      const span = label.querySelector("span");
      strong.textContent = title;
      span.textContent = subtitle;
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

      const labelWidth = Math.min(620, Math.max(420, rect.width));
      const preferBelow = rect.bottom + 138 < window.innerHeight;
      let left = Math.min(window.innerWidth - labelWidth - 34, Math.max(34, rect.left));
      let top = preferBelow ? rect.bottom + 20 : rect.top - 150;
      if (top < 24) top = 24;
      label.style.width = `${labelWidth}px`;
      label.style.left = `${left}px`;
      label.style.top = `${top}px`;
      label.style.opacity = "1";
    };
  });
}

async function recordVideo(timings) {
  rmSync(rawDir, { recursive: true, force: true });
  mkdirSync(rawDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: rawDir, size: { width: 1920, height: 1080 } }
  });
  const page = await context.newPage();
  const errors = [];
  const visualStarts = [];
  const recordStart = Date.now();
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(`${pageUrl}${pageUrl.includes("?") ? "&" : "?"}recording=${Date.now()}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000
  });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /^EN$/ }).click({ timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
  await installOverlay(page);

  for (let index = 0; index < timings.length; index++) {
    const segment = timings[index];
    if (segment.before) await segment.before(page);
    await page.evaluate(
      (payload) => window.__demoMark?.(payload),
      {
        selector: segment.selector,
        title: segment.title,
        subtitle: segment.subtitle,
        step: `${index + 1}/${timings.length}`
      }
    );
    visualStarts.push((Date.now() - recordStart) / 1000);
    await page.waitForTimeout(Math.ceil(segment.duration * 1000));
  }

  await page.screenshot({ path: path.join(root, "output", "playwright", "pro-demo-last-frame.png"), fullPage: false });
  await context.close();
  await browser.close();

  const videos = readdirSync(rawDir).filter((file) => file.endsWith(".webm"));
  if (!videos.length) throw new Error("No Playwright video produced");
  const recorded = path.join(rawDir, videos[0]);
  rmSync(sourceVideo, { force: true });
  run("ffmpeg", ["-y", "-i", recorded, "-c", "copy", sourceVideo]);

  if (errors.length) {
    throw new Error(`Browser errors while recording: ${errors.join(" | ")}`);
  }

  return timings.map((segment, index) => ({
    ...segment,
    start: visualStarts[index],
    end: visualStarts[index] + segment.duration
  }));
}

function renderFinal(videoDuration) {
  const sourceVideoName = path.basename(sourceVideo);
  const voiceTrackName = path.basename(voiceTrack);
  const musicTrackName = path.basename(musicTrack);
  run("ffmpeg", [
    "-y",
    "-i",
    sourceVideoName,
    "-i",
    voiceTrackName,
    "-i",
    musicTrackName,
    "-filter_complex",
    "[0:v]scale=1920:1080:flags=lanczos,fps=60[v];[1:a]volume=1.0[voice];[2:a]volume=1.0[music];[voice][music]amix=inputs=2:duration=longest:dropout_transition=2[a]",
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
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
    "-t",
    videoDuration.toFixed(3),
    finalVideo
  ], { cwd: tmpDir });
}

if (!existsSync(path.join(root, "node_modules"))) {
  throw new Error("node_modules not found. Run npm install first.");
}

const preparedTimings = prepareAudio();
const visualTimings = await recordVideo(preparedTimings);
const sourceDuration = ffprobeDuration(sourceVideo);
renderVoiceTrack(visualTimings);
renderMusicTrack(sourceDuration);
renderFinal(sourceDuration);
console.log(`Wrote ${finalVideo}`);
