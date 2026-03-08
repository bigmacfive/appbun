import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import type { CreateCommandOptions, GeneratedFile, ResolvedAppConfig, SiteMetadata } from "./types.js";
import {
  deriveIdentifier,
  deriveNameFromUrl,
  deriveThemeColor,
  ensureSafeOutputDirectory,
  normalizeHexColor,
  prettyJson,
  slugify,
} from "./utils.js";
import { generateIconAssets } from "./icons.js";

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

export async function writeProject(config: ResolvedAppConfig): Promise<void> {
  const safeOutDir = ensureSafeOutputDirectory(config.outDir);
  await mkdir(safeOutDir, { recursive: true });
  await generateIconAssets(safeOutDir, config.name, config.themeColor);

  for (const file of renderTemplateFiles(config)) {
    const outputPath = resolve(safeOutDir, file.path);
    const parentDir = outputPath.slice(0, Math.max(outputPath.lastIndexOf("/"), outputPath.lastIndexOf("\\")));
    if (parentDir) {
      await mkdir(parentDir, { recursive: true });
    }
    await writeFile(outputPath, file.content);
  }
}

export function installDependencies(config: ResolvedAppConfig): void {
  const command = config.packageManager;
  const args = config.packageManager === "bun" ? ["install"] : ["install"];
  const result = spawnSync(command, args, {
    cwd: config.outDir,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`${command} install failed with exit code ${result.status ?? "unknown"}`);
  }
}

export function renderTemplateFiles(config: ResolvedAppConfig): GeneratedFile[] {
  return [
    { path: ".gitignore", content: generatedGitignore() },
    { path: "README.md", content: generatedReadme(config) },
    { path: "package.json", content: generatedPackageJson(config) },
    { path: "tsconfig.json", content: generatedTsconfig() },
    { path: "electrobun.config.ts", content: generatedElectrobunConfig(config) },
    { path: "src/bun/index.ts", content: generatedBunEntry(config) },
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

function generatedElectrobunConfig(config: ResolvedAppConfig): string {
  return `import type { ElectrobunConfig } from "electrobun";

export default {
  app: {
    name: ${JSON.stringify(config.name)},
    identifier: ${JSON.stringify(config.identifier)},
    version: "0.1.0",
  },
  build: {
    mac: {
      bundleCEF: false,
      icons: "icon.iconset",
    },
    win: {
      bundleCEF: false,
      icon: "assets/icon.ico",
    },
    linux: {
      bundleCEF: false,
      icon: "assets/icon.png",
    },
  },
} satisfies ElectrobunConfig;
`;
}

function generatedBunEntry(config: ResolvedAppConfig): string {
  const startMessage = `appbun wrapper started for ${config.url}`;
  const descriptionMessage = `Description: ${config.description}`;
  return `import { BrowserWindow } from "electrobun/bun";

const mainWindow = new BrowserWindow({
  title: ${JSON.stringify(config.title)},
  url: ${JSON.stringify(config.url)},
  sandbox: true,
  frame: {
    width: ${config.width},
    height: ${config.height},
    x: 120,
    y: 120,
  },
});

mainWindow.webview.on("dom-ready", () => {
  console.log(${JSON.stringify(`${config.name} loaded: ${config.url}`)});
});

console.log(${JSON.stringify(startMessage)});
console.log(${JSON.stringify(descriptionMessage)});
`;
}

function generatedReadme(config: ResolvedAppConfig): string {
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

## Files

- \`src/bun/index.ts\`: creates the Electrobun window and loads the remote app
- \`electrobun.config.ts\`: app metadata and platform packaging settings
- \`assets/icon.*\`: generated icons for Windows and Linux
- \`icon.iconset/\`: generated macOS iconset

## Notes

The generated app runs the remote site in a sandboxed webview. Replace the generated icons if you want brand-perfect assets before shipping.
`;
}
