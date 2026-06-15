// Generates the static GitHub Pages gallery (gallery-dist/index.html) from the recipe list.
//
// Single source of truth: src/lib/recipes.ts. Apps flagged `prebuild` get download buttons
// pointing at the rolling `apps` release; every other app shows its `npx appbun <slug>`
// command and a "Build your own" link to the on-demand builder issue form.
//
// Run with bun (it imports the TypeScript recipe module directly):
//   bun run scripts/build-gallery-page.mjs

import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { appRecipes } from "../src/lib/recipes.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const outDir = resolve(root, "gallery-dist");
const screenshotsSrc = resolve(root, "docs", "screenshots");
const communityBuildsPath = resolve(root, "docs", "showcase", "community-builds.json");

const ownerRepo = process.env.GALLERY_OWNER_REPO || "bigmacfive/appbun";
const releaseBase = `https://github.com/${ownerRepo}/releases/download/apps`;
const issueFormUrl = `https://github.com/${ownerRepo}/issues/new?template=build-app.yml`;

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

function buildIssueUrl({ url, name }) {
  return `${issueFormUrl}&url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`;
}

function cardHtml(recipe) {
  const hasShot = existsSync(resolve(screenshotsSrc, `${recipe.slug}.png`));
  const accent = recipe.themeColor || "#2563eb";
  const media = hasShot
    ? `<img src="screenshots/${recipe.slug}.png" alt="${escapeHtml(recipe.name)}" loading="lazy" />`
    : `<div class="placeholder" style="background:${accent}">${escapeHtml(recipe.name)}</div>`;

  const command = `npx appbun ${recipe.slug}`;
  const actions = recipe.prebuild
    ? `<div class="downloads">
        <a class="btn primary" href="${releaseBase}/${recipe.slug}-arm64.dmg">Download · Apple Silicon</a>
        <a class="btn" href="${releaseBase}/${recipe.slug}-x64.dmg">Intel</a>
      </div>
      <a class="btn build" href="${buildIssueUrl(recipe)}" target="_blank" rel="noopener">Build this app</a>`
    : `<a class="btn primary build" href="${buildIssueUrl(recipe)}" target="_blank" rel="noopener">Build this app</a>`;

  return `<article class="card">
    <div class="shot" style="--accent:${accent}">${media}</div>
    <div class="meta">
      <strong>${escapeHtml(recipe.name)}</strong>
      <span>${escapeHtml(recipe.description)}</span>
      <button class="cmd" data-copy="${escapeHtml(command)}" type="button"><code>${escapeHtml(command)}</code></button>
      ${actions}
    </div>
  </article>`;
}

function communityCardHtml(build) {
  const command = build.command || `npx appbun ${build.url} --name "${build.name}" --dmg`;
  const builder = build.builder ? `Built by ${escapeHtml(build.builder)}` : "Community build";
  const source = build.repository
    ? `<a href="${escapeHtml(build.repository)}" target="_blank" rel="noopener">Source</a>`
    : "";
  return `<article class="community-card">
    <div>
      <strong>${escapeHtml(build.name)}</strong>
      <span>${escapeHtml(builder)}</span>
      <p>${escapeHtml(build.description || "An appbun desktop build shared by the community.")}</p>
    </div>
    <button class="cmd" data-copy="${escapeHtml(command)}" type="button"><code>${escapeHtml(command)}</code></button>
    <div class="community-links">
      <a class="btn primary" href="${buildIssueUrl(build)}" target="_blank" rel="noopener">Build this app</a>
      ${source}
    </div>
  </article>`;
}

function pageHtml(recipes, communityBuilds) {
  const prebuilt = recipes.filter((r) => r.prebuild);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>appbun — turn any webpage into a desktop app</title>
<meta name="description" content="Download ready-made desktop apps, or build your own from any URL with one command." />
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "SF Pro Display", "Inter", system-ui, sans-serif; background: linear-gradient(180deg,#f8fafc,#eef2f7); color:#0f172a; }
  .wrap { max-width: 1120px; margin: 0 auto; padding: 64px 24px 96px; }
  .eyebrow { font-size: 13px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color:#475569; margin: 0 0 8px; }
  h1 { margin: 0; font-size: 46px; line-height: 1.04; letter-spacing: -0.03em; }
  .lede { margin: 18px 0 12px; max-width: 720px; font-size: 18px; line-height: 1.6; color:#334155; }
  .hero-cmd { display:inline-block; background:#0f172a; color:#e2e8f0; padding:12px 16px; border-radius:12px; font-family: ui-monospace,SFMono-Regular,Menlo,monospace; font-size:14px; }
  .note { font-size: 13px; color:#64748b; margin: 20px 0 40px; }
  h2 { font-size: 22px; letter-spacing:-0.01em; margin: 48px 0 16px; }
  .grid { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 22px; }
  @media (max-width: 880px){ .grid { grid-template-columns: repeat(2,minmax(0,1fr)); } }
  @media (max-width: 560px){ .grid { grid-template-columns: 1fr; } h1{font-size:34px;} }
  .card { overflow:hidden; border-radius:20px; background:rgba(255,255,255,.85); border:1px solid rgba(15,23,42,.08); box-shadow:0 18px 40px rgba(15,23,42,.08); display:flex; flex-direction:column; }
  .shot { aspect-ratio: 4/3; overflow:hidden; }
  .shot img { display:block; width:100%; height:100%; object-fit:cover; }
  .placeholder { width:100%; height:100%; display:flex; align-items:center; justify-content:center; color:#fff; font-size:22px; font-weight:700; }
  .meta { padding: 16px 16px 18px; display:flex; flex-direction:column; gap:8px; flex:1; }
  .meta strong { font-size:16px; }
  .meta span { color:#475569; font-size:13px; line-height:1.45; flex:1; }
  .cmd { text-align:left; cursor:pointer; border:1px solid rgba(15,23,42,.12); background:#f1f5f9; border-radius:9px; padding:8px 10px; font-family: ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12.5px; color:#0f172a; }
  .cmd:hover { background:#e2e8f0; }
  .downloads { display:flex; gap:8px; }
  .btn.build { margin-top:2px; }
  .btn { display:inline-block; text-decoration:none; text-align:center; border-radius:9px; padding:9px 12px; font-size:13px; font-weight:600; border:1px solid rgba(15,23,42,.14); color:#0f172a; background:#fff; }
  .btn.primary { background:#0f172a; color:#fff; border-color:#0f172a; flex:1; }
  .btn:hover { filter:brightness(.96); }
  .community { display:grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap:16px; }
  @media (max-width: 720px){ .community { grid-template-columns:1fr; } }
  .community-card { border-radius:16px; border:1px solid rgba(15,23,42,.1); background:#fff; padding:18px; display:flex; flex-direction:column; gap:12px; box-shadow:0 12px 28px rgba(15,23,42,.06); }
  .community-card strong { display:block; font-size:16px; }
  .community-card span { color:#64748b; font-size:13px; }
  .community-card p { margin:8px 0 0; color:#475569; font-size:13px; line-height:1.5; }
  .community-links { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
  .community-links a:not(.btn) { color:#475569; font-size:13px; font-weight:600; }
  footer { margin-top:64px; font-size:12.5px; color:#64748b; line-height:1.6; }
  footer a { color:#475569; }
</style>
</head>
<body>
  <div class="wrap">
    <p class="eyebrow">appbun</p>
    <h1>Turn any webpage into a desktop app.</h1>
    <p class="lede">Download a ready-made app below, or make your own from any URL with one command. Every build is a real, inspectable Electrobun project — not a sealed binary.</p>
    <span class="hero-cmd">npx -y appbun@latest https://example.com --name "Example" --dmg</span>
    <p class="note">Pre-built downloads (${prebuilt.length}) are unsigned and community-built. On first launch macOS may block them — open <strong>System Settings → Privacy &amp; Security → Open Anyway</strong>.</p>

    <h2>Ready to download</h2>
    <div class="grid">
      ${prebuilt.map(cardHtml).join("\n")}
    </div>

    <h2>Build with one command</h2>
    <div class="grid">
      ${recipes.filter((r) => !r.prebuild).map(cardHtml).join("\n")}
    </div>

    <h2>Community builds</h2>
    <p class="note">Built something useful with appbun? <a href="https://github.com/${ownerRepo}/issues/new?template=submit-app.yml">Submit it to the gallery</a>.</p>
    <div class="community">
      ${communityBuilds.length > 0 ? communityBuilds.map(communityCardHtml).join("\n") : `<article class="community-card"><strong>Your app could be first</strong><span>Community build</span><p>Share a repo, screenshot, or URL and appbun can turn it into a gallery card.</p><a class="btn primary" href="https://github.com/${ownerRepo}/issues/new?template=submit-app.yml">Submit your app</a></article>`}
    </div>

    <footer>
      appbun is an unaffiliated, open-source wrapper. All product names, logos, and trademarks belong to their respective owners.
      Pre-built binaries are provided for convenience and are unsigned. Source: <a href="https://github.com/${ownerRepo}">github.com/${ownerRepo}</a>.
    </footer>
  </div>
  <script>
    document.querySelectorAll(".cmd").forEach((el) => {
      el.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(el.dataset.copy); el.classList.add("copied"); const c = el.querySelector("code"); const t = c.textContent; c.textContent = "Copied!"; setTimeout(() => { c.textContent = t; }, 1200); } catch {}
      });
    });
  </script>
</body>
</html>`;
}

async function main() {
  await mkdir(resolve(outDir, "screenshots"), { recursive: true });
  if (existsSync(screenshotsSrc)) {
    for (const file of await readdir(screenshotsSrc)) {
      if (file.endsWith(".png")) {
        await cp(resolve(screenshotsSrc, file), resolve(outDir, "screenshots", file));
      }
    }
  }
  const communityBuilds = await readCommunityBuilds();
  await writeFile(resolve(outDir, "index.html"), pageHtml(appRecipes, communityBuilds), "utf8");
  // .nojekyll keeps GitHub Pages from ignoring files; harmless and conventional.
  await writeFile(resolve(outDir, ".nojekyll"), "", "utf8");
  console.log(`Gallery written to ${outDir} (${appRecipes.length} apps, ${appRecipes.filter((r) => r.prebuild).length} pre-built)`);
}

async function readCommunityBuilds() {
  if (!existsSync(communityBuildsPath)) {
    return [];
  }

  const parsed = JSON.parse(await readFile(communityBuildsPath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error("docs/showcase/community-builds.json must contain an array");
  }
  return parsed;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
