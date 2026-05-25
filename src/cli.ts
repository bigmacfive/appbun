#!/usr/bin/env node
import process from "node:process";
import { createInterface } from "node:readline/promises";
import { spawnSync } from "node:child_process";

import pc from "picocolors";
import { Command, InvalidArgumentError } from "commander";

import { buildAgentPrompt } from "./lib/agent-prompt.js";
import { formatDoctorReport, parseDoctorTarget, runDoctor } from "./lib/doctor.js";
import { discoverLocalWebApp } from "./lib/local-dev.js";
import { packageGeneratedProject } from "./lib/project-package.js";
import { runProjectDoctor } from "./lib/project-doctor.js";
import {
  findLatestDmg,
  installDependencies,
  openFile,
  resolveAppConfig,
  runPackageScript,
  writeProject,
} from "./lib/generator.js";
import { createFallbackSiteMetadata, fetchSiteMetadata } from "./lib/metadata.js";
import { appRecipes, findAppRecipe, formatConceptTable, formatRecipeTable, listRecipeConcepts, searchAppRecipes } from "./lib/recipes.js";
import { getBundledClaudeGuidePath, getBundledSkillPath, installClaudeGuide, installCodexSkill } from "./lib/skill.js";
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
  icon: true,
  yes: false,
  showConfig: false,
  quiet: false,
};

if (shouldDefaultToCreate(process.argv[2])) {
  process.argv.splice(2, 0, "create");
}

const program = new Command();
program
  .name("appbun")
  .description("Generate an Electrobun desktop wrapper from any web app URL.")
  .showSuggestionAfterError()
  .showHelpAfterError()
  .version("0.10.1");

program
  .command("create")
  .argument("<target>", "web app URL or built-in recipe slug to wrap")
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
  .option("--no-icon", "skip fetching and generating icon assets")
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
  $ appbun chatgpt --dmg
  $ appbun github --titlebar compact
  $ appbun create https://calendar.google.com --name Calendar --out-dir ./calendar-app
  $ appbun https://linear.app --package-manager npm --install
  $ appbun create https://chat.openai.com --theme-color #10a37f --titlebar compact --width 1600 --height 1000
  $ appbun https://chat.openai.com --name ChatGPT --dmg
  $ appbun https://github.com --name GitHub --titlebar system
  $ appbun https://github.com --name GitHub --out-dir ./github --yes
`,
  )
  .action(async (target: string, options: CreateCommandOptions) => {
    try {
      validatePackageManager(options.packageManager);
      const { url, options: resolvedRecipeOptions, recipeLabel } = resolveTargetOptions(target, options);
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
        console.log(`  fetched description: ${metadata.description ?? "(not found)"}`);
        console.log(`  theme color: ${metadata.themeColor ?? "(not found)"}`);
        console.log(`  icon candidates: ${metadata.iconCandidates.length}`);
        console.log(`  metadata mode: ${usedFallbackMetadata ? "fallback" : "fetched"}`);
      }

      const resolvedOptions = { ...defaultOptions, ...resolvedRecipeOptions };
      let config = resolveAppConfig(url, resolvedOptions, metadata);
      config = await resolveInteractiveOutputDirectory(config, resolvedOptions);

      if (options.showConfig) {
        console.log(pc.bold(pc.green("resolved config")));
        console.log(JSON.stringify(config, null, 2));
      } else if (!options.quiet && options.description?.trim()) {
        console.log(pc.bold(pc.cyan("config")), `description: ${config.description}`);
      }

      if (!options.quiet && !userSpecifiedPackageManager && config.packageManager === "npm" && defaultPackageManager === "npm") {
        console.log(pc.bold(pc.cyan("package manager")), `${config.packageManager} (bun not found locally)`);
      }
      if (!options.quiet && recipeLabel) {
        console.log(pc.bold(pc.cyan("recipe")), recipeLabel);
      }

      const shouldSkipIcons = resolvedOptions.icon === false;
      const iconMetadata = shouldSkipIcons ? { ...metadata, iconCandidates: [] } : metadata;
      const preparedIcons = await writeProject(config, iconMetadata);

      if (!options.quiet) {
        console.log(pc.bold(pc.green("created")), config.outDir);
        console.log(`  icon source: ${shouldSkipIcons ? "(skipped)" : preparedIcons.sourceUrl ?? "(not resolved)"}`);
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
  .argument("<target>", "web app URL or built-in recipe slug to wrap")
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
  $ appbun prompt chatgpt
  $ appbun prompt http://localhost:3000 --name "My App"
  $ appbun prompt https://staging.example.com --name "Staging App" --titlebar minimal --copy
`,
  )
  .action(async (target: string, options: CreateCommandOptions & { copy?: boolean }) => {
    try {
      validatePackageManager(defaultOptions.packageManager);
      const { url, options: resolvedRecipeOptions, recipeLabel } = resolveTargetOptions(target, options);
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
        ...resolvedRecipeOptions,
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
        if (recipeLabel) {
          console.log(`  recipe: ${recipeLabel}`);
        }
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

program
  .command("recipes")
  .alias("list")
  .description("List built-in app recipes.")
  .option("-c, --concept <concept>", "filter recipes by concept, such as ai, design, music, or work")
  .option("--json", "print recipes as JSON")
  .action((options: { concept?: string; json?: boolean }) => {
    const recipes = options.concept ? searchAppRecipes(options.concept) : appRecipes;
    if (options.json) {
      console.log(JSON.stringify(recipes, null, 2));
      return;
    }

    console.log(pc.bold(pc.cyan(options.concept ? `appbun recipes: ${options.concept}` : "appbun recipes")));
    if (recipes.length === 0) {
      console.log(`No recipes found. Try one of: ${listRecipeConcepts().join(", ")}`);
      return;
    }
    console.log(formatRecipeTable(recipes));
    console.log("");
    console.log("Use one with:");
    console.log("  appbun chatgpt --dmg");
    console.log("  appbun create github --out-dir ./github");
  });

program
  .command("discover [query]")
  .description("Discover recipes by concept, name, alias, or description.")
  .option("--json", "print matches as JSON")
  .action((query: string | undefined, options: { json?: boolean }) => {
    if (!query) {
      if (options.json) {
        console.log(JSON.stringify(listRecipeConcepts(), null, 2));
        return;
      }

      console.log(pc.bold(pc.cyan("appbun concepts")));
      console.log(formatConceptTable());
      console.log("");
      console.log("Search with:");
      console.log("  appbun discover ai");
      console.log("  appbun discover design");
      console.log("  appbun recipes --concept music");
      return;
    }

    const recipes = searchAppRecipes(query);
    if (options.json) {
      console.log(JSON.stringify(recipes, null, 2));
      return;
    }

    console.log(pc.bold(pc.cyan(`appbun discover: ${query}`)));
    if (recipes.length === 0) {
      console.log(`No recipes found. Try one of: ${listRecipeConcepts().join(", ")}`);
      return;
    }
    console.log(formatRecipeTable(recipes));
  });

program
  .command("doctor")
  .description("Check the local appbun development and packaging environment.")
  .option("--target <target>", "check packaging readiness for macos, windows, or linux", parseDoctorTargetOption)
  .option("--project [dir]", "check a generated appbun project; defaults to the current directory")
  .option("--json", "print the report as JSON")
  .option("--strict", "exit non-zero for warnings as well as failures")
  .action((options: { target?: ReturnType<typeof parseDoctorTarget>; project?: string | boolean; json?: boolean; strict?: boolean }) => {
    const report = options.project
      ? runProjectDoctor({ cwd: typeof options.project === "string" ? options.project : process.cwd() })
      : runDoctor(options.target);
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(colorDoctorReport(formatDoctorReport(report)));
    }

    if (report.status === "fail" || (options.strict && report.status !== "ok")) {
      process.exitCode = 1;
    }
  });

program
  .command("package")
  .description("Build or package a generated appbun project from inside its project directory.")
  .option("--cwd <dir>", "generated project directory; defaults to the current directory")
  .option("--install", "install dependencies before packaging")
  .option("--dmg", "build a macOS DMG")
  .option("--sign", "require APPLE_SIGN_IDENTITY and sign the app before creating a DMG")
  .option("--notarize", "sign and notarize the app before creating a DMG")
  .action((options: { cwd?: string; install?: boolean; dmg?: boolean; sign?: boolean; notarize?: boolean }) => {
    try {
      packageGeneratedProject(options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(pc.bold(pc.red("error")), message);
      process.exitCode = 1;
    }
  });

program
  .command("dev")
  .description("Detect a running local web app and scaffold it as a desktop app.")
  .option("-n, --name <name>", "app display name")
  .option("-o, --out-dir <dir>", "output directory")
  .option("-y, --yes", "accept interactive prompts automatically")
  .option("--quiet", "reduce output")
  .action(async (options: Pick<CreateCommandOptions, "name" | "outDir" | "yes" | "quiet">) => {
    try {
      const url = await discoverLocalWebApp();
      if (!url) {
        throw new Error("No local web app found on common ports: 3000, 5173, 4173, 8080, 8000, 5000, 5174, 4321.");
      }

      if (!options.quiet) {
        console.log(pc.bold(pc.cyan("appbun")), `detected ${url}`);
      }

      const createOptions = {
        ...defaultOptions,
        ...options,
        outDir: options.outDir ?? "./desktop/local-app",
      };
      const metadata = await fetchSiteMetadata(url).catch(() => createFallbackSiteMetadata(url));
      let config = resolveAppConfig(url, createOptions, metadata);
      config = await resolveInteractiveOutputDirectory(config, createOptions);
      const icons = await writeProject(config, metadata);

      if (!options.quiet) {
        console.log(pc.bold(pc.green("created")), config.outDir);
        console.log(`  icon source: ${icons.sourceUrl ?? "(fallback)"}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(pc.bold(pc.red("error")), message);
      process.exitCode = 1;
    }
  });

program
  .command("skill")
  .description("Show or install the bundled Codex skill for packaging web apps with appbun.")
  .option("--path", "print only the bundled skill directory")
  .option("--claude-path", "print only the bundled Claude Code guide path")
  .option("--install", "install the skill into CODEX_HOME or ~/.codex")
  .option("--install-claude", "install the bundled CLAUDE.md guide into a project directory")
  .option("--codex-home <dir>", "Codex home directory; defaults to CODEX_HOME or ~/.codex")
  .option("--cwd <dir>", "project directory for --install-claude; defaults to the current directory")
  .option("--force", "replace an existing installed skill")
  .addHelpText(
    "after",
    `

Examples:
  $ appbun skill
  $ appbun skill --path
  $ appbun skill --claude-path
  $ appbun skill --install
  $ appbun skill --install-claude --cwd .
  $ appbun skill --install --force
`,
  )
  .action((options: { path?: boolean; claudePath?: boolean; install?: boolean; installClaude?: boolean; codexHome?: string; cwd?: string; force?: boolean }) => {
    try {
      if (options.path) {
        console.log(getBundledSkillPath());
        return;
      }
      if (options.claudePath) {
        console.log(getBundledClaudeGuidePath());
        return;
      }

      if (options.install) {
        const result = installCodexSkill({
          codexHome: options.codexHome,
          force: options.force,
        });
        console.log(pc.bold(pc.green(result.replaced ? "reinstalled" : "installed")), "appbun Codex skill");
        console.log(`  source: ${result.sourceDir}`);
        console.log(`  destination: ${result.destinationDir}`);
        console.log("");
        console.log("Use it in Codex with:");
        console.log("  $appbun-web-desktop package my web app into a desktop app");
        return;
      }

      if (options.installClaude) {
        const result = installClaudeGuide({
          cwd: options.cwd,
          force: options.force,
        });
        console.log(pc.bold(pc.green(result.replaced ? "replaced" : "installed")), "Claude Code appbun guide");
        console.log(`  source: ${getBundledClaudeGuidePath()}`);
        console.log(`  destination: ${result.destinationDir}`);
        return;
      }

      console.log(pc.bold(pc.cyan("appbun Codex skill")));
      console.log(`  bundled path: ${getBundledSkillPath()}`);
      console.log(`  Claude Code guide: ${getBundledClaudeGuidePath()}`);
      console.log("");
      console.log("Install locally with:");
      console.log("  appbun skill --install");
      console.log("  appbun skill --install-claude --cwd .");
      console.log("");
      console.log("Then invoke it with:");
      console.log("  $appbun-web-desktop package my web app into a desktop app");
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
  recipes  List built-in popular app recipes.
  discover Find recipes by concept, name, alias, or description.
  doctor   Check local development and packaging readiness.
  package  Build or package a generated appbun project.
  dev      Detect a local web app and scaffold it.
  skill    Show or install the bundled Codex skill.

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

function parseDoctorTargetOption(value: string): ReturnType<typeof parseDoctorTarget> {
  try {
    return parseDoctorTarget(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new InvalidArgumentError(message);
  }
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

function shouldDefaultToCreate(value?: string): boolean {
  if (!value || value.startsWith("-")) {
    return false;
  }

  if (looksLikeUrl(value)) {
    return true;
  }

  if (findAppRecipe(value)) {
    return true;
  }

  return false;
}

function resolveTargetOptions<T extends Partial<CreateCommandOptions>>(
  target: string,
  options: T,
): { url: string; options: T; recipeLabel?: string } {
  if (looksLikeUrl(target)) {
    return { url: target, options };
  }

  const recipe = findAppRecipe(target);
  if (!recipe) {
    const suggestions = searchAppRecipes(target).slice(0, 3).map((match) => match.slug);
    const suffix = suggestions.length > 0
      ? ` Did you mean: ${suggestions.join(", ")}?`
      : ` Run "appbun discover" to see related concepts.`;
    throw new Error(`Unknown recipe or URL: ${target}.${suffix}`);
  }

  return {
    url: recipe.url,
    recipeLabel: `${recipe.slug} (${recipe.name})`,
    options: {
      ...options,
      name: options.name ?? recipe.name,
      description: options.description ?? recipe.description,
      themeColor: options.themeColor ?? recipe.themeColor,
      titlebar: userPassedOption("--titlebar") ? options.titlebar : (recipe.titlebar ?? options.titlebar),
      width: userPassedOption("--width") ? options.width : (recipe.width ?? options.width),
      height: userPassedOption("--height") ? options.height : (recipe.height ?? options.height),
    },
  };
}

function userPassedOption(flag: string): boolean {
  return process.argv.includes(flag) || process.argv.some((arg) => arg.startsWith(`${flag}=`));
}

function colorDoctorReport(report: string): string {
  return report
    .split("\n")
    .map((line) => {
      if (line.startsWith("ok ")) {
        return pc.green(line);
      }
      if (line.startsWith("warn ")) {
        return pc.yellow(line);
      }
      if (line.startsWith("fail ")) {
        return pc.red(line);
      }
      return line;
    })
    .join("\n");
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
