import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import type {
  CreateCommandOptions,
  GeneratedFile,
  PackageManager,
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
  slugify,
} from "./utils.js";
import { prepareIconAssets } from "./icons.js";
import { renderTemplateFiles as renderGeneratedTemplateFiles } from "./templates/project.js";

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
    titlebar: options.titlebar ?? "unified",
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
  const parentDir = dirname(safeOutDir);
  await mkdir(parentDir, { recursive: true });
  const tempDir = await mkdtemp(join(parentDir, ".appbun-create-"));

  try {
    const preparedIcons = await prepareIconAssets(tempDir, metadata);

    for (const file of renderTemplateFiles(config, preparedIcons)) {
      const outputPath = resolve(tempDir, file.path);
      const fileParentDir = outputPath.slice(0, Math.max(outputPath.lastIndexOf("/"), outputPath.lastIndexOf("\\")));
      if (fileParentDir) {
        await mkdir(fileParentDir, { recursive: true });
      }
      await writeFile(outputPath, file.content);
    }

    await rm(safeOutDir, { recursive: true, force: true });
    await rename(tempDir, safeOutDir);
    return preparedIcons;
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

export function installDependencies(config: ResolvedAppConfig): void {
  runPackageManagerCommand(config.packageManager, ["install"], config.outDir);
}

export function runPackageScript(config: ResolvedAppConfig, scriptName: string): void {
  runPackageManagerCommand(config.packageManager, ["run", scriptName], config.outDir);
}

export function findLatestDmg(config: ResolvedAppConfig): string | undefined {
  const dmgDir = resolve(config.outDir, "build", "dmg");
  try {
    const entries = readdirSync(dmgDir)
      .filter((entry) => entry.endsWith(".dmg"))
      .sort();
    const latest = entries.at(-1);
    return latest ? join(dmgDir, latest) : undefined;
  } catch {
    return undefined;
  }
}

export function openFile(targetPath: string): void {
  const isWindows = process.platform === "win32";
  const command = process.platform === "darwin" ? "open" : isWindows ? "start" : "xdg-open";
  // The Windows `start` builtin treats the first quoted argument as the window
  // title, so pass an empty title before the path; otherwise a path containing
  // spaces opens a console window titled with the path instead of the file.
  const args = isWindows ? ["", targetPath] : [targetPath];
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: isWindows,
  });

  if (result.status !== 0) {
    throw new Error(`Failed to open ${targetPath}`);
  }
}

export function renderTemplateFiles(config: ResolvedAppConfig, icons: PreparedIconAssets): GeneratedFile[] {
  return renderGeneratedTemplateFiles(config, icons);
}

function runPackageManagerCommand(packageManager: PackageManager, args: string[], cwd: string): void {
  const result = spawnSync(packageManager, args, {
    cwd,
    stdio: "inherit",
  });

  if (result.error) {
    const error = result.error as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      const fallback = packageManager === "bun" ? "npm" : "bun";
      throw new Error(
        `${packageManager} is not installed. Install ${packageManager} or rerun appbun with --package-manager ${fallback}.`,
      );
    }

    throw error;
  }

  if (result.status !== 0) {
    throw new Error(`${packageManager} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
}
