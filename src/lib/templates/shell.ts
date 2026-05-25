import type { PreparedIconAssets, ResolvedAppConfig } from "../types.js";
import { escapeHtml, getTitlebarPreset } from "./titlebar.js";

export function generatedBunEntry(config: ResolvedAppConfig): string {
  const preset = getTitlebarPreset(config.titlebar);
  const startMessage = `appbun wrapper started for ${config.url}`;
  const descriptionMessage = `Description: ${config.description}`;
  const styleMask = preset.macUsesUnifiedChrome
    ? `{
        UnifiedTitleAndToolbar: true,
        FullSizeContentView: true,
      }`
    : "{}";
  return `import { BrowserWindow } from "electrobun/bun";

const isMac = process.platform === "darwin";

const mainWindow = new BrowserWindow({
  title: ${JSON.stringify(config.title)},
  url: "views://mainview/index.html",
  frame: {
    width: ${config.width},
    height: ${config.height},
    x: 120,
    y: 120,
  },
  titleBarStyle: isMac ? ${JSON.stringify(preset.macTitleBarStyle)} : "default",
  styleMask: isMac ? ${styleMask} : {},
  transparent: false,
});

mainWindow.webview.on("dom-ready", () => {
  console.log(${JSON.stringify(`${config.name} shell loaded`)})
});

console.log(${JSON.stringify(startMessage)});
console.log(${JSON.stringify(descriptionMessage)});
`;
}

export function generatedMainviewHtml(config: ResolvedAppConfig): string {
  const preset = getTitlebarPreset(config.titlebar);
  const toolbar = preset.showCustomToolbar
    ? `
    <header class="topbar electrobun-webkit-app-region-drag" data-titlebar-style="${preset.id}">
      <div class="topbar-brand">
        <img id="site-icon" class="site-icon" src="views://mainview/icon.png" alt="" />
        <strong id="site-name">${escapeHtml(config.name)}</strong>
      </div>
      <div class="topbar-actions electrobun-webkit-app-region-no-drag" aria-label="App controls">
        <span id="site-origin" class="site-origin">${escapeHtml(new URL(config.url).hostname)}</span>
        <button id="reload-app" class="icon-button" type="button" title="Reload" aria-label="Reload">
          <span class="icon icon-reload" aria-hidden="true"></span>
        </button>
        <button id="open-external" class="icon-button" type="button" title="Open in browser" aria-label="Open in browser">
          <span class="icon icon-external" aria-hidden="true"></span>
        </button>
      </div>
    </header>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(config.title)}</title>
  <link rel="stylesheet" href="index.css" />
  <script type="module" src="views://mainview/index.js"></script>
</head>
<body>
  <div class="shell" data-titlebar-style="${preset.id}">
${toolbar}
    <main class="stage">
      <div id="shell-status" class="shell-status" role="status">
        <strong>Loading ${escapeHtml(config.name)}</strong>
        <span>${escapeHtml(new URL(config.url).hostname)}</span>
      </div>
      <div id="webview-mount" class="webview-mount"></div>
    </main>
  </div>
</body>
</html>
`;
}

export function generatedMainviewCss(config: ResolvedAppConfig): string {
  const preset = getTitlebarPreset(config.titlebar);
  return `:root {
  color-scheme: light;
  --shell-ink: rgba(22, 22, 24, 0.92);
  --shell-muted: rgba(55, 65, 81, 0.72);
  --shell-border: rgba(15, 23, 42, 0.10);
  --shell-toolbar: rgba(248, 248, 250, 0.84);
  --shell-toolbar-height: ${preset.toolbarHeight}px;
  --shell-toolbar-left: ${preset.toolbarLeft}px;
  --shell-topbar-display: ${preset.showCustomToolbar ? "flex" : "none"};
  --shell-toolbar-border-alpha: ${preset.showBorder ? "1" : "0"};
  --shell-origin-display: ${preset.showOrigin ? "block" : "none"};
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  font-family: "SF Pro Text", "Segoe UI", sans-serif;
  background: #ffffff;
}

.shell {
  width: 100%;
  height: 100%;
  position: relative;
  background: #ffffff;
}

.topbar {
  position: absolute;
  inset: 0 0 auto 0;
  height: var(--shell-toolbar-height);
  display: var(--shell-topbar-display);
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 10px 0 var(--shell-toolbar-left);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), var(--shell-toolbar));
  border-bottom: calc(1px * var(--shell-toolbar-border-alpha)) solid var(--shell-border);
  backdrop-filter: blur(24px) saturate(1.15);
  z-index: 2;
}

.topbar-brand,
.topbar-actions {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.topbar-actions {
  flex: 0 1 auto;
}

.site-icon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  flex: 0 0 auto;
}

#site-name {
  font-size: 12.5px;
  line-height: 1;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--shell-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.site-origin {
  display: var(--shell-origin-display);
  max-width: min(38vw, 360px);
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0;
  color: var(--shell-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.icon-button {
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  display: inline-grid;
  place-items: center;
  padding: 0;
  color: var(--shell-muted);
  background: transparent;
  font: 15px/1 "SF Pro Text", "Segoe UI", sans-serif;
  cursor: default;
}

.icon-button:hover {
  color: var(--shell-ink);
  background: rgba(15, 23, 42, 0.08);
}

.icon {
  position: relative;
  width: 13px;
  height: 13px;
  display: block;
}

.icon-reload {
  border: 1.7px solid currentColor;
  border-right-color: transparent;
  border-radius: 999px;
}

.icon-reload::after {
  content: "";
  position: absolute;
  top: -2px;
  right: -1px;
  width: 4px;
  height: 4px;
  border-top: 1.7px solid currentColor;
  border-right: 1.7px solid currentColor;
  transform: rotate(20deg);
}

.icon-external {
  border: 1.5px solid currentColor;
  border-radius: 2px;
}

.icon-external::before {
  content: "";
  position: absolute;
  top: -2px;
  right: -2px;
  width: 7px;
  height: 7px;
  border-top: 1.7px solid currentColor;
  border-right: 1.7px solid currentColor;
}

.icon-external::after {
  content: "";
  position: absolute;
  top: 1px;
  right: -1px;
  width: 8px;
  height: 1.7px;
  background: currentColor;
  transform: rotate(-45deg);
  transform-origin: right center;
}

.stage {
  position: absolute;
  inset: ${preset.showCustomToolbar ? "var(--shell-toolbar-height)" : "0"} 0 0 0;
}

.webview-mount {
  width: 100%;
  height: 100%;
}

.shell-status {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
  color: var(--shell-ink);
  background: #ffffff;
  z-index: 1;
}

.shell-status strong {
  font-size: 13px;
  line-height: 1.2;
  font-weight: 650;
  letter-spacing: 0;
}

.shell-status span {
  max-width: 70vw;
  font-size: 12px;
  line-height: 1.3;
  color: var(--shell-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shell-status.is-hidden {
  display: none;
}

.shell-status.is-error {
  color: #991b1b;
  background: #fff7f7;
}

electrobun-webview {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: transparent;
}

@media (max-width: 720px) {
  .topbar {
    padding-left: 68px;
  }

  .site-origin {
    display: none;
  }
}
`;
}

export function generatedMainviewEntry(config: ResolvedAppConfig, icons: PreparedIconAssets): string {
  const preset = getTitlebarPreset(config.titlebar);
  const logMessage = `Loading ${config.url}${icons.sourceUrl ? ` with icon ${icons.sourceUrl}` : ""}`;
  return `const APP_CONFIG = ${JSON.stringify({
    name: config.name,
    title: config.title,
    origin: config.origin,
    url: config.url,
    themeColor: config.themeColor,
    titlebar: config.titlebar,
    showOrigin: preset.showOrigin,
    hasIcon: Boolean(icons.png),
    iconSource: icons.sourceUrl,
  }, null, 2)};

const mount = document.getElementById("webview-mount");
const siteName = document.getElementById("site-name");
const siteOrigin = document.getElementById("site-origin");
const siteIcon = document.getElementById("site-icon") as HTMLImageElement | null;
const reloadButton = document.getElementById("reload-app");
const openExternalButton = document.getElementById("open-external");
const shellStatus = document.getElementById("shell-status");
const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
let remoteApp: HTMLElement | undefined;
let loadTimeout: number | undefined;

document.title = APP_CONFIG.title;
document.documentElement.style.setProperty("--appbun-accent", APP_CONFIG.themeColor);
document.documentElement.dataset.platform = isMac ? "mac" : "other";
if (!isMac) {
  document.documentElement.style.setProperty("--shell-topbar-display", "none");
  document.documentElement.style.setProperty("--shell-toolbar-height", "0px");
}
siteName && (siteName.textContent = APP_CONFIG.name);
siteOrigin && (siteOrigin.textContent = APP_CONFIG.origin.replace(/^https?:\\/\\//, ""));

if (mount) {
  remoteApp = document.createElement("electrobun-webview");
  remoteApp.setAttribute("src", APP_CONFIG.url);
  remoteApp.setAttribute("id", "remote-app");
  remoteApp.classList.add("remote-app");
  showStatus("loading", \`Loading \${APP_CONFIG.name}\`, APP_CONFIG.origin.replace(/^https?:\\/\\//, ""));
  loadTimeout = window.setTimeout(() => {
    showStatus("loading", \`\${APP_CONFIG.name} is still loading\`, "Check your network or reload the app.");
  }, 12000);
  remoteApp.addEventListener("dom-ready", () => hideStatus());
  remoteApp.addEventListener("load", () => hideStatus());
  remoteApp.addEventListener("error", (event) => {
    console.error("appbun webview failed to load", event);
    showStatus("error", \`\${APP_CONFIG.name} could not load\`, APP_CONFIG.url);
  });
  mount.appendChild(remoteApp);
} else {
  console.error("appbun shell could not find #webview-mount");
  showStatus("error", "App shell could not start", "Missing #webview-mount");
}

reloadButton?.addEventListener("click", () => {
  const currentSrc = remoteApp?.getAttribute("src") ?? APP_CONFIG.url;
  showStatus("loading", \`Reloading \${APP_CONFIG.name}\`, APP_CONFIG.origin.replace(/^https?:\\/\\//, ""));
  remoteApp?.setAttribute("src", "about:blank");
  window.setTimeout(() => remoteApp?.setAttribute("src", currentSrc), 0);
});

openExternalButton?.addEventListener("click", () => {
  window.open(APP_CONFIG.url, "_blank", "noopener,noreferrer");
});

if (!APP_CONFIG.hasIcon && siteIcon) {
  console.warn("appbun shell did not receive a usable icon asset");
  siteIcon.remove();
}

siteIcon?.addEventListener("error", () => {
  console.warn("appbun shell icon failed to load", APP_CONFIG.iconSource);
  siteIcon.remove();
});

console.log(${JSON.stringify(logMessage)});

function showStatus(kind: "loading" | "error", title: string, detail: string) {
  if (!shellStatus) {
    return;
  }

  const titleElement = shellStatus.querySelector("strong");
  const detailElement = shellStatus.querySelector("span");
  titleElement && (titleElement.textContent = title);
  detailElement && (detailElement.textContent = detail);
  shellStatus.classList.toggle("is-error", kind === "error");
  shellStatus.classList.remove("is-hidden");
}

function hideStatus() {
  if (loadTimeout) {
    window.clearTimeout(loadTimeout);
    loadTimeout = undefined;
  }
  shellStatus?.classList.add("is-hidden");
}
`;
}
