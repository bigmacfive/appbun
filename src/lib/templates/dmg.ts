import type { ResolvedAppConfig, SigningOptions } from "../types.js";

const SIGNING_OPTIONS: SigningOptions = {
  identityEnv: "APPLE_SIGN_IDENTITY",
  requireEnv: "APPBUN_DMG_SIGN",
};

export function generatedCreateDmgScript(config: ResolvedAppConfig): string {
  return `import { mkdir, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

if (process.platform !== "darwin") {
  fail("platform", "build:dmg is only available on macOS.");
}

const root = process.cwd();
const buildDir = resolve(root, "build");
const appPath = await findLatestAppBundle(buildDir);
const signIdentity = process.env.${SIGNING_OPTIONS.identityEnv}?.trim();
const requireSigning = process.env.${SIGNING_OPTIONS.requireEnv} === "1";
const shouldNotarize = process.env.APPLE_NOTARIZE === "1";

if (!appPath) {
  fail("missing-app", "No macOS .app bundle found under build/. Run your stable build before creating a DMG.");
}

if (shouldNotarize && !signIdentity) {
  fail("notarize-requires-signing", "APPLE_NOTARIZE=1 requires ${SIGNING_OPTIONS.identityEnv} so the .app is signed before packaging.");
}

if (signIdentity) {
  signAppBundle(appPath, signIdentity);
} else if (requireSigning) {
  fail("missing-identity", "${SIGNING_OPTIONS.requireEnv}=1 was set, but ${SIGNING_OPTIONS.identityEnv} is empty.");
} else {
  console.log("Creating unsigned DMG. Set ${SIGNING_OPTIONS.identityEnv} to code sign the .app before packaging.");
}

const destinationDir = resolve(buildDir, "dmg");
await mkdir(destinationDir, { recursive: true });
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  [
    "create-dmg",
    appPath,
    destinationDir,
    "--overwrite",
    "--no-version-in-filename",
    "--no-code-sign",
    "--dmg-title",
    ${JSON.stringify(config.name.slice(0, 27))}
  ],
  {
    stdio: "inherit",
    cwd: root,
  },
);

if (result.error?.code === "ENOENT") {
  fail("missing-tool", "Could not run create-dmg through npx. Run install again and confirm npm is available.");
}

if (result.status !== 0) {
  fail("dmg-failed", \`create-dmg failed with exit code \${result.status ?? "unknown"}. Check the hdiutil output above.\`);
}

const dmgPath = await findLatestDmg(destinationDir);
if (!dmgPath) {
  fail("missing-dmg", \`create-dmg completed, but no DMG was found in \${destinationDir}.\`);
}

if (shouldNotarize) {
  notarizeDmg(dmgPath);
}

console.log(\`DMG created from \${basename(appPath)} in \${destinationDir}\`);

function signAppBundle(appPath, identity) {
  const identities = spawnSync("security", ["find-identity", "-v", "-p", "codesigning"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const identityOutput = \`\${identities.stdout || ""}\\n\${identities.stderr || ""}\`;
  if (identities.status !== 0) {
    fail("identity-check-failed", "Could not inspect local code signing identities with security find-identity.");
  }
  if (!identityOutput.includes(identity)) {
    fail("identity-not-found", \`${SIGNING_OPTIONS.identityEnv} was set, but no matching local identity was found: \${identity}\`);
  }

  const result = spawnSync("codesign", [
    "--force",
    "--deep",
    "--options",
    "runtime",
    "--sign",
    identity,
    appPath,
  ], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error?.code === "ENOENT") {
    fail("missing-codesign", "codesign was not found. Install Xcode Command Line Tools.");
  }
  if (result.status !== 0) {
    const output = \`\${result.stdout || ""}\\n\${result.stderr || ""}\`.trim();
    const hint = output.includes("User interaction is not allowed")
      ? "Keychain permission denied. Unlock the keychain or allow codesign to use the certificate."
      : "codesign failed. Check that the certificate is trusted and usable for this app bundle.";
    fail("codesign-failed", \`\${hint}\\n\${output}\`);
  }

  const verify = spawnSync("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (verify.status !== 0) {
    const output = \`\${verify.stdout || ""}\\n\${verify.stderr || ""}\`.trim();
    fail("codesign-verify-failed", \`The .app was signed, but verification failed.\\n\${output}\`);
  }

  console.log(\`Signed \${basename(appPath)} with \${identity}\`);
}

function notarizeDmg(dmgPath) {
  const appleId = process.env.APPLE_ID?.trim();
  const teamId = process.env.APPLE_TEAM_ID?.trim();
  const password = process.env.APPLE_APP_SPECIFIC_PASSWORD?.trim();
  if (!appleId || !teamId || !password) {
    fail("missing-notary-env", "APPLE_NOTARIZE=1 requires APPLE_ID, APPLE_TEAM_ID, and APPLE_APP_SPECIFIC_PASSWORD.");
  }

  const result = spawnSync("xcrun", [
    "notarytool",
    "submit",
    dmgPath,
    "--apple-id",
    appleId,
    "--team-id",
    teamId,
    "--password",
    password,
    "--wait",
  ], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error?.code === "ENOENT") {
    fail("missing-xcrun", "xcrun notarytool was not found. Install Xcode or Xcode Command Line Tools.");
  }
  if (result.status !== 0) {
    const output = \`\${result.stdout || ""}\\n\${result.stderr || ""}\`.trim();
    fail("notarization-failed", \`Apple notarization failed.\\n\${output}\`);
  }

  const staple = spawnSync("xcrun", ["stapler", "staple", dmgPath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (staple.status !== 0) {
    const output = \`\${staple.stdout || ""}\\n\${staple.stderr || ""}\`.trim();
    fail("staple-failed", \`Notarization succeeded, but stapling failed.\\n\${output}\`);
  }

  console.log(\`Notarized and stapled \${basename(dmgPath)}\`);
}

async function findLatestAppBundle(dir) {
  let best = undefined;
  await walk(dir);
  return best?.path;

  async function walk(currentDir) {
    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      if (entry.isDirectory() && entry.name.endsWith(".app")) {
        const score = scoreAppPath(fullPath);
        if (!best || score > best.score) {
          best = { path: fullPath, score };
        }
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath);
      }
    }
  }
}

async function findLatestDmg(dir) {
  try {
    const entries = await readdir(dir);
    return entries
      .filter((entry) => entry.endsWith(".dmg"))
      .sort()
      .map((entry) => join(dir, entry))
      .at(-1);
  } catch {
    return undefined;
  }
}

function scoreAppPath(pathname) {
  let score = 0;
  if (pathname.includes("stable")) score += 40;
  if (pathname.includes("canary")) score += 20;
  if (pathname.includes("dev")) score += 10;
  if (pathname.includes("macos")) score += 100;
  return score;
}

function fail(code, message) {
  console.error(\`appbun dmg error [\${code}]\`);
  console.error(message);
  process.exit(1);
}
`;
}
