#!/usr/bin/env node
import process from "node:process";

import pc from "picocolors";
import { Command } from "commander";

import { writeProject, installDependencies, resolveAppConfig } from "./lib/generator.js";
import { createFallbackSiteMetadata, fetchSiteMetadata } from "./lib/metadata.js";
import type { CreateCommandOptions } from "./lib/types.js";

const defaultOptions: CreateCommandOptions = {
  width: 1440,
  height: 900,
  packageManager: "bun",
  install: false,
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
  .version("0.3.2");

program
  .command("create")
  .argument("<url>", "web app URL to wrap")
  .option("-n, --name <name>", "app display name")
  .option("-o, --out-dir <dir>", "output directory")
  .option("--title <title>", "desktop window title")
  .option("--description <description>", "package description")
  .option("--identifier <identifier>", "bundle identifier, for example com.example.app")
  .option("--theme-color <hex>", "shell accent color, for example #2563eb")
  .option("--width <number>", "window width", parseInteger, defaultOptions.width)
  .option("--height <number>", "window height", parseInteger, defaultOptions.height)
  .option("--package-manager <pm>", "install command for the generated app: bun or npm", defaultOptions.packageManager)
  .option("--install", "install generated app dependencies")
  .option("--show-config", "print resolved config before writing files")
  .option("--quiet", "reduce output")
  .action(async (url: string, options: CreateCommandOptions) => {
    try {
      validatePackageManager(options.packageManager);
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
      const config = resolveAppConfig(url, { ...defaultOptions, ...options }, metadata);

      if (!options.quiet) {
        console.log(pc.bold(pc.cyan("appbun")), "resolved metadata");
        console.log(`  title: ${metadata.title ?? "(not found)"}`);
        console.log(`  description: ${metadata.description ?? "(not found)"}`);
        console.log(`  theme color: ${metadata.themeColor ?? "(not found)"}`);
        console.log(`  icon candidates: ${metadata.iconCandidates.length}`);
        console.log(`  metadata mode: ${usedFallbackMetadata ? "fallback" : "fetched"}`);
      }

      if (options.showConfig) {
        console.log(pc.bold(pc.green("resolved config")));
        console.log(JSON.stringify(config, null, 2));
      }

      const preparedIcons = await writeProject(config, metadata);

      if (!options.quiet) {
        console.log(pc.bold(pc.green("created")), config.outDir);
        console.log(`  icon source: ${preparedIcons.sourceUrl ?? "(not resolved)"}`);
      }

      if (options.install) {
        if (!options.quiet) {
          console.log(pc.bold(pc.cyan("installing")), `dependencies with ${config.packageManager}`);
        }
        installDependencies(config);
      }

      console.log(pc.bold(pc.green("next steps")));
      console.log(`  cd ${config.outDir}`);
      console.log(`  ${config.packageManager} install`);
      console.log(`  ${config.packageManager} run dev`);
      console.log(`  ${config.packageManager} run build`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(pc.bold(pc.red("error")), message);
      process.exitCode = 1;
    }
  });

program.addHelpText(
  "after",
  `
Examples:
  $ appbun create https://calendar.google.com --name Calendar --out-dir ./calendar-app
  $ appbun https://linear.app --package-manager npm --install
  $ appbun create https://chat.openai.com --theme-color #10a37f --width 1600 --height 1000
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

function validatePackageManager(value: string): asserts value is "bun" | "npm" {
  if (value !== "bun" && value !== "npm") {
    throw new Error(`Unsupported package manager: ${value}`);
  }
}

function looksLikeUrl(value?: string): boolean {
  if (!value) {
    return false;
  }

  return /^https?:\/\//i.test(value);
}
