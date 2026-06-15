# appbun

**English** | [한국어](./README.ko.md)

[![npm version](https://img.shields.io/npm/v/appbun?color=cb3837&logo=npm)](https://www.npmjs.com/package/appbun)
[![npm downloads](https://img.shields.io/npm/dm/appbun?color=111827&logo=npm)](https://www.npmjs.com/package/appbun)
[![CI](https://img.shields.io/github/actions/workflow/status/bigmacfive/appbun/ci.yml?branch=main&label=ci)](https://github.com/bigmacfive/appbun/actions/workflows/ci.yml)
[![Last commit](https://img.shields.io/github/last-commit/bigmacfive/appbun)](https://github.com/bigmacfive/appbun/commits/main)
[![License](https://img.shields.io/github/license/bigmacfive/appbun)](./LICENSE)

Turn any web app into an inspectable desktop app and DMG. No black box wrapper.

```bash
npx -y appbun@latest https://github.com --name "GitHub" --dmg
```

`appbun` does not give you a mystery binary. It generates an inspectable [Electrobun](https://electrobun.dev) project with source code, icons, native-runner build scripts, macOS DMG packaging, and agent-friendly instructions.

![appbun terminal demo](https://raw.githubusercontent.com/bigmacfive/appbun/main/docs/assets/terminal-demo.gif)

Reusable launch clips:

| URL → app code | App code → DMG | Agent workflow |
| --- | --- | --- |
| ![URL to inspectable app code](https://raw.githubusercontent.com/bigmacfive/appbun/main/docs/assets/url-to-code.gif) | ![Inspectable app code to DMG](https://raw.githubusercontent.com/bigmacfive/appbun/main/docs/assets/code-to-dmg.gif) | ![Codex packages localhost with appbun](https://raw.githubusercontent.com/bigmacfive/appbun/main/docs/assets/agent-workflow.gif) |

## Give This To Codex Or Claude Code

Codex can turn your localhost app into a DMG:

```text
Use appbun to package my running web app at http://localhost:3000 as an inspectable desktop app.
Create it in ./desktop/my-app, run the generated project doctor, install dependencies, and build a macOS DMG if this machine supports it.
```

Want the agent to use native tools instead of guessing?

```bash
npx -y appbun@latest skill --install
npx -y appbun@latest skill --install-claude --cwd .
npx -y appbun@latest mcp
```

![Codex appbun workflow](https://raw.githubusercontent.com/bigmacfive/appbun/main/docs/assets/agent-workflow.gif)

## What You Get

| Need | Command | Result |
| --- | --- | --- |
| Package a public site | `appbun https://example.com --name Example` | Editable desktop wrapper project |
| Package your local frontend | `appbun dev --name "My App"` | Auto-detects common localhost ports |
| Generate and package in one go | `appbun https://example.com --name Example --dmg` | Project plus unsigned macOS DMG |
| Make a personal macOS installer | `appbun package --dmg` | Unsigned local DMG from inside a generated project |
| Prepare signed distribution | `appbun package --dmg --sign` | Requires `APPLE_SIGN_IDENTITY` |
| Prepare notarized distribution | `appbun package --notarize` | Uses Apple notary env vars |
| Let an agent do it | `appbun skill --install-claude --cwd .` | Claude Code guide in your repo |
| Drive it from any AI agent | `appbun mcp` | MCP server exposing create/recipes/discover |
| Feature it in your README | `appbun badge <url>` | "Get the desktop app" markdown badge |
| Make a share card | `appbun showcase chatgpt` | Markdown preview for README, releases, and socials |

## No Local Setup? Three Ways In

Not every user wants a terminal. appbun meets people where they are:

- **🖼️ Browse the gallery** — pre-built, downloadable macOS apps for open tools (Excalidraw, Photopea, Squoosh, Desmos). See [the app gallery](https://bigmacfive.github.io/appbun/).
- **🤖 Request an online build** — open a [Build a desktop app](https://github.com/bigmacfive/appbun/issues/new?template=build-app.yml) issue with a URL; a GitHub Action builds the `.dmg` and posts a download link. No local install.
- **📣 Share what you built** — open an [I built an app with appbun](https://github.com/bigmacfive/appbun/issues/new?template=submit-app.yml) issue and the gallery workflow opens a community-card PR.
- **⌨️ One command** — `npx -y appbun@latest <url> --name "My App" --dmg`.

Downloads from the gallery and online builder are **unsigned**: on first launch, open **System Settings → Privacy & Security → Open Anyway**.

## The 60 Second Path

Package a running local app:

```bash
cd your-web-app
npm run dev
npx -y appbun@latest dev --name "My App" --out-dir ../appbun-output/my-app --yes
cd ../appbun-output/my-app
npx -y appbun@latest doctor --project
npx -y appbun@latest package --install
```

On macOS, make a DMG:

```bash
npx -y appbun@latest package --dmg
```

The generated project remains normal code. Open it, edit the shell, commit it, run it in CI, or hand it to another developer.

This path is smoke-tested against `appbun@latest`: scaffold a public URL, inspect `appbun.generated.json`, install dependencies, build the Electrobun app, and create an unsigned macOS DMG.

## Why It Feels Different

Most URL-to-app tools optimize for the shortest demo. `appbun` optimizes for the next day too.

- **Inspectable output**: a normal Electrobun project, not a sealed wrapper.
- **Useful defaults**: metadata, theme color, icons, fallback icons, local shell, loading/error states.
- **Personal-app friendly**: one command can get you to a macOS DMG for your own machine.
- **Release honest**: native-runner scripts for macOS, Windows, and Linux; no fake cross-compilation promises.
- **Agent-native**: Codex skill, Claude Code `CLAUDE.md`, and paste-ready prompts.
- **Recoverable**: `doctor` checks both your environment and generated projects.

## Install

```bash
bun add -g appbun
```

```bash
npm install -g appbun
```

Or skip installation:

```bash
npx -y appbun@latest chatgpt --dmg
```

`appbun` prefers Bun when it is available. If Bun is missing, it can fall back to npm unless you force `--package-manager`.

## Use It From an AI Agent (MCP)

`appbun` ships a Model Context Protocol server so any MCP-capable client (Claude Desktop, Cursor, Codex, …) can scaffold desktop apps directly. Add it to your client config:

```json
{
  "mcpServers": {
    "appbun": { "command": "npx", "args": ["-y", "appbun@latest", "mcp"] }
  }
}
```

It exposes three tools: `appbun_create` (scaffold a project from a URL or recipe), `appbun_recipes` (list built-in apps), and `appbun_discover` (search by concept). Prefer a self-contained guide instead? `appbun skill --install-claude --cwd .` drops a `CLAUDE.md` into your repo.

## Core Commands

### Create

```bash
appbun https://linear.app --name "Linear Desktop"
appbun chatgpt --dmg
appbun github --titlebar compact
appbun create https://calendar.google.com --name Calendar --width 1600 --height 1000
```

### Discover

```bash
appbun recipes
appbun recipes --concept music
appbun discover design
appbun discover gcal
```

### Diagnose

```bash
appbun doctor
appbun doctor --target macos
appbun doctor --project
appbun doctor --project ../appbun-output/my-app --json
```

### Package

Run these inside a generated appbun project, or pass `--cwd`.

```bash
appbun package
appbun package --install
appbun package --dmg
appbun package --dmg --sign
appbun package --notarize
```

### Share

```bash
appbun badge https://example.com --name "Example"
appbun showcase chatgpt
```

Every generated README includes a **Built with appbun** badge and the exact command to rebuild that app. Use `appbun badge <url>` when you want a compact "Build this app" link, or `appbun showcase <recipe|url>` when you want a richer card with a screenshot, command, and online-builder link.

## macOS DMG, Signing, Notarization

Local personal DMG:

```bash
appbun package --dmg
```

Signed DMG:

```bash
APPLE_SIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)" \
appbun package --dmg --sign
```

Notarized DMG:

```bash
APPLE_SIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)" \
APPLE_ID="you@example.com" \
APPLE_TEAM_ID="TEAMID" \
APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx" \
appbun package --notarize
```

Unsigned DMGs are good for local personal use and internal checks. Public macOS distribution usually needs signing and notarization.

## Agent Workflows

Install the Codex skill:

```bash
appbun skill --install
```

Use it in Codex:

```text
$appbun-web-desktop package my local web app at http://localhost:3000 as a desktop app
```

Install Claude Code guidance into a repo:

```bash
appbun skill --install-claude --cwd .
```

That writes a focused `CLAUDE.md` so Claude naturally reaches for:

- `appbun dev`
- `appbun doctor --project`
- `appbun package --install`
- `appbun package --dmg`

Need a one-off prompt for any agent?

```bash
appbun prompt http://localhost:3000 --name "My App"
```

Static prompt templates live in:

- [docs/agent-prompts/web-app-repo.md](docs/agent-prompts/web-app-repo.md)
- [docs/agent-prompts/web-app-repo.ko.md](docs/agent-prompts/web-app-repo.ko.md)

## Generated Project

```text
my-app/
├── .github/workflows/release.yml
├── assets/
├── icon.iconset/
├── scripts/
│   ├── build-platform.mjs
│   └── create-dmg.mjs
├── src/
│   ├── bun/index.ts
│   └── mainview/
│       ├── index.html
│       ├── index.css
│       └── index.ts
├── appbun.generated.json
├── electrobun.config.ts
├── package.json
└── tsconfig.json
```

The generated app includes:

- source URL and generator metadata in `appbun.generated.json`
- site-derived or fallback icon assets
- a local webview shell with loading/error states
- macOS titlebar presets
- native-runner build scripts
- GitHub Actions release workflow

## Window Chrome Presets

| Preset | Best for | macOS behavior |
| --- | --- | --- |
| `system` | strict native chrome | default system title bar |
| `unified` | balanced default | hidden inset traffic lights plus local toolbar |
| `compact` | content-heavy apps | shorter unified toolbar |
| `minimal` | distraction-free wrappers | lighter metadata and border treatment |

Windows and Linux currently use the standard native title bar.

## Showcase

Public no-login targets captured with Playwright:

![appbun showcase](https://raw.githubusercontent.com/bigmacfive/appbun/main/docs/screenshots/showcase-grid.png)

| App | Command |
| --- | --- |
| GitHub | `appbun github --dmg` |
| YouTube | `appbun https://www.youtube.com --name "YouTube" --dmg` |
| Excalidraw | `appbun https://excalidraw.com --name "Excalidraw" --dmg` |
| Photopea | `appbun https://www.photopea.com --name "Photopea" --dmg` |
| Squoosh | `appbun https://squoosh.app --name "Squoosh" --dmg` |

More examples: [docs/showcase/README.md](docs/showcase/README.md)

## Submit Your App To The Gallery

Built something useful with appbun?

1. Run `appbun showcase <url-or-recipe>` and use the output in your repo or release notes.
2. Open the [I built an app with appbun](https://github.com/bigmacfive/appbun/issues/new?template=submit-app.yml) form.
3. Add the app URL, source repo or writeup, and build command.

The community gallery workflow turns accepted submissions into a PR that updates `docs/showcase/community-builds.json`, then the gallery page renders it under **Community builds**.

## Troubleshooting

### Bun is not installed

Use npm:

```bash
appbun https://example.com --package-manager npm
```

### Generated project looks suspicious

Run:

```bash
appbun doctor --project
```

### macOS app does not open the first time

Some local Electrobun macOS builds can trigger a one-time launcher permission prompt.

1. Open the Applications folder.
2. Right-click the app and choose `Open`.
3. Allow the macOS launcher prompt if it appears.

## Development

```bash
bun install
bun run check
bun run test
bun run build
npm pack --dry-run
```

Refresh showcase assets:

```bash
bunx playwright install chromium
bun run showcase:capture
```

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md) and the [Pake-grade goal](docs/pake-grade-goal.md).

High-value areas:

- Windows installer helpers
- Linux packaging helpers
- more reliable site metadata and icon heuristics
- auth-heavy web app recipes
- stronger generated shell UX
