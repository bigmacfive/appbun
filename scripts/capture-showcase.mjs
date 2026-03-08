import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const configPath = resolve(root, "docs", "showcase", "apps.json");
const rawDir = resolve(root, "docs", "screenshots", "raw");
const framedDir = resolve(root, "docs", "screenshots");
const assetsDir = resolve(root, "docs", "assets");
const apps = JSON.parse(await readFile(configPath, "utf8"));

await mkdir(rawDir, { recursive: true });
await mkdir(framedDir, { recursive: true });
await mkdir(assetsDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--disable-blink-features=AutomationControlled"],
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 1,
  colorScheme: "light",
  locale: "en-US",
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
  ignoreHTTPSErrors: true,
});

const captured = [];
for (const app of apps) {
  const rawPath = resolve(rawDir, `${app.slug}.png`);
  const framedPath = resolve(framedDir, `${app.slug}.png`);

  const page = await context.newPage();
  try {
    await page.goto(app.url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: rawPath, type: "png" });
    await captureFramedShot(app, rawPath, framedPath);
    captured.push({ ...app, imagePath: framedPath, relativeImagePath: `docs/screenshots/${app.slug}.png` });
    console.log(`captured ${app.name}`);
  } catch (error) {
    console.error(`failed ${app.name}:`, error instanceof Error ? error.message : error);
    if (existsSync(rawPath)) {
      await captureFramedShot(app, rawPath, framedPath);
      captured.push({ ...app, imagePath: framedPath, relativeImagePath: `docs/screenshots/${app.slug}.png` });
    }
  } finally {
    await page.close();
  }
}

if (captured.length === 0) {
  await context.close();
  await browser.close();
  throw new Error("No showcase screenshots were captured.");
}

await captureGallery(captured);
await captureSocialCard(captured);
await writeFile(resolve(root, "docs", "showcase", "manifest.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), apps: captured.map(({ imagePath, ...app }) => app) }, null, 2)}\n`);

await context.close();
await browser.close();

async function captureFramedShot(app, rawPath, framedPath) {
  const rawBuffer = await readFile(rawPath);
  const dataUrl = `data:image/png;base64,${rawBuffer.toString("base64")}`;
  const framePage = await browser.newPage({ viewport: { width: 1540, height: 1120 } });
  await framePage.setContent(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  :root {
    color-scheme: light;
    --accent: ${app.accent};
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    background:
      radial-gradient(circle at top left, rgba(255,255,255,0.92), rgba(255,255,255,0.6) 32%, rgba(233,236,241,0.96) 70%),
      linear-gradient(160deg, #eef2f7 0%, #f8fafc 48%, #e5e7eb 100%);
    font-family: "SF Pro Display", "Inter", sans-serif;
    color: #111827;
  }
  .window {
    width: 1440px;
    height: 960px;
    overflow: hidden;
    border-radius: 28px;
    background: rgba(255,255,255,0.98);
    border: 1px solid rgba(15,23,42,0.08);
    box-shadow: 0 32px 90px rgba(15,23,42,0.18), 0 8px 24px rgba(15,23,42,0.08);
  }
  .topbar {
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 18px 0 20px;
    background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(247,248,250,0.86));
    border-bottom: 1px solid rgba(15,23,42,0.08);
    backdrop-filter: blur(20px) saturate(1.2);
  }
  .traffic {
    display: flex;
    gap: 8px;
  }
  .traffic span {
    width: 12px;
    height: 12px;
    border-radius: 999px;
    display: block;
  }
  .traffic span:nth-child(1) { background: #ff5f57; }
  .traffic span:nth-child(2) { background: #febc2e; }
  .traffic span:nth-child(3) { background: #28c840; }
  .title {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .title .icon {
    width: 16px;
    height: 16px;
    border-radius: 5px;
    display: inline-grid;
    place-items: center;
    font-size: 10px;
    font-weight: 700;
    color: white;
    background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 54%, white));
  }
  .origin {
    font-size: 11px;
    color: rgba(55, 65, 81, 0.74);
  }
  .content {
    height: calc(100% - 44px);
    background: #fff;
  }
  .content img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
  }
</style>
</head>
<body>
  <div class="window">
    <div class="topbar">
      <div class="traffic"><span></span><span></span><span></span></div>
      <div class="title"><span class="icon">${app.name.slice(0, 1)}</span><span>${app.name}</span></div>
      <div class="origin">${new URL(app.url).hostname}</div>
    </div>
    <div class="content"><img src="${dataUrl}" alt="${app.name}" /></div>
  </div>
</body>
</html>`, { waitUntil: "load" });
  await framePage.screenshot({ path: framedPath, type: "png" });
  await framePage.close();
}

async function captureGallery(capturedApps) {
  const galleryPage = await browser.newPage({ viewport: { width: 1600, height: 1420 } });
  const cards = await Promise.all(capturedApps.map(async (app) => {
    const buffer = await readFile(app.imagePath);
    return {
      ...app,
      dataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
    };
  }));
  await galleryPage.setContent(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 56px;
    font-family: "SF Pro Display", "Inter", sans-serif;
    background: linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%);
    color: #0f172a;
  }
  .eyebrow {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #475569;
  }
  h1 {
    margin: 0;
    font-size: 52px;
    line-height: 1;
    letter-spacing: -0.04em;
  }
  p {
    margin: 16px 0 36px;
    max-width: 920px;
    font-size: 18px;
    line-height: 1.6;
    color: #334155;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 24px;
  }
  .card {
    overflow: hidden;
    border-radius: 22px;
    background: rgba(255,255,255,0.82);
    border: 1px solid rgba(15,23,42,0.08);
    box-shadow: 0 18px 40px rgba(15,23,42,0.08);
  }
  .card img {
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
  }
  .meta {
    padding: 16px 18px 18px;
  }
  .meta strong {
    display: block;
    font-size: 16px;
  }
  .meta span {
    display: block;
    margin-top: 8px;
    color: #475569;
    font-size: 13px;
    line-height: 1.45;
  }
</style>
</head>
<body>
  <div class="eyebrow">appbun showcase</div>
  <h1>Turn any webpage into a desktop app.</h1>
  <p>Current public web entry points captured with Playwright, then framed to match appbun’s generated Electrobun shell. The same CLI flow works across macOS, Windows, and Linux.</p>
  <div class="grid">
    ${cards.map((app) => `<article class="card"><img src="${app.dataUrl}" alt="${app.name}" /><div class="meta"><strong>${app.name}</strong><span>${app.description}</span></div></article>`).join("")}
  </div>
</body>
</html>`, { waitUntil: "load" });
  await galleryPage.screenshot({ path: resolve(framedDir, "showcase-grid.png"), type: "png" });
  await galleryPage.close();
}

async function captureSocialCard(capturedApps) {
  const socialPage = await browser.newPage({ viewport: { width: 1280, height: 640 } });
  const cardImages = await Promise.all(capturedApps.slice(0, 3).map(async (app) => {
    const buffer = await readFile(app.imagePath);
    return `data:image/png;base64,${buffer.toString("base64")}`;
  }));
  await socialPage.setContent(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    width: 1280px;
    height: 640px;
    overflow: hidden;
    font-family: "SF Pro Display", "Inter", sans-serif;
    background:
      radial-gradient(circle at top left, rgba(43, 122, 255, 0.18), transparent 34%),
      radial-gradient(circle at bottom right, rgba(16, 163, 127, 0.18), transparent 28%),
      linear-gradient(180deg, #0f172a 0%, #111827 100%);
    color: #f8fafc;
    padding: 54px;
  }
  h1 {
    margin: 0;
    font-size: 64px;
    line-height: 0.98;
    letter-spacing: -0.06em;
    max-width: 720px;
  }
  p {
    margin: 20px 0 0;
    max-width: 640px;
    font-size: 24px;
    line-height: 1.45;
    color: rgba(226,232,240,0.88);
  }
  .kicker {
    margin: 0 0 18px;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(148,163,184,0.92);
  }
  .strip {
    position: absolute;
    right: 54px;
    top: 64px;
    width: 420px;
    display: grid;
    gap: 16px;
  }
  .shot {
    overflow: hidden;
    border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.12);
    box-shadow: 0 18px 42px rgba(0,0,0,0.28);
  }
  .shot img {
    display: block;
    width: 100%;
  }
  .footer {
    position: absolute;
    left: 54px;
    bottom: 48px;
    display: flex;
    gap: 14px;
    align-items: center;
    color: rgba(226,232,240,0.82);
    font-size: 18px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #10b981;
    display: inline-block;
  }
</style>
</head>
<body>
  <div class="kicker">appbun</div>
  <h1>Turn any webpage into a desktop app with one command.</h1>
  <p>Electrobun-powered wrappers with icon extraction, native-feeling chrome, and installer-friendly packaging for macOS, Windows, and Linux.</p>
  <div class="strip">
    ${cardImages.map((dataUrl) => `<div class="shot"><img src="${dataUrl}" alt="showcase" /></div>`).join("")}
  </div>
  <div class="footer"><span class="dot"></span><span>npm i -g appbun</span><span>github.com/bigmacfive/appbun</span></div>
</body>
</html>`, { waitUntil: "load" });
  await socialPage.screenshot({ path: resolve(assetsDir, "social-card.png"), type: "png" });
  await socialPage.close();
}
