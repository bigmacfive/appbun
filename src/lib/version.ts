import { readFileSync } from "node:fs";

type PackageJson = {
  version?: string;
};

export function getAppbunVersion(): string {
  try {
    const packageJsonUrl = new URL("../../package.json", import.meta.url);
    const packageJson = JSON.parse(readFileSync(packageJsonUrl, "utf8")) as PackageJson;
    return packageJson.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}
