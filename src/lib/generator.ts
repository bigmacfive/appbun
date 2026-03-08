import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import type {
  CreateCommandOptions,
  GeneratedFile,
  PreparedIconAssets,
  ResolvedAppConfig,
  SiteMetadata,
} from "./types.js";
import {
  deriveIdentifier,
  deriveNameFromUrl,
  deriveThemeColor,
  ensureSafeOutputDirectory,
  normalizeHexColor,
  prettyJson,
  slugify,
} from "./utils.js";
import { prepareIconAssets } from "./icons.js";

export function resolveAppConfig(url: string, options: CreateCommandOptions, metadata: SiteMetadata): ResolvedAppConfig {
  const normalizedUrl = new URL(url).toString();
  const name = options.name?.trim() || metadata.title || deriveNameFromUrl(normalizedUrl);
  const slug = slugify(name);
  const outDir = resolve(options.outDir?.trim() || slug);
  const title = options.title?.trim() || name;
  const description = options.description?.trim() || metadata.description || `Desktop wrapper for ${new URL(normalizedUrl).hostname}`;
  const identifier = options.identifier?.trim() || deriveIdentifier(normalizedUrl, slug);
  const themeColor = normalizeHexColor(options.themeColor) || metadata.themeColor || deriveThemeColor(new URL(normalizedUrl).hostname);
  const packageName = slug;

  return {
    name,
    title,
    description,
    identifier,
    packageName,
    slug,
    themeColor,
    url: normalizedUrl,
    origin: new URL(normalizedUrl).origin,
    outDir,
    width: options.width,
    height: options.height,
    packageManager: options.packageManager,
  };
}

export async function writeProject(config: ResolvedAppConfig, metadata: SiteMetadata): Promise<PreparedIconAssets> {
  const safeOutDir = ensureSafeOutputDirectory(config.outDir);
  await mkdir(safeOutDir, { recursive: true });
  const preparedIcons = await prepareIconAssets(safeOutDir, metadata);

  for (const file of renderTemplateFiles(config, preparedIcons)) {
    const outputPath = resolve(safeOutDir, file.path);
    const parentDir = outputPath.slice(0, Math.max(outputPath.lastIndexOf("/"), outputPath.lastIndexOf("\\")));
    if (parentDir) {
      await mkdir(parentDir, { recursive: true });
    }
    await writeFile(outputPath, file.content);
  }

  return preparedIcons;
}

export function installDependencies(config: ResolvedAppConfig): void {
  const command = config.packageManager;
  const result = spawnSync(command, ["install"], {
    cwd: config.outDir,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`${command} install failed with exit code ${result.status ?? "unknown"}`);
  }
}

export function renderTemplateFiles(config: ResolvedAppConfig, icons: PreparedIconAssets): GeneratedFile[] {
  return [
    { path: ".gitignore", content: generatedGitignore() },
    { path: "README.md", content: generatedReadme(config, icons) },
    { path: "package.json", content: generatedPackageJson(config) },
    { path: "tsconfig.json", content: generatedTsconfig() },
    { path: "electrobun.config.ts", content: generatedElectrobunConfig(config, icons) },
    { path: "src/bun/index.ts", content: generatedBunEntry(config) },
    { path: "src/mainview/index.html", content: generatedMainviewHtml(config) },
    { path: "src/mainview/index.css", content: generatedMainviewCss(config) },
    { path: "src/mainview/index.ts", content: generatedMainviewEntry(config, icons) },
  ];
}

function generatedGitignore(): string {
  return [
    "node_modules",
    "bun.lock",
    "package-lock.json",
    "dist",
    ".DS_Store",
    "*.log",
    "build",
    "release",
    "out",
    "",
  ].join("\n");
}

function generatedPackageJson(config: ResolvedAppConfig): string {
  return prettyJson({
    name: config.packageName,
    version: "0.1.0",
    private: true,
    description: config.description,
    scripts: {
      start: "electrobun dev",
      dev: "electrobun dev --watch",
      build: "electrobun build",
      "build:canary": "electrobun build --env=canary",
      "build:stable": "electrobun build --env=stable"
    },
    dependencies: {
      electrobun: "1.15.1"
    },
    devDependencies: {
      "@types/bun": "latest"
    }
  });
}

function generatedTsconfig(): string {
  return [
    "{",
    '  "compilerOptions": {',
    '    "target": "ES2022",',
    '    "module": "ESNext",',
    '    "moduleResolution": "Bundler",',
    '    "strict": true,',
    '    "types": ["bun"]',
    "  }",
    "}",
    "",
  ].join("\n");
}

function generatedElectrobunConfig(config: ResolvedAppConfig, icons: PreparedIconAssets): string {
  const copyEntries: Record<string, string> = {
    "src/mainview/index.html": "views/mainview/index.html",
    "src/mainview/index.css": "views/mainview/index.css",
  };

  if (icons.png) {
    copyEntries[icons.png] = "views/mainview/icon.png";
  }

  const macConfig = icons.macIconset
    ? `
    mac: {
      bundleCEF: false,
      icons: ${JSON.stringify(icons.macIconset)},
    },`
    : `
    mac: {
      bundleCEF: false,
    },`;

  const winConfig = icons.ico
    ? `
    win: {
      bundleCEF: false,
      icon: ${JSON.stringify(icons.ico)},
    },`
    : `
    win: {
      bundleCEF: false,
    },`;

  const linuxConfig = icons.png
    ? `
    linux: {
      bundleCEF: false,
      icon: ${JSON.stringify(icons.png)},
    },`
    : `
    linux: {
      bundleCEF: false,
    },`;

  return `import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: ${JSON.stringify(config.name)},
    identifier: ${JSON.stringify(config.identifier)},
    version: "0.1.0",
  },
  build: {
    views: {
      mainview: {
        entrypoint: "src/mainview/index.ts",
      },
    },
    copy: ${JSON.stringify(copyEntries, null, 2)},${macConfig}${winConfig}${linuxConfig}
  },
} satisfies ElectrobunConfig;
`;
}

function generatedBunEntry(config: ResolvedAppConfig): string {
  const startMessage = `appbun wrapper started for ${config.url}`;
  const descriptionMessage = `Description: ${config.description}`;
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
  titleBarStyle: isMac ? "hiddenInset" : "default",
  styleMask: isMac
    ? {
        UnifiedTitleAndToolbar: true,
        FullSizeContentView: true,
      }
    : {},
  transparent: false,
});

mainWindow.webview.on("dom-ready", () => {
  console.log(${JSON.stringify(`${config.name} shell loaded`)})
});

console.log(${JSON.stringify(startMessage)});
console.log(${JSON.stringify(descriptionMessage)});
`;
}

function generatedMainviewHtml(config: ResolvedAppConfig): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(config.title)}</title>
  <link rel="stylesheet" href="index.css" />
  <script src="views://webviewtag/index.js"></script>
  <script type="module" src="views://mainview/index.js"></script>
</head>
<body>
  <div class="shell">
    <header class="topbar electrobun-webkit-app-region-drag">
      <div class="brand">
        <img id="site-icon" class="site-icon" src="views://mainview/icon.png" alt="" />
        <div class="brand-copy">
          <strong id="site-name">${escapeHtml(config.name)}</strong>
          <span id="site-origin">${escapeHtml(config.origin.replace(/^https?:\/\//, ""))}</span>
        </div>
      </div>
      <div class="header-glow" aria-hidden="true"></div>
    </header>
    <main class="stage">
      <electrobun-webview id="remote-app" class="remote-app"></electrobun-webview>
    </main>
  </div>
</body>
</html>
`;
}

function generatedMainviewCss(config: ResolvedAppConfig): string {
  return `:root {
  color-scheme: light;
  --shell-bg: color-mix(in srgb, ${config.themeColor} 10%, #f5f5f2);
  --shell-topbar: color-mix(in srgb, ${config.themeColor} 12%, rgba(255, 255, 255, 0.84));
  --shell-border: color-mix(in srgb, ${config.themeColor} 22%, rgba(24, 24, 27, 0.10));
  --shell-ink: #141414;
  --shell-muted: rgba(20, 20, 20, 0.58);
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
  background:
    radial-gradient(circle at top left, color-mix(in srgb, ${config.themeColor} 20%, white) 0%, transparent 42%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), var(--shell-bg));
  color: var(--shell-ink);
  font-family: "SF Pro Text", "Segoe UI", sans-serif;
}

.shell {
  width: 100%;
  height: 100%;
  position: relative;
}

.topbar {
  position: absolute;
  inset: 0 0 auto 0;
  height: 72px;
  display: flex;
  align-items: center;
  padding: 18px 22px 16px 84px;
  border-bottom: 1px solid var(--shell-border);
  background: var(--shell-topbar);
  backdrop-filter: blur(24px) saturate(1.15);
  z-index: 2;
  overflow: hidden;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.site-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  box-shadow: 0 12px 22px rgba(15, 23, 42, 0.14);
  flex: 0 0 auto;
}

.brand-copy {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

#site-name {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

#site-origin {
  font-size: 12px;
  color: var(--shell-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-glow {
  position: absolute;
  inset: -24px -120px auto auto;
  width: 240px;
  height: 120px;
  background: radial-gradient(circle, color-mix(in srgb, ${config.themeColor} 24%, white) 0%, transparent 70%);
  pointer-events: none;
}

.stage {
  position: absolute;
  inset: 72px 0 0 0;
}

.remote-app {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: white;
}

@media (max-width: 900px) {
  .topbar {
    padding-left: 72px;
  }
}
`;
}

function generatedMainviewEntry(config: ResolvedAppConfig, icons: PreparedIconAssets): string {
  const logMessage = `Loading ${config.url}${icons.sourceUrl ? ` with icon ${icons.sourceUrl}` : ""}`;
  return `import { Electroview } from "electrobun/view";

const APP_CONFIG = ${JSON.stringify({
    name: config.name,
    title: config.title,
    origin: config.origin,
    url: config.url,
    themeColor: config.themeColor,
    hasIcon: Boolean(icons.png),
    iconSource: icons.sourceUrl,
  }, null, 2)};

const electroview = new Electroview();
void electroview;

const remoteApp = document.getElementById("remote-app") as HTMLElement & { src?: string };
const siteName = document.getElementById("site-name");
const siteOrigin = document.getElementById("site-origin");
const siteIcon = document.getElementById("site-icon") as HTMLImageElement | null;

document.title = APP_CONFIG.title;
document.documentElement.style.setProperty("--appbun-accent", APP_CONFIG.themeColor);
siteName && (siteName.textContent = APP_CONFIG.name);
siteOrigin && (siteOrigin.textContent = APP_CONFIG.origin.replace(/^https?:\\/\\//, ""));

if (remoteApp) {
  remoteApp.src = APP_CONFIG.url;
}

if (!APP_CONFIG.hasIcon && siteIcon) {
  siteIcon.remove();
}

siteIcon?.addEventListener("error", () => {
  siteIcon.remove();
});

console.log(${JSON.stringify(logMessage)});
`;
}

function generatedReadme(config: ResolvedAppConfig, icons: PreparedIconAssets): string {
  const installCommand = config.packageManager === "bun" ? "bun install" : "npm install";
  const devCommand = config.packageManager === "bun" ? "bun run dev" : "npm run dev";
  const buildCommand = config.packageManager === "bun" ? "bun run build" : "npm run build";

  return `# ${config.name}

Generated with [appbun](https://github.com/bigmacfive/appbun). This project wraps ${config.url} in an Electrobun desktop shell.

## Commands

\`\`\`bash
${installCommand}
${devCommand}
${buildCommand}
\`\`\`

## Configuration

- App name: \`${config.name}\`
- Identifier: \`${config.identifier}\`
- Source URL: [${config.url}](${config.url})
- Theme color: \`${config.themeColor}\`
- Window size: \`${config.width}x${config.height}\`
- Icon source: ${icons.sourceUrl ? `[${icons.sourceUrl}](${icons.sourceUrl})` : "not resolved"}

## Files

- \`src/bun/index.ts\`: creates the Electrobun window and loads the local shell
- \`src/mainview/\`: the unified shell header and embedded webview
- \`electrobun.config.ts\`: app metadata and platform packaging settings
- \`assets/icon.*\`: site-derived icons when available

## Notes

The generated app loads the remote site inside an Electrobun shell so the native window chrome and app content feel visually connected, especially on macOS with hidden inset traffic lights.
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
