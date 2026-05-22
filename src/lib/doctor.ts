import { spawnSync } from "node:child_process";
import { platform, release } from "node:os";

export type DoctorStatus = "ok" | "warn" | "fail";
export type DoctorTarget = "macos" | "windows" | "linux";

export interface DoctorCheck {
  name: string;
  status: DoctorStatus;
  message: string;
  detail?: string;
}

export interface DoctorReport {
  status: DoctorStatus;
  platform: string;
  target?: DoctorTarget;
  checks: DoctorCheck[];
}

const MIN_NODE_MAJOR = 20;
const MIN_BUN_MAJOR = 1;
const MIN_BUN_MINOR = 3;

export function runDoctor(target?: DoctorTarget): DoctorReport {
  const checks = [
    checkNode(),
    checkBun(),
    checkNpm(),
    checkGit(),
    checkMacDmgTools(),
    checkPackagingTarget(target),
  ].filter((check): check is DoctorCheck => Boolean(check));

  return {
    status: summarizeDoctorStatus(checks),
    platform: `${platform()} ${release()}`,
    target,
    checks,
  };
}

export function parseDoctorTarget(value: string): DoctorTarget {
  const normalized = value.trim().toLowerCase();
  if (normalized === "macos" || normalized === "windows" || normalized === "linux") {
    return normalized;
  }

  throw new Error(`Invalid doctor target: ${value}. Use macos, windows, or linux.`);
}

export function summarizeDoctorStatus(checks: DoctorCheck[]): DoctorStatus {
  if (checks.some((check) => check.status === "fail")) {
    return "fail";
  }
  if (checks.some((check) => check.status === "warn")) {
    return "warn";
  }
  return "ok";
}

export function formatDoctorReport(report: DoctorReport): string {
  return [
    `appbun doctor (${report.platform})`,
    ...report.checks.map((check) => {
      const detail = check.detail ? `\n    ${check.detail}` : "";
      return `${statusLabel(check.status)} ${check.name}: ${check.message}${detail}`;
    }),
    "",
    report.status === "ok"
      ? "Environment looks ready for appbun scaffolding."
      : "Fix failed checks before packaging. Warnings are usually okay for scaffolding but may affect publishing.",
  ].join("\n");
}

function checkNode(): DoctorCheck {
  const version = process.versions.node;
  const major = Number.parseInt(version.split(".")[0] || "0", 10);
  if (major >= MIN_NODE_MAJOR) {
    return {
      name: "Node.js",
      status: "ok",
      message: `v${version}`,
    };
  }

  return {
    name: "Node.js",
    status: "fail",
    message: `v${version} found; appbun requires Node.js ${MIN_NODE_MAJOR}+`,
    detail: "Install a newer Node.js runtime before running appbun from npm or npx.",
  };
}

function checkBun(): DoctorCheck {
  const version = commandVersion("bun", ["--version"]);
  if (!version) {
    return {
      name: "Bun",
      status: "warn",
      message: "not found",
      detail: "appbun can fall back to npm, but Bun gives the fastest generated-project workflow.",
    };
  }

  const [major = 0, minor = 0] = version.split(".").map((part) => Number.parseInt(part, 10));
  if (major > MIN_BUN_MAJOR || (major === MIN_BUN_MAJOR && minor >= MIN_BUN_MINOR)) {
    return {
      name: "Bun",
      status: "ok",
      message: `v${version}`,
    };
  }

  return {
    name: "Bun",
    status: "warn",
    message: `v${version} found; appbun recommends Bun ${MIN_BUN_MAJOR}.${MIN_BUN_MINOR}+`,
  };
}

function checkNpm(): DoctorCheck {
  const version = commandVersion("npm", ["--version"]);
  if (version) {
    return {
      name: "npm",
      status: "ok",
      message: `v${version}`,
    };
  }

  return {
    name: "npm",
    status: "warn",
    message: "not found",
    detail: "npm is useful as a fallback package manager and for npm publication checks.",
  };
}

function checkGit(): DoctorCheck {
  const version = commandVersion("git", ["--version"]);
  if (version) {
    return {
      name: "Git",
      status: "ok",
      message: version.replace(/^git version /, "v"),
    };
  }

  return {
    name: "Git",
    status: "warn",
    message: "not found",
    detail: "Git is not required for scaffolding, but contributors need it for issues, PRs, and releases.",
  };
}

function checkMacDmgTools(): DoctorCheck | undefined {
  if (process.platform !== "darwin") {
    return {
      name: "DMG packaging",
      status: "warn",
      message: "--dmg is only available on macOS",
      detail: "Generated projects still build on Windows and Linux; installer automation is macOS-first today.",
    };
  }

  const hdiutil = commandVersion("hdiutil", ["help"]);
  if (!hdiutil) {
    return {
      name: "DMG packaging",
      status: "fail",
      message: "hdiutil not found",
      detail: "macOS DMG builds need hdiutil plus the generated project's create-dmg dependency.",
    };
  }

  return {
    name: "DMG packaging",
    status: "ok",
    message: "hdiutil available",
  };
}

function checkPackagingTarget(target?: DoctorTarget): DoctorCheck | undefined {
  if (!target) {
    return undefined;
  }

  const hostTarget = currentDoctorTarget();
  if (hostTarget !== target) {
    return {
      name: "Packaging target",
      status: "warn",
      message: `${target} requested on ${hostTarget}`,
      detail: "Electrobun builds should run on a native runner for this platform. Use a matching local machine or CI runner for release artifacts.",
    };
  }

  if (target === "linux") {
    return {
      name: "Packaging target",
      status: "warn",
      message: "linux native runner detected",
      detail: "Linux native webview builds may require GTK/WebKit runtime packages. For broader distribution, Electrobun recommends bundling CEF for Linux releases.",
    };
  }

  return {
    name: "Packaging target",
    status: "ok",
    message: `${target} native runner detected`,
  };
}

function currentDoctorTarget(): DoctorTarget {
  if (process.platform === "darwin") {
    return "macos";
  }
  if (process.platform === "win32") {
    return "windows";
  }
  return "linux";
}

function commandVersion(command: string, args: string[]): string | undefined {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error || result.status !== 0) {
    return undefined;
  }

  return (result.stdout || result.stderr).trim().split("\n")[0]?.trim();
}

function statusLabel(status: DoctorStatus): string {
  switch (status) {
    case "ok":
      return "ok";
    case "warn":
      return "warn";
    case "fail":
      return "fail";
  }
}
