#!/usr/bin/env node
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { spawnSync } from "node:child_process";

import pc from "picocolors";
import { Command } from "commander";

import { buildAgentPrompt } from "./lib/agent-prompt.js";
import {
  findLatestDmg,
  installDependencies,
  openFile,
  resolveAppConfig,
  runPackageScript,
  writeProject,
} from "./lib/generator.js";
import { createFallbackSiteMetadata, fetchSiteMetadata } from "./lib/metadata.js";
import type { CreateCommandOptions, TitlebarStyle } from "./lib/types.js";
import { clearDirectoryContents, displayPath, isDirectoryEmpty, suggestAlternativeOutputDirectory } from "./lib/utils.js";

const defaultPackageManager = detectPreferredPackageManager();
const defaultOptions: CreateCommandOptions = {
  width: 1440,
  height: 900,
  titlebar: "unified",
  packageManager: defaultPackageManager,
  install: false,
  dmg: false,
  yes: false,
  showConfig: false,
  quiet: false,
};

if (looksLikeUrl(process.argv[2])) {
  process.argv.splice(2, 0, "create");
}

const program = new Command();
program
  .name("appbun")
  .description("Generate an Electrobun desktop wrapper from any web app URL.")
  .showSuggestionAfterError()
  .showHelpAfterError()
  .version("0.5.4");

program
  .command("create")
  .argument("<url>", "web app URL to wrap")
  .option("-n, --name <name>", "app display name")
  .option("-o, --out-dir <dir>", "output directory")
  .option("--title <title>", "desktop window title")
  .option("--description <description>", "package description")
  .option("--identifier <identifier>", "bundle identifier, for example com.example.app")
  .option("--theme-color <hex>", "shell accent color, for example #2563eb")
  .option(
    "--titlebar <style>",
    "window chrome preset: system, unified, compact, or minimal",
    parseTitlebar,
    defaultOptions.titlebar,
  )
  .option("--width <number>", "window width", parseInteger, defaultOptions.width)
  .option("--height <number>", "window height", parseInteger, defaultOptions.height)
  .option("--package-manager <pm>", "install command for the generated app: bun or npm", defaultOptions.packageManager)
  .option("--install", "install generated app dependencies")
  .option("--dmg", "on macOS: install dependencies, build a DMG, and open it")
  .option("-y, --yes", "accept interactive prompts automatically")
  .option("--show-config", "print resolved config before writing files")
  .option("--quiet", "reduce output")
  .addHelpText(
    "after",
    `

Titlebar presets:
  system   Keep the default system title bar. Best for strict native chrome.
  unified  Recommended on macOS. Hidden inset traffic lights with a connected local toolbar.
  compact  Same macOS pattern, but tighter for content-heavy apps.
  minimal  Same macOS pattern, with lighter metadata and less visible chrome.

Examples:
  $ appbun create https://calendar.google.com --name Calendar --out-dir ./calendar-app
  $ appbun https://linear.app --package-manager npm --install
  $ appbun create https://chat.openai.com --theme-color #10a37f --titlebar compact --width 1600 --height 1000
  $ appbun https://chat.openai.com --name ChatGPT --dmg
  $ appbun https://github.com --name GitHub --titlebar system
  $ appbun https://github.com --name GitHub --out-dir ./github --yes
`,
  )
  .action(async (url: string, options: CreateCommandOptions) => {
    try {
      validatePackageManager(options.packageManager);
      const userSpecifiedPackageManager = process.argv.includes("--package-manager");
      let usedFallbackMetadata = false;
      const metadata = await fetchSiteMetadata(url).catch((error) => {
        usedFallbackMetadata = true;
        if (!options.quiet) {
          const message = error instanceof Error ? error.message : String(error);
          console.log(pc.bold(pc.yellow("warning")), `metadata fetch failed, continuing with URL defaults`);
          console.log(`  reason: ${message}`);
        }
        return createFallbackSiteMetadata(url);
      });
      if (!options.quiet) {
        console.log(pc.bold(pc.cyan("appbun")), "resolved metadata");
        console.log(`  title: ${metadata.title ?? "(not found)"}`);
        console.log(`  description: ${metadata.description ?? "(not found)"}`);
        console.log(`  theme color: ${metadata.themeColor ?? "(not found)"}`);
        console.log(`  icon candidates: ${metadata.iconCandidates.length}`);
        console.log(`  metadata mode: ${usedFallbackMetadata ? "fallback" : "fetched"}`);
      }

      const resolvedOptions = { ...defaultOptions, ...options };
      let config = resolveAppConfig(url, resolvedOptions, metadata);
      config = await resolveInteractiveOutputDirectory(config, resolvedOptions);

      if (options.showConfig) {
        console.log(pc.bold(pc.green("resolved config")));
        console.log(JSON.stringify(config, null, 2));
      }

      if (!options.quiet && !userSpecifiedPackageManager && config.packageManager === "npm" && defaultPackageManager === "npm") {
        console.log(pc.bold(pc.cyan("package manager")), `${config.packageManager} (bun not found locally)`);
      }

      const preparedIcons = await writeProject(config, metadata);

      if (!options.quiet) {
        console.log(pc.bold(pc.green("created")), config.outDir);
        console.log(`  icon source: ${preparedIcons.sourceUrl ?? "(not resolved)"}`);
      }

      const shouldInstall = (options.install || options.dmg)
        ? await shouldProceedWithAction(
            resolvedOptions,
            `Install dependencies with ${config.packageManager} in ${displayPath(config.outDir)}?`,
            true,
          )
        : false;

      if (shouldInstall) {
        if (!options.quiet) {
          console.log(pc.bold(pc.cyan("installing")), `dependencies with ${config.packageManager}`);
        }
        installDependencies(config);
      } else if (options.dmg) {
        throw new Error("DMG flow cancelled before dependency installation.");
      }

      if (options.dmg) {
        if (process.platform !== "darwin") {
          throw new Error("--dmg is only supported on macOS");
        }

        const shouldBuildDmg = await shouldProceedWithAction(
          resolvedOptions,
          `Build a DMG now in ${displayPath(config.outDir)}?`,
          true,
        );
        if (!shouldBuildDmg) {
          console.log(pc.bold(pc.yellow("skipped")), "DMG build cancelled");
          console.log(`  run later: cd ${config.outDir} && ${config.packageManager} run build:dmg`);
          return;
        }

        if (!options.quiet) {
          console.log(pc.bold(pc.cyan("packaging")), "building DMG");
        }

        runPackageScript(config, "build:dmg");
        const dmgPath = findLatestDmg(config);
        if (!dmgPath) {
          throw new Error("DMG build completed but no .dmg file was found");
        }

        if (!options.quiet) {
          console.log(pc.bold(pc.green("dmg")), dmgPath);
          printMacLaunchNote();
        }

        const shouldOpenDmg = await shouldProceedWithAction(
          resolvedOptions,
          `Open ${displayPath(dmgPath)} now?`,
          true,
        );
        if (shouldOpenDmg) {
          openFile(dmgPath);
        }
      }

      if (!options.dmg) {
        console.log(pc.bold(pc.green("next steps")));
        console.log(`  cd ${config.outDir}`);
        console.log(`  ${config.packageManager} install`);
        console.log(`  ${config.packageManager} run dev`);
        console.log(`  ${config.packageManager} run build`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(pc.bold(pc.red("error")), message);
      process.exitCode = 1;
    }
  });

program
  .command("prompt")
  .argument("<url>", "web app URL to wrap")
  .option("-n, --name <name>", "app display name")
  .option("-o, --out-dir <dir>", "desktop wrapper output directory inside the repo")
  .option("--title <title>", "desktop window title")
  .option("--description <description>", "package description")
  .option("--identifier <identifier>", "bundle identifier, for example com.example.app")
  .option("--theme-color <hex>", "shell accent color, for example #2563eb")
  .option(
    "--titlebar <style>",
    "window chrome preset: system, unified, compact, or minimal",
    parseTitlebar,
    defaultOptions.titlebar,
  )
  .option("--width <number>", "window width", parseInteger, defaultOptions.width)
  .option("--height <number>", "window height", parseInteger, defaultOptions.height)
  .option("--copy", "copy the generated prompt to the clipboard when supported")
  .option("--quiet", "reduce metadata logs")
  .addHelpText(
    "after",
    `

Examples:
  $ appbun prompt http://localhost:3000 --name "My App"
  $ appbun prompt https://staging.example.com --name "Staging App" --titlebar minimal --copy
`,
  )
  .action(async (url: string, options: CreateCommandOptions & { copy?: boolean }) => {
    try {
      validatePackageManager(defaultOptions.packageManager);
      let usedFallbackMetadata = false;
      const metadata = await fetchSiteMetadata(url).catch((error) => {
        usedFallbackMetadata = true;
        if (!options.quiet) {
          const message = error instanceof Error ? error.message : String(error);
          console.log(pc.bold(pc.yellow("warning")), `metadata fetch failed, continuing with URL defaults`);
          console.log(`  reason: ${message}`);
        }
        return createFallbackSiteMetadata(url);
      });

      const resolvedOptions = {
        ...defaultOptions,
        ...options,
        packageManager: defaultOptions.packageManager,
        install: false,
        dmg: false,
        yes: false,
        showConfig: false,
      };
      let config = resolveAppConfig(url, resolvedOptions, metadata);
      if (!options.outDir) {
        config = {
          ...config,
          outDir: `./desktop/${config.slug}`,
        };
      }
      const prompt = buildAgentPrompt(config, metadata);

      if (!options.quiet) {
        console.log(pc.bold(pc.cyan("appbun")), "agent prompt");
        console.log(`  title: ${metadata.title ?? "(not found)"}`);
        console.log(`  description: ${metadata.description ?? "(not found)"}`);
        console.log(`  theme color: ${metadata.themeColor ?? "(not found)"}`);
        console.log(`  icon candidates: ${metadata.iconCandidates.length}`);
        console.log(`  metadata mode: ${usedFallbackMetadata ? "fallback" : "fetched"}`);
      }

      if (options.copy) {
        copyToClipboard(prompt);
        if (!options.quiet) {
          console.log(pc.bold(pc.green("copied")), "agent prompt copied to clipboard");
          console.log("");
        }
      }

      console.log(prompt);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(pc.bold(pc.red("error")), message);
      process.exitCode = 1;
    }
  });

program.addHelpText(
  "after",
  `
Commands:
  create   Scaffold a desktop wrapper project from a URL.
  prompt   Print a ready-to-paste instruction block for another coding agent.

Run "appbun <command> --help" to see examples and titlebar presets.
`,
);

await program.parseAsync(process.argv);

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid integer: ${value}`);
  }
  return parsed;
}

function parseTitlebar(value: string): TitlebarStyle {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "system" ||
    normalized === "unified" ||
    normalized === "compact" ||
    normalized === "minimal"
  ) {
    return normalized;
  }

  throw new Error(`Invalid titlebar style: ${value}. Use system, unified, compact, or minimal.`);
}

function validatePackageManager(value: string): asserts value is "bun" | "npm" {
  if (value !== "bun" && value !== "npm") {
    throw new Error(`Unsupported package manager: ${value}`);
  }
}

function detectPreferredPackageManager(): "bun" | "npm" {
  return hasExecutable("bun") ? "bun" : "npm";
}

function hasExecutable(command: string): boolean {
  const result = spawnSync(command, ["--version"], {
    stdio: "ignore",
  });
  return !result.error && result.status === 0;
}

function looksLikeUrl(value?: string): boolean {
  if (!value) {
    return false;
  }

  return /^https?:\/\//i.test(value);
}

async function resolveInteractiveOutputDirectory(
  config: ReturnType<typeof resolveAppConfig>,
  options: CreateCommandOptions,
): Promise<ReturnType<typeof resolveAppConfig>> {
  if (isDirectoryEmpty(config.outDir)) {
    return config;
  }

  if (options.yes) {
    clearDirectoryContents(config.outDir);
    return config;
  }

  if (!isInteractiveSession()) {
    throw new Error(
      `Refusing to write into non-empty directory: ${config.outDir}. Re-run with --yes to replace its contents.`,
    );
  }

  const shouldReplace = await askForConfirmation(
    `Output directory is not empty: ${displayPath(config.outDir)}. Remove its current contents and continue?`,
    false,
  );
  if (shouldReplace) {
    clearDirectoryContents(config.outDir);
    return config;
  }

  const fallbackOutDir = suggestAlternativeOutputDirectory(config.outDir);
  const shouldUseFallback = await askForConfirmation(
    `Use a new directory instead: ${displayPath(fallbackOutDir)}?`,
    true,
  );
  if (shouldUseFallback) {
    return {
      ...config,
      outDir: fallbackOutDir,
    };
  }

  throw new Error(`Cancelled. Directory left unchanged: ${config.outDir}`);
}

async function shouldProceedWithAction(
  options: CreateCommandOptions,
  message: string,
  defaultYes: boolean,
): Promise<boolean> {
  if (options.yes || !isInteractiveSession()) {
    return true;
  }

  return askForConfirmation(message, defaultYes);
}

async function askForConfirmation(message: string, defaultYes: boolean): Promise<boolean> {
  const suffix = defaultYes ? " [Y/n] " : " [y/N] ";
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = (await rl.question(`${message}${suffix}`)).trim().toLowerCase();
    if (!answer) {
      return defaultYes;
    }
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}

function isInteractiveSession(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function copyToClipboard(value: string): void {
  const command =
    process.platform === "darwin"
      ? { bin: "pbcopy", args: [] }
      : process.platform === "win32"
        ? { bin: "clip", args: [] }
        : { bin: "xclip", args: ["-selection", "clipboard"] };

  const result = spawnSync(command.bin, command.args, {
    input: value,
    encoding: "utf8",
    stdio: ["pipe", "ignore", "pipe"],
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    const error = result.stderr?.toString().trim();
    throw new Error(
      `Clipboard copy failed${error ? `: ${error}` : ""}. Re-run without --copy if clipboard access is unavailable.`,
    );
  }
}

function printMacLaunchNote(): void {
  console.log(pc.bold(pc.yellow("note")), "If the installed macOS app does not open on first launch, open it once from Applications with Open in the context menu.");
  console.log("  macOS can show a one-time launcher permission prompt for local Electrobun builds.");
}
