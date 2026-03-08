# appbun

**English** | [한국어](./README.ko.md)

[![npm version](https://img.shields.io/npm/v/appbun?color=cb3837&logo=npm)](https://www.npmjs.com/package/appbun)
[![npm downloads](https://img.shields.io/npm/dm/appbun?color=111827&logo=npm)](https://www.npmjs.com/package/appbun)
[![CI](https://img.shields.io/github/actions/workflow/status/bigmacfive/appbun/ci.yml?branch=main&label=ci)](https://github.com/bigmacfive/appbun/actions/workflows/ci.yml)
[![Last commit](https://img.shields.io/github/last-commit/bigmacfive/appbun)](https://github.com/bigmacfive/appbun/commits/main)
[![Closed issues](https://img.shields.io/github/issues-closed/bigmacfive/appbun)](https://github.com/bigmacfive/appbun/issues?q=is%3Aissue+is%3Aclosed)
[![License](https://img.shields.io/github/license/bigmacfive/appbun)](./LICENSE)

Turn any webpage into a desktop app with one command. `appbun` wraps a URL in an [Electrobun](https://electrobun.dev) project, pulls usable icons from site metadata, and gives you installer-friendly packaging for macOS with a clean path to Windows and Linux builds.

Supports macOS, Windows, and Linux.

![appbun social card](https://raw.githubusercontent.com/bigmacfive/appbun/main/docs/assets/social-card.png)

## Why appbun

`appbun` exists for the same reason people reach for Pake: the fast `URL -> desktop app` workflow is useful.

The difference is the output.

Instead of hiding everything behind a black box, `appbun` gives you a normal Electrobun project you can inspect, edit, version, and ship.

What it handles for you:

- fetches title, description, theme color, favicon, apple-touch icon, and manifest icons
- rejects obviously broken icon responses and low-quality raster assets before packaging
- generates a local Electrobun shell around the target URL
- uses a unified top bar on macOS so the window chrome and content feel connected
- produces cross-platform build output, plus a macOS DMG flow for drag-to-Applications installs
- asks before destructive or heavyweight steps in interactive terminals, with `--yes` to skip prompts

## Install

```bash
bun add -g appbun
```

```bash
npm install -g appbun
```

If your npm global prefix is permission-locked, prefer `bun add -g appbun` or use `npx appbun@latest ...`.

## Quick start

```bash
appbun https://chat.openai.com --name "ChatGPT" --dmg
```

That one command can scaffold the project, install dependencies, build the app, create a DMG on macOS, and open the installer window.

If you want the generated project without building immediately:

```bash
appbun https://linear.app --name "Linear Desktop"
cd linear-desktop
bun install
bun run build
```

## CLI examples

```bash
appbun https://github.com --name "GitHub"
```

```bash
appbun create https://calendar.google.com \
  --name "Calendar" \
  --out-dir ./calendar-app \
  --width 1600 \
  --height 1000
```

```bash
appbun https://chat.openai.com --theme-color '#10a37f'
```

```bash
appbun https://www.notion.so --package-manager npm
```

Skip confirmation prompts in scripted runs:

```bash
appbun https://github.com --name "GitHub" --out-dir ./github --yes
```

## Showcase

Current public web entry points captured with Playwright and framed to match the generated shell:

![appbun showcase](https://raw.githubusercontent.com/bigmacfive/appbun/main/docs/screenshots/showcase-grid.png)

### Example targets

| App | URL | Command |
| --- | --- | --- |
| ChatGPT | `https://chat.openai.com` | `appbun https://chat.openai.com --name "ChatGPT" --dmg` |
| GitHub | `https://github.com` | `appbun https://github.com --name "GitHub" --dmg` |
| Notion | `https://www.notion.so` | `appbun https://www.notion.so --name "Notion" --dmg` |
| Figma | `https://www.figma.com` | `appbun https://www.figma.com --name "Figma" --dmg` |
| Linear | `https://linear.app` | `appbun https://linear.app --name "Linear" --dmg` |
| Telegram | `https://web.telegram.org/k` | `appbun https://web.telegram.org/k --name "Telegram" --dmg` |

More detail lives in [docs/showcase/README.md](docs/showcase/README.md).

## Generated project structure

```text
my-app/
├── assets/                 # Derived icon assets for packaging
├── icon.iconset/           # macOS iconset sizes (16 through 1024)
├── scripts/
│   └── create-dmg.mjs      # macOS DMG helper
├── src/
│   ├── bun/
│   │   └── index.ts        # Electrobun window entrypoint
│   └── mainview/
│       ├── index.html      # Local shell markup
│       ├── index.css       # Unified title area styles
│       └── index.ts        # Embedded remote webview bootstrap
├── electrobun.config.ts
├── package.json
└── tsconfig.json
```

## Platform notes

### macOS

Generated apps use:

- `hiddenInset` traffic lights
- `UnifiedTitleAndToolbar`
- a full-width local title area instead of a floating fake header
- `build:dmg` for installer-style distribution

### Windows and Linux

The generated Electrobun project is already buildable there. `appbun` currently focuses its installer automation on macOS first; Windows and Linux packaging helpers are still on the roadmap.

## Local development

```bash
bun install
bun run check
bun run test
bun run build
```

## Refresh showcase assets

```bash
bunx playwright install chromium
bun run showcase:capture
```

This updates:

- `docs/screenshots/*.png`
- `docs/assets/social-card.png`
- `docs/showcase/manifest.json`

## Release checks

```bash
bun run release:check
```

## Contributing

The contribution bar is straightforward: improve the generated app quality, packaging flow, or docs, and prove it with a reproducible test or sample scaffold.

Start here:

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [Bug report template](.github/ISSUE_TEMPLATE/bug_report.yml)
- [Feature request template](.github/ISSUE_TEMPLATE/feature_request.yml)

High-value contribution areas:

- better site-specific icon heuristics
- Windows installer helpers
- Linux packaging helpers
- auth-heavy web app presets
- navigation controls and app menus
- docs, gallery, and compatibility notes

## Positioning

If you are searching for any of these, this project is in the right lane:

- Pake alternative for Electrobun
- turn website into desktop app with Bun
- website to desktop app CLI
- package URL as a macOS app
- create DMG from a web app wrapper
- Electrobun app generator
- website wrapper for macOS, Windows, and Linux

## License

MIT
