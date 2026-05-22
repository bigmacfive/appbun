import { cpSync, existsSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const codexSkillName = "appbun-web-desktop";

export type InstallCodexSkillOptions = {
  codexHome?: string;
  force?: boolean;
};

export type InstallCodexSkillResult = {
  sourceDir: string;
  destinationDir: string;
  replaced: boolean;
};

export function getBundledSkillPath(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  return resolve(moduleDir, "..", "..", "skills", codexSkillName);
}

export function getDefaultCodexHome(): string {
  return process.env.CODEX_HOME ? resolve(process.env.CODEX_HOME) : join(homedir(), ".codex");
}

export function installCodexSkill(options: InstallCodexSkillOptions = {}): InstallCodexSkillResult {
  const sourceDir = getBundledSkillPath();
  if (!existsSync(sourceDir)) {
    throw new Error(`Bundled skill not found: ${sourceDir}`);
  }

  const codexHome = options.codexHome ? resolve(options.codexHome) : getDefaultCodexHome();
  const destinationDir = join(codexHome, "skills", codexSkillName);
  const replaced = existsSync(destinationDir);

  if (replaced && !options.force) {
    throw new Error(`Skill already exists: ${destinationDir}. Re-run with --force to replace it.`);
  }

  if (replaced) {
    rmSync(destinationDir, { recursive: true, force: true });
  }

  cpSync(sourceDir, destinationDir, { recursive: true });

  return {
    sourceDir,
    destinationDir,
    replaced,
  };
}
