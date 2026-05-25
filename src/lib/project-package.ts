import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import type { PackageManager } from "./types.js";

export interface ProjectPackageOptions {
  cwd?: string;
  dmg?: boolean;
  sign?: boolean;
  notarize?: boolean;
  install?: boolean;
}

export function packageGeneratedProject(options: ProjectPackageOptions = {}): void {
  const cwd = resolve(options.cwd ?? process.cwd());
  const packageManager = detectProjectPackageManager(cwd);

  if (options.install) {
    runPackageManager(packageManager, ["install"], cwd);
  }

  if (options.notarize) {
    runPackageManager(packageManager, ["run", "build:dmg:notarized"], cwd, {
      APPLE_NOTARIZE: "1",
      APPBUN_DMG_SIGN: "1",
    });
    return;
  }

  if (options.dmg || options.sign) {
    runPackageManager(packageManager, ["run", "build:dmg"], cwd, options.sign ? { APPBUN_DMG_SIGN: "1" } : undefined);
    return;
  }

  runPackageManager(packageManager, ["run", "build"], cwd);
}

export function detectProjectPackageManager(cwd: string): PackageManager {
  const manifestPath = resolve(cwd, "appbun.generated.json");
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { packageManager?: PackageManager };
      if (manifest.packageManager === "bun" || manifest.packageManager === "npm") {
        return manifest.packageManager;
      }
    } catch {
      // Fall through to lockfile heuristics.
    }
  }

  if (existsSync(resolve(cwd, "bun.lock")) || existsSync(resolve(cwd, "bun.lockb"))) {
    return "bun";
  }
  return "npm";
}

function runPackageManager(packageManager: PackageManager, args: string[], cwd: string, env?: Record<string, string>): void {
  const command = process.platform === "win32" && packageManager === "npm" ? "npm.cmd" : packageManager;
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: env ? { ...process.env, ...env } : process.env,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${packageManager} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
}
