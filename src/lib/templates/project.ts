import type { GeneratedFile, PreparedIconAssets, ResolvedAppConfig } from "../types.js";
import { prettyJson } from "../utils.js";
import { generatedCreateDmgScript } from "./dmg.js";
import { generatedReleaseWorkflow } from "./release.js";
import { generatedBunEntry, generatedMainviewCss, generatedMainviewEntry, generatedMainviewHtml } from "./shell.js";
import { getTitlebarPreset } from "./titlebar.js";

const APPBUN_GENERATOR_VERSION = "0.9.0";

export function renderTemplateFiles(config: ResolvedAppConfig, icons: PreparedIconAssets): GeneratedFile[] {
  return [
    { path: ".gitignore", content: generatedGitignore() },
    { path: "README.md", content: generatedReadme(config, icons) },
    { path: "appbun.generated.json", content: generatedManifest(config, icons) },
    { path: ".github/workflows/release.yml", content: generatedReleaseWorkflow(config) },
    { path: "package.json", content: generatedPackageJson(config) },
    { path: "tsconfig.json", content: generatedTsconfig() },
    { path: "electrobun.config.ts", content: generatedElectrobunConfig(config, icons) },
    { path: "scripts/build-platform.mjs", content: generatedBuildPlatformScript() },
    { path: "scripts/create-dmg.mjs", content: generatedCreateDmgScript(config) },
    { path: "src/bun/index.ts", content: generatedBunEntry(config) },
    { path: "src/mainview/index.html", content: generatedMainviewHtml(config) },
    { path: "src/mainview/index.css", content: generatedMainviewCss(config) },
    { path: "src/mainview/index.ts", content: generatedMainviewEntry(config, icons) },
  ];
}

function generatedManifest(config: ResolvedAppConfig, icons: PreparedIconAssets): string {
  return prettyJson({
    generator: {
      name: "appbun",
      version: APPBUN_GENERATOR_VERSION,
    },
    app: {
      name: config.name,
      title: config.title,
      identifier: config.identifier,
      packageName: config.packageName,
      slug: config.slug,
    },
    source: {
      url: config.url,
      origin: config.origin,
    },
    shell: {
      titlebar: config.titlebar,
      themeColor: config.themeColor,
      width: config.width,
      height: config.height,
    },
    packageManager: config.packageManager,
    icon: {
      sourceUrl: icons.sourceUrl,
      png: icons.png,
      ico: icons.ico,
      macIconset: icons.macIconset,
    },
    generatedAt: new Date().toISOString(),
  });
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
  const packageManagerRun = config.packageManager === "bun" ? "bun run" : "npm run";
  return prettyJson({
    name: config.packageName,
    version: "0.1.0",
    private: true,
    description: config.description,
    scripts: {
      start: "electrobun dev",
      dev: "electrobun dev --watch",
      build: "electrobun build",
      "build:current": "electrobun build",
      "build:dmg": `${packageManagerRun} build:stable && node scripts/create-dmg.mjs`,
      "build:dmg:notarized": `${packageManagerRun} build:stable && APPLE_NOTARIZE=1 APPBUN_DMG_SIGN=1 node scripts/create-dmg.mjs`,
      "build:canary": "electrobun build --env=canary",
      "build:stable": "electrobun build --env=stable",
      "build:macos": "node scripts/build-platform.mjs macos",
      "build:windows": "node scripts/build-platform.mjs windows",
      "build:linux": "node scripts/build-platform.mjs linux",
      "build:all": "node scripts/build-platform.mjs all"
    },
    dependencies: {
      electrobun: "1.18.1"
    },
    devDependencies: {
      "@types/bun": "latest",
      "create-dmg": "^8.0.0"
    }
  });
}

function generatedBuildPlatformScript(): string {
  return `import { spawnSync } from "node:child_process";

const target = process.argv[2];
const supportedTargets = ["macos", "windows", "linux"];

if (target === "all") {
  console.error("build:all is a CI matrix hint, not a local cross-compile command.");
  console.error("Run build:stable on native macOS, Windows, and Linux runners to produce platform artifacts.");
  process.exit(1);
}

if (!supportedTargets.includes(target)) {
  console.error("Usage: node scripts/build-platform.mjs <macos|windows|linux>");
  process.exit(1);
}

const hostTarget = process.platform === "darwin"
  ? "macos"
  : process.platform === "win32"
    ? "windows"
    : "linux";

if (hostTarget !== target) {
  console.error(\`Electrobun builds should run on a native runner for this platform. Requested \${target}, current runner is \${hostTarget}.\`);
  process.exit(1);
}

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, ["electrobun", "build", "--env=stable"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
`;
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

function generatedReadme(config: ResolvedAppConfig, icons: PreparedIconAssets): string {
  const preset = getTitlebarPreset(config.titlebar);
  const installCommand = config.packageManager === "bun" ? "bun install" : "npm install";
  const devCommand = config.packageManager === "bun" ? "bun run dev" : "npm run dev";
  const buildCommand = config.packageManager === "bun" ? "bun run build" : "npm run build";
  const dmgCommand = config.packageManager === "bun" ? "bun run build:dmg" : "npm run build:dmg";
  const macosCommand = config.packageManager === "bun" ? "bun run build:macos" : "npm run build:macos";
  const windowsCommand = config.packageManager === "bun" ? "bun run build:windows" : "npm run build:windows";
  const linuxCommand = config.packageManager === "bun" ? "bun run build:linux" : "npm run build:linux";
  const allCommand = config.packageManager === "bun" ? "bun run build:all" : "npm run build:all";

  return `# ${config.name}

Generated with [appbun](https://github.com/bigmacfive/appbun). This is an inspectable Electrobun project that wraps ${config.url}.

## Run Locally

\`\`\`bash
${installCommand}
${devCommand}
\`\`\`

## Build A DMG

\`\`\`bash
${buildCommand}
${dmgCommand}
\`\`\`

The default DMG is unsigned and works well for local testing, personal use, and internal review. On macOS, the DMG wraps the newest \`.app\` bundle under \`build/\`.

## Sign A DMG

Set \`APPLE_SIGN_IDENTITY\` to a local Developer ID Application identity before running the DMG script:

\`\`\`bash
APPLE_SIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)" ${dmgCommand}
\`\`\`

To require signing and fail when no identity is configured:

\`\`\`bash
APPBUN_DMG_SIGN=1 APPLE_SIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)" ${dmgCommand}
\`\`\`

This signs the \`.app\` before creating the DMG. Notarization is not configured by default.

## Notarize A DMG

For public macOS distribution, provide Apple notarization credentials and run:

\`\`\`bash
APPLE_SIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)" \\
APPLE_ID="you@example.com" \\
APPLE_TEAM_ID="TEAMID" \\
APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx" \\
${config.packageManager} run build:dmg:notarized
\`\`\`

This signs the \`.app\`, creates the DMG, submits it with \`xcrun notarytool\`, and staples the notarization ticket to the DMG.

## CI Builds

Electrobun builds should run on a native runner for the target platform. Use the same project on each OS instead of treating local builds as cross-compilation.

- macOS runner or machine: \`${macosCommand}\`
- macOS DMG installer: \`${dmgCommand}\`
- Windows runner or machine: \`${windowsCommand}\`
- Linux runner or machine: \`${linuxCommand}\`

\`${allCommand}\` is intentionally a reminder for CI matrix builds. It does not cross-compile locally; run \`build:stable\` on native macOS, Windows, and Linux runners to produce release artifacts.

This project includes \`.github/workflows/release.yml\`. Add \`APPLE_SIGN_IDENTITY\` as a repository secret if the macOS CI runner should sign before packaging.

## Configuration

- App name: \`${config.name}\`
- Identifier: \`${config.identifier}\`
- Source URL: [${config.url}](${config.url})
- Theme color: \`${config.themeColor}\`
- Titlebar preset: \`${config.titlebar}\`
- Window size: \`${config.width}x${config.height}\`
- Icon source: ${icons.sourceUrl ? `[${icons.sourceUrl}](${icons.sourceUrl})` : "not resolved"}
- Generated manifest: \`appbun.generated.json\`

## Files

- \`appbun.generated.json\`: source URL, generator version, icon source, shell settings, and package manager
- \`src/bun/index.ts\`: creates the Electrobun window and loads the local shell
- \`src/mainview/\`: the shell toolbar, controls, and embedded webview
- \`scripts/create-dmg.mjs\`: creates unsigned DMGs by default and signs the app when \`APPLE_SIGN_IDENTITY\` is set
- \`.github/workflows/release.yml\`: builds release artifacts on macOS, Windows, and Linux GitHub-hosted runners

## Common Failures

- No \`.app\` under \`build/\`: run \`${buildCommand}\` or \`${config.packageManager} run build:stable\` before \`${dmgCommand}\`.
- \`APPLE_SIGN_IDENTITY\` not found: run \`security find-identity -v -p codesigning\` and use one of the listed identity names.
- Keychain permission denied: unlock the keychain or allow \`codesign\` to use the certificate.
- Notarization failed: confirm \`APPLE_ID\`, \`APPLE_TEAM_ID\`, and \`APPLE_APP_SPECIFIC_PASSWORD\`, then rerun on a macOS machine with Xcode tools.
- \`create-dmg\` or \`hdiutil\` failed: rerun \`${installCommand}\`, confirm you are on macOS, and inspect the command output above the error.

## Notes

The generated app loads the remote site inside an Electrobun shell. The selected \`${config.titlebar}\` preset maps to ${preset.readmeDescription}.

If the installed macOS app does not open from Finder or the Dock the first time, open it once from the Applications folder with **Open** in the context menu. Some local Electrobun builds trigger a one-time launcher permission prompt on first launch.
`;
}
