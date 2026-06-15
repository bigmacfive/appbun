import { mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const tmpDir = resolve(root, "tmp");
const width = 1280;
const height = 720;
const fps = 18;

const demos = [
  {
    slug: "terminal-demo",
    command: `appbun dev --name "My App" --dmg --yes`,
    durationSeconds: 10.8,
    sideTitle: "Generated output",
    sideChips: ["Inspectable app code", "Config manifest", "Doctor checks", "macOS DMG"],
    finalLabel: "My App.dmg",
    finalMeta: "ready for local install",
    logs: [
      { at: 4.1, text: "Detected http://localhost:3000" },
      { at: 4.55, text: "Resolved metadata: My App" },
      { at: 5.0, text: "Created ../appbun-output/my-app" },
      { at: 5.45, text: "Generated fallback icon assets" },
      { at: 5.95, text: "doctor --project: 6 checks ok" },
      { at: 6.55, text: "Installed shell dependencies" },
      { at: 7.25, text: "Built macOS app bundle" },
      { at: 8.15, text: "Packaged My App.dmg" },
    ],
  },
  {
    slug: "url-to-code",
    command: `appbun chatgpt --titlebar compact --yes`,
    durationSeconds: 7.4,
    sideTitle: "App code created",
    sideChips: ["README with badge", "appbun.generated.json", "Editable shell", "Release workflow"],
    finalLabel: "chatgpt/",
    finalMeta: "inspectable project",
    logs: [
      { at: 3.0, text: "Recipe: chatgpt (ChatGPT)" },
      { at: 3.45, text: "Fetched title, icon, and theme" },
      { at: 3.95, text: "Wrote Electrobun shell" },
      { at: 4.5, text: "Added Built with appbun badge" },
      { at: 5.1, text: "Generated appbun.generated.json" },
    ],
  },
  {
    slug: "code-to-dmg",
    command: `cd chatgpt && bun run build:dmg`,
    durationSeconds: 7.6,
    sideTitle: "Package steps",
    sideChips: ["Build stable app", "Optional codesign", "Create DMG", "Open installer"],
    finalLabel: "ChatGPT.dmg",
    finalMeta: "unsigned personal installer",
    logs: [
      { at: 2.9, text: "electrobun build --env=stable" },
      { at: 3.55, text: "Found ChatGPT.app" },
      { at: 4.15, text: "No APPLE_SIGN_IDENTITY: unsigned mode" },
      { at: 4.85, text: "hdiutil packaged DMG" },
      { at: 5.55, text: "build/dmg/ChatGPT.dmg ready" },
    ],
  },
  {
    slug: "agent-workflow",
    command: `Codex: package localhost:3000 with appbun`,
    durationSeconds: 8.2,
    sideTitle: "Agent workflow",
    sideChips: ["Detect dev server", "Run appbun create", "Doctor project", "Build DMG"],
    finalLabel: "localhost app",
    finalMeta: "Codex-ready desktop build",
    logs: [
      { at: 3.25, text: "Codex finds http://localhost:3000" },
      { at: 3.85, text: "npx -y appbun@latest dev --yes" },
      { at: 4.45, text: "Generated desktop/my-app" },
      { at: 5.05, text: "doctor --project: ready" },
      { at: 5.75, text: "package --dmg: DMG created" },
    ],
  },
];

await rm(tmpDir, { recursive: true, force: true });
await mkdir(tmpDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

try {
  for (const demo of demos) {
    await renderDemo(browser, demo);
  }
} finally {
  await browser.close();
  await rm(tmpDir, { recursive: true, force: true });
}

async function renderDemo(browser, demo) {
  const framesDir = resolve(tmpDir, `${demo.slug}-frames`);
  const palettePath = resolve(tmpDir, `${demo.slug}-palette.png`);
  const mp4Path = resolve(tmpDir, `${demo.slug}.mp4`);
  const gifPath = resolve(root, "docs", "assets", `${demo.slug}.gif`);
  const frameCount = Math.round(fps * demo.durationSeconds);

  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });

  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });

  try {
    await page.setContent(buildHtml(demo), { waitUntil: "load" });

    for (let index = 0; index < frameCount; index += 1) {
      const time = index / fps;
      await page.evaluate((value) => {
        window.renderDemoFrame(value);
      }, time);
      await page.screenshot({
        path: resolve(framesDir, `frame-${String(index).padStart(4, "0")}.png`),
        type: "png",
      });
    }
  } finally {
    await page.close();
  }

  run("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-framerate",
    String(fps),
    "-i",
    resolve(framesDir, "frame-%04d.png"),
    "-vf",
    "format=yuv420p",
    "-movflags",
    "+faststart",
    mp4Path,
  ]);

  run("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-i",
    mp4Path,
    "-vf",
    "fps=18,scale=1280:-1:flags=lanczos,palettegen=stats_mode=diff",
    "-frames:v",
    "1",
    "-update",
    "1",
    palettePath,
  ]);

  run("ffmpeg", [
    "-y",
    "-v",
    "error",
    "-i",
    mp4Path,
    "-i",
    palettePath,
    "-lavfi",
    "fps=18,scale=1280:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=2:diff_mode=rectangle",
    "-loop",
    "0",
    gifPath,
  ]);

  console.log(`rendered ${gifPath}`);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}`);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function buildHtml(demo) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #000;
    color: #f5f5f5;
    font-family: "SF Pro Display", "Inter", "Segoe UI", sans-serif;
  }
  body {
    background:
      radial-gradient(circle at 50% -10%, rgba(255,255,255,0.08), transparent 38%),
      radial-gradient(circle at 82% 72%, rgba(255,255,255,0.045), transparent 34%),
      linear-gradient(180deg, #020202 0%, #070707 52%, #000 100%);
  }
  .grain {
    position: fixed;
    inset: 0;
    pointer-events: none;
    opacity: 0.18;
    background-image:
      linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
    background-size: 48px 48px;
    mask-image: radial-gradient(circle at center, black, transparent 80%);
  }
  .wrap {
    position: relative;
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    padding: 50px 72px;
  }
  .window {
    width: 1080px;
    height: 590px;
    overflow: hidden;
    border-radius: 22px;
    background: #080808;
    border: 1px solid #2a2a2a;
    box-shadow:
      0 58px 150px rgba(0, 0, 0, 0.88),
      0 0 0 1px rgba(255,255,255,0.04) inset,
      0 0 120px rgba(255,255,255,0.035);
  }
  .topbar {
    position: relative;
    height: 58px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    background: linear-gradient(180deg, #141414, #0e0e0e);
    border-bottom: 1px solid #262626;
  }
  .traffic { display: flex; gap: 10px; align-items: center; }
  .traffic span {
    width: 12px;
    height: 12px;
    border-radius: 999px;
    background: #565656;
    border: 1px solid #6a6a6a;
  }
  .traffic span:nth-child(2) { background: #444; border-color: #5a5a5a; }
  .traffic span:nth-child(3) { background: #333; border-color: #4c4c4c; }
  .title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    color: #b6b6b6;
    font-size: 13px;
    font-weight: 650;
    letter-spacing: 0.12em;
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    height: 30px;
    padding: 0 12px;
    border-radius: 999px;
    color: #d8d8d8;
    font-size: 12px;
    font-weight: 720;
    background: #191919;
    border: 1px solid #353535;
  }
  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: #cfcfcf;
    box-shadow: 0 0 14px rgba(255,255,255,0.24);
  }
  .terminal {
    position: relative;
    height: calc(100% - 58px);
    padding: 34px 42px 30px;
    font-family: "SF Mono", "JetBrains Mono", "Menlo", monospace;
    font-variant-ligatures: none;
    background:
      linear-gradient(180deg, rgba(255,255,255,0.025), transparent 22%),
      #050505;
  }
  .block {
    width: 710px;
    min-height: 82px;
    padding: 19px 20px;
    border-radius: 15px;
    background: #0d0d0d;
    border: 1px solid #272727;
    box-shadow: 0 22px 70px rgba(0,0,0,0.34);
  }
  .prompt {
    display: flex;
    align-items: baseline;
    gap: 12px;
    white-space: pre;
    font-size: 22px;
    font-weight: 760;
    letter-spacing: 0;
  }
  .path { color: #d8d8d8; }
  .cash { color: #9b9b9b; }
  .cmd { color: #f4f4f4; }
  .cursor {
    display: inline-block;
    width: 12px;
    height: 26px;
    margin-left: 4px;
    border-radius: 3px;
    background: #e6e6e6;
    transform: translateY(4px);
    opacity: var(--cursor-opacity, 1);
  }
  .logs {
    margin-top: 18px;
    display: grid;
    gap: 9px;
    font-size: 13px;
    line-height: 1.3;
  }
  .log {
    display: flex;
    align-items: center;
    gap: 10px;
    width: max-content;
    max-width: 100%;
    min-height: 28px;
    padding: 6px 10px 6px 7px;
    color: #c8c8c8;
    background: #111;
    border: 1px solid #252525;
    border-radius: 9px;
    opacity: 0;
    transform: translateY(7px);
  }
  .log.show {
    opacity: 1;
    transform: translateY(0);
  }
  .check {
    width: 16px;
    height: 16px;
    border-radius: 999px;
    display: inline-grid;
    place-items: center;
    color: #090909;
    font-size: 11px;
    font-weight: 900;
    background: #d6d6d6;
    flex: 0 0 auto;
  }
  .side {
    position: absolute;
    top: 66px;
    right: 58px;
    width: 258px;
    padding: 18px;
    border-radius: 16px;
    background: #101010;
    border: 1px solid #2e2e2e;
    box-shadow: 0 28px 84px rgba(0,0,0,0.44);
    opacity: 0;
    transform: translateY(12px) scale(0.985);
  }
  .side.show { opacity: 1; transform: translateY(0) scale(1); }
  .side h2 {
    margin: 0 0 14px;
    color: #eeeeee;
    font-family: "SF Pro Display", "Inter", sans-serif;
    font-size: 14px;
    letter-spacing: 0;
  }
  .chip {
    width: max-content;
    max-width: 100%;
    margin-top: 8px;
    padding: 7px 10px;
    border-radius: 999px;
    color: #cfcfcf;
    background: #1b1b1b;
    border: 1px solid #303030;
    font-size: 12px;
  }
  .chip::before {
    content: "";
    display: inline-block;
    width: 7px;
    height: 7px;
    margin-right: 8px;
    border-radius: 999px;
    background: #a8a8a8;
  }
  .progress-wrap {
    position: absolute;
    left: 64px;
    right: 64px;
    bottom: 48px;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 18px;
  }
  .track {
    height: 9px;
    padding: 1px;
    overflow: hidden;
    border-radius: 999px;
    background: #151515;
    border: 1px solid #303030;
  }
  .bar {
    width: 0%;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #ececec, #787878);
    box-shadow: 0 0 18px rgba(255,255,255,0.12);
  }
  .pct {
    min-width: 52px;
    text-align: right;
    color: #d6d6d6;
    font-family: "SF Mono", "JetBrains Mono", monospace;
    font-size: 14px;
    font-weight: 800;
  }
  .final {
    position: absolute;
    right: 58px;
    bottom: 78px;
    width: 270px;
    padding: 15px;
    border-radius: 16px;
    background: #121212;
    border: 1px solid #343434;
    box-shadow: 0 28px 84px rgba(0,0,0,0.48);
    opacity: 0;
    transform: translateY(16px);
  }
  .final.show { opacity: 1; transform: translateY(0); }
  .file {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .file-icon {
    position: relative;
    width: 44px;
    height: 54px;
    border-radius: 9px;
    background: linear-gradient(160deg, #efefef, #8d8d8d);
    box-shadow: 0 18px 34px rgba(0,0,0,0.3);
  }
  .file-icon::before {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    width: 14px;
    height: 14px;
    border-radius: 0 8px 0 5px;
    background: #b7b7b7;
  }
  .file-icon::after {
    content: "DMG";
    position: absolute;
    inset: auto 7px 8px;
    height: 15px;
    display: grid;
    place-items: center;
    border-radius: 5px;
    color: #ededed;
    background: #151515;
    font-size: 8px;
    font-weight: 900;
  }
  .file strong {
    display: block;
    color: #f0f0f0;
    font-family: "SF Pro Display", "Inter", sans-serif;
    font-size: 15px;
  }
  .file span {
    display: block;
    margin-top: 5px;
    color: #a7a7a7;
    font-size: 12px;
  }
</style>
</head>
<body>
  <div class="grain"></div>
  <main class="wrap">
    <section class="window">
      <div class="topbar">
        <div class="traffic"><span></span><span></span><span></span></div>
        <div class="title">appbun</div>
        <div class="status"><span class="status-dot"></span><span id="status">Ready</span></div>
      </div>
      <div class="terminal">
        <section class="block">
          <div class="prompt">
            <span class="path">~/web-app</span><span class="cash">$</span><span class="cmd" id="typed"></span><span class="cursor" id="cursor"></span>
          </div>
          <div class="logs" id="logs">${demo.logs.map((log, index) => `<div class="log" data-at="${log.at}" id="log-${index}"><span class="check">✓</span><span>${escapeHtml(log.text)}</span></div>`).join("")}</div>
        </section>
        <aside class="side" id="side">
          <h2>${escapeHtml(demo.sideTitle)}</h2>
          ${demo.sideChips.map((chip) => `<div class="chip">${escapeHtml(chip)}</div>`).join("")}
        </aside>
        <div class="final" id="final">
          <div class="file">
            <div class="file-icon"></div>
            <div>
              <strong>${escapeHtml(demo.finalLabel)}</strong>
              <span>${escapeHtml(demo.finalMeta)}</span>
            </div>
          </div>
        </div>
        <div class="progress-wrap">
          <div class="track"><div class="bar" id="bar"></div></div>
          <div class="pct" id="pct">0%</div>
        </div>
      </div>
    </section>
  </main>
  <script>
    const command = ${JSON.stringify(demo.command)};
    const typed = document.getElementById("typed");
    const cursor = document.getElementById("cursor");
    const status = document.getElementById("status");
    const side = document.getElementById("side");
    const final = document.getElementById("final");
    const bar = document.getElementById("bar");
    const pct = document.getElementById("pct");
    const logs = [...document.querySelectorAll(".log")].map((element) => ({
      element,
      at: Number(element.dataset.at),
    }));

    window.renderDemoFrame = (time) => {
      const typingStart = 0.55;
      const typingEnd = 3.75;
      const typingProgress = clamp((time - typingStart) / (typingEnd - typingStart), 0, 1);
      const chars = Math.floor(easeOutCubic(typingProgress) * command.length);
      typed.textContent = command.slice(0, chars);
      cursor.style.setProperty("--cursor-opacity", Math.sin(time * 9) > -0.2 ? "1" : "0");

      const running = time > typingEnd + 0.2;
      const doneAt = ${JSON.stringify(Math.max(0, demo.durationSeconds - 1.4))};
      const sideAt = ${JSON.stringify(Math.min(4.25, demo.durationSeconds * 0.58))};
      const finalAt = ${JSON.stringify(Math.max(0, demo.durationSeconds - 1.95))};
      status.textContent = time > doneAt ? "Done" : running ? "Running" : "Ready";
      side.classList.toggle("show", time > sideAt);
      final.classList.toggle("show", time > finalAt);

      logs.forEach(({ element, at }) => {
        element.classList.toggle("show", time >= at);
      });

      const progressEnd = ${JSON.stringify(Math.max(0, demo.durationSeconds - 1.9))};
      const progress = time < 3.1
        ? 0
        : time < progressEnd
          ? 8 + easeInOutCubic((time - 3.1) / Math.max(0.01, progressEnd - 3.1)) * 86
          : 100;
      const rounded = Math.max(0, Math.min(100, Math.round(progress)));
      bar.style.width = rounded + "%";
      pct.textContent = rounded + "%";
    };

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }
    function easeOutCubic(value) {
      return 1 - Math.pow(1 - clamp(value, 0, 1), 3);
    }
    function easeInOutCubic(value) {
      const x = clamp(value, 0, 1);
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }
    window.renderDemoFrame(0);
  </script>
</body>
</html>`;
}
