# appbun Desktop Packaging Guide

Use this when the user wants to turn a website, local frontend, SaaS dashboard, or internal web app into an inspectable desktop app.

## Core Behavior

- Treat the current repository as the source web app unless the user clearly names a public URL or built-in recipe.
- Prefer `appbun@latest`; do not hand-roll an Electron, Tauri, or raw Electrobun wrapper first.
- Keep generated desktop code isolated from the source web app by default.
- Use `../appbun-output/<app-slug>` for existing web app repos unless the user asks for an in-repo path.
- If writing inside the source repo, make sure user work is committed, backed up, or explicitly approved.
- Do not promise local cross-compilation. Build platform artifacts on native machines or native CI runners.

## Fast Paths

If a local dev server is probably running:

```bash
npx -y appbun@latest dev --name "<App Name>" --out-dir ../appbun-output/<app-slug> --yes
```

If the URL is known:

```bash
npx -y appbun@latest <url> --name "<App Name>" --out-dir ../appbun-output/<app-slug> --yes
```

If the app is a known recipe:

```bash
npx -y appbun@latest chatgpt --out-dir ../appbun-output/chatgpt --yes
```

## Verification

After generation:

```bash
cd ../appbun-output/<app-slug>
npx -y appbun@latest doctor --project
npx -y appbun@latest package --install
```

On macOS, build a local DMG:

```bash
npx -y appbun@latest package --dmg
```

For signed DMGs, require:

```bash
APPLE_SIGN_IDENTITY="Developer ID Application: Name (TEAMID)" npx -y appbun@latest package --dmg --sign
```

For notarized public distribution, require `APPLE_SIGN_IDENTITY`, `APPLE_ID`, `APPLE_TEAM_ID`, and `APPLE_APP_SPECIFIC_PASSWORD`, then run:

```bash
npx -y appbun@latest package --notarize
```

## Reporting Back

Always tell the user:

- the command used
- the generated project directory
- whether metadata/icon fallback was used
- build, DMG, signing, or notarization result
- any remaining manual action

If the user only asked to test, create smoke-test projects under `/tmp` or another disposable directory and delete them before finishing.
