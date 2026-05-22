---
name: appbun-web-desktop
description: Use when a user wants to turn a website, local web app, SaaS dashboard, internal tool, or existing frontend project into an inspectable Electrobun desktop app with appbun. Covers scaffolding, metadata, recipes, build diagnostics, native-runner packaging, and release readiness.
metadata:
  short-description: Package web apps as desktop apps with appbun
---

# appbun Web Desktop

Use `appbun` when the user wants a fast `URL -> desktop app` workflow that still leaves an editable Electrobun project in the repo.

## Default Workflow

1. Identify the target URL or local dev server.
   - Existing web app repo: prefer the running local URL, often `http://localhost:3000`.
   - Public website: use the canonical HTTPS URL.
   - Known app idea: check recipes with `appbun recipes` or `appbun discover <concept>`.
2. Choose a scoped output directory.
   - Existing repo: default to `./desktop/<app-slug>`.
   - Standalone wrapper: default to `./<app-slug>`.
3. Generate the wrapper.
   - Existing app repo:
     ```bash
     npx -y appbun@latest <url> --name "<App Name>" --out-dir ./desktop/<app-slug> --yes
     ```
   - Known recipe:
     ```bash
     npx -y appbun@latest chatgpt --out-dir ./desktop/chatgpt --yes
     ```
4. Install and verify inside the generated wrapper.
   ```bash
   cd ./desktop/<app-slug>
   bun install
   bun run build
   ```
5. Run diagnostics when builds fail or before release.
   ```bash
   npx -y appbun@latest doctor
   npx -y appbun@latest doctor --target macos
   npx -y appbun@latest doctor --target linux
   ```

## Agent Prompt Mode

When the user wants a prompt for another coding agent instead of direct scaffolding, generate one:

```bash
npx -y appbun@latest prompt http://localhost:3000 --name "<App Name>"
```

Use `--copy` only when clipboard access is acceptable.

## Packaging Rules

- Use `bun run build:current` or `bun run build:stable` for the current machine.
- Use platform scripts on native machines or CI runners:
  - macOS runner: `bun run build:macos`
  - Windows runner: `bun run build:windows`
  - Linux runner: `bun run build:linux`
- Do not promise local cross-compilation. Electrobun builds should run on a native runner for the target platform.
- For macOS DMG output, use `bun run build:dmg` on macOS.

## Quality Bar

Before considering the desktop wrapper done:

- The generated app name, package name, icon, window size, and theme color match the product.
- The wrapper source is committed or clearly isolated from the main web app.
- `bun run build` succeeds inside the generated project, or the remaining blocker is stated with logs.
- Release workflows use native OS runners for platform builds.
- README or release notes explain that the output is inspectable Electrobun code, not a black-box binary wrapper.

## Useful Commands

```bash
appbun recipes
appbun discover design
appbun doctor --target linux --json
appbun prompt http://localhost:3000 --name "My App"
appbun https://example.com --name "Example" --titlebar compact --yes
```
