import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const assetDir = path.join(root, "src", "assets");
const output = path.join(assetDir, "stadium-night.png");

await mkdir(assetDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 1 });

await page.setContent(`
<!doctype html>
<html>
  <head>
    <style>
      html,
      body {
        margin: 0;
        width: 1800px;
        height: 1000px;
        overflow: hidden;
        background: #06120f;
      }

      .scene {
        position: relative;
        width: 1800px;
        height: 1000px;
        overflow: hidden;
        background:
          radial-gradient(circle at 16% 12%, rgba(244, 244, 225, 0.92), transparent 16%),
          radial-gradient(circle at 84% 12%, rgba(244, 244, 225, 0.92), transparent 16%),
          linear-gradient(180deg, #091718 0%, #10241f 32%, #08110e 100%);
      }

      .scene::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          linear-gradient(106deg, transparent 0 11%, rgba(255, 255, 255, 0.36) 12%, transparent 28%),
          linear-gradient(74deg, transparent 0 10%, rgba(255, 255, 255, 0.34) 11%, transparent 29%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 48%);
        filter: blur(10px);
        opacity: 0.78;
      }

      .upper-bowl,
      .lower-bowl {
        position: absolute;
        left: -80px;
        right: -80px;
        border-radius: 50% 50% 0 0;
        transform: perspective(1000px) rotateX(52deg);
      }

      .upper-bowl {
        top: 165px;
        height: 360px;
        background:
          repeating-linear-gradient(90deg, rgba(230, 237, 226, 0.42) 0 9px, rgba(29, 92, 68, 0.55) 9px 21px, rgba(196, 38, 56, 0.48) 21px 30px, rgba(30, 50, 45, 0.55) 30px 45px),
          linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(4, 13, 11, 0.4));
        opacity: 0.95;
      }

      .lower-bowl {
        top: 360px;
        height: 340px;
        background:
          repeating-linear-gradient(90deg, rgba(33, 106, 78, 0.76) 0 13px, rgba(239, 244, 232, 0.58) 13px 20px, rgba(21, 47, 46, 0.74) 20px 35px, rgba(209, 47, 58, 0.6) 35px 43px),
          linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(1, 8, 6, 0.72));
      }

      .roof {
        position: absolute;
        top: 55px;
        left: 140px;
        width: 1520px;
        height: 240px;
        border-radius: 48% 48% 16% 16%;
        background:
          linear-gradient(180deg, rgba(18, 37, 40, 0.82), rgba(6, 14, 14, 0.96)),
          repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.2) 0 2px, transparent 2px 42px);
        box-shadow: inset 0 -20px 44px rgba(255, 255, 255, 0.08);
      }

      .pitch {
        position: absolute;
        left: 260px;
        right: 260px;
        bottom: -28px;
        height: 460px;
        transform: perspective(820px) rotateX(58deg);
        transform-origin: bottom center;
        border: 6px solid rgba(236, 248, 231, 0.86);
        border-radius: 24px;
        background:
          linear-gradient(90deg, rgba(255, 255, 255, 0.17) 0 2px, transparent 2px 50%, rgba(255, 255, 255, 0.17) 50% calc(50% + 2px), transparent calc(50% + 2px)),
          repeating-linear-gradient(90deg, #1d7744 0 92px, #166438 92px 184px);
        box-shadow:
          0 -80px 120px rgba(147, 232, 154, 0.22),
          0 28px 70px rgba(0, 0, 0, 0.6);
      }

      .pitch::before {
        content: "";
        position: absolute;
        top: 50%;
        left: 50%;
        width: 210px;
        height: 210px;
        border: 5px solid rgba(243, 250, 237, 0.82);
        border-radius: 50%;
        transform: translate(-50%, -50%);
      }

      .pitch::after {
        content: "";
        position: absolute;
        inset: 74px 86px;
        border: 4px solid rgba(243, 250, 237, 0.68);
        border-left-width: 0;
        border-right-width: 0;
      }

      .scoreboard {
        position: absolute;
        top: 250px;
        left: 50%;
        width: 540px;
        height: 112px;
        transform: translateX(-50%);
        border: 1px solid rgba(255, 255, 255, 0.4);
        border-radius: 14px;
        background:
          linear-gradient(90deg, #78c7e7 0 26%, #111d1b 26% 74%, #fedc4a 74% 100%);
        box-shadow: 0 30px 70px rgba(0, 0, 0, 0.38);
        opacity: 0.74;
      }

      .scoreboard::before {
        content: "";
        position: absolute;
        inset: 18px 164px;
        border-radius: 8px;
        background:
          linear-gradient(90deg, rgba(255, 255, 255, 0.6), transparent 22% 78%, rgba(255, 255, 255, 0.6)),
          #08100f;
      }

      .confetti {
        position: absolute;
        width: 6px;
        height: 18px;
        border-radius: 3px;
        opacity: 0.62;
      }

      .vignette {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at center, transparent 32%, rgba(0, 0, 0, 0.34) 82%),
          linear-gradient(180deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.56));
      }
    </style>
  </head>
  <body>
    <div class="scene">
      <div class="roof"></div>
      <div class="upper-bowl"></div>
      <div class="lower-bowl"></div>
      <div class="scoreboard"></div>
      <div class="pitch"></div>
      ${Array.from({ length: 90 }, (_, index) => {
        const left = 40 + ((index * 83) % 1720);
        const top = 35 + ((index * 47) % 560);
        const rotate = (index * 29) % 180;
        const color = ["#7bdff2", "#f4d35e", "#ee6055", "#f7fff7", "#1f8f5f"][index % 5];
        return `<i class="confetti" style="left:${left}px;top:${top}px;transform:rotate(${rotate}deg);background:${color}"></i>`;
      }).join("")}
      <div class="vignette"></div>
    </div>
  </body>
</html>
`);

await page.screenshot({ path: output, type: "png" });
await browser.close();

console.log(output);
