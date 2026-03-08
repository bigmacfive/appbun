# appbun

Turn any web app into an installable desktop app powered by [Electrobun](https://electrobun.dev).

`appbun` is a Pake-style app generator for people who want the same fast "URL -> desktop app" workflow, but built on Electrobun instead of Tauri or Electron.

- npm: [appbun](https://www.npmjs.com/package/appbun)
- GitHub: [bigmacfive/appbun](https://github.com/bigmacfive/appbun)

## Why appbun

Packaging a web app as a desktop app should not require building a whole native shell from scratch.

`appbun` handles the repetitive parts for you:

- reads site metadata like title, description, theme color, favicon, and manifest icons
- generates an Electrobun desktop shell around the remote web app
- creates site-derived icons for macOS, Windows, and Linux
- gives macOS builds a more app-like unified title area instead of a generic browser frame
- adds a `build:dmg` workflow so macOS users get the familiar drag-to-Applications installer flow

## What you get

Given a URL like `https://linear.app`, `appbun` generates a project that includes:

- an Electrobun app entrypoint in `src/bun/index.ts`
- a local shell UI in `src/mainview/` with an embedded `electrobun-webview`
- platform packaging config in `electrobun.config.ts`
- generated icon assets in `assets/` and `icon.iconset/`
- a macOS DMG creation script in `scripts/create-dmg.mjs`

The output is a real project you can inspect, edit, version, and contribute back to.

## Install

```bash
bun add -g appbun
```

```bash
npm install -g appbun
```

If your npm global install path is permission-locked, prefer `bun add -g appbun` or use `npx appbun ...`.

## Quick Start

```bash
appbun https://linear.app --name "Linear Desktop"
cd linear-desktop
bun install
bun run build
```

For a macOS installer-style DMG:

```bash
bun run build:dmg
```

Or do it in one step:

```bash
appbun https://chat.openai.com --name "ChatGPT" --dmg
```

That flow generates the project, installs dependencies, builds the macOS app, creates a DMG, and opens the DMG automatically.

## CLI Examples

Basic usage:

```bash
appbun https://calendar.google.com
```

Custom name, size, and output folder:

```bash
appbun create https://calendar.google.com \
  --name "Calendar" \
  --out-dir ./calendar-app \
  --width 1600 \
  --height 1000
```

Override shell accent color manually:

```bash
appbun https://chat.openai.com --theme-color '#10a37f'
```

Use npm for generated project installs:

```bash
appbun https://notion.so --package-manager npm
```

## Generated Project Structure

```text
my-app/
├── assets/                 # Derived app icons
├── icon.iconset/           # macOS iconset
├── scripts/
│   └── create-dmg.mjs      # macOS DMG packager
├── src/
│   ├── bun/
│   │   └── index.ts        # Electrobun window entry
│   └── mainview/
│       ├── index.html      # Local shell markup
│       ├── index.css       # Unified app chrome styling
│       └── index.ts        # Embedded webview setup
├── electrobun.config.ts
├── package.json
└── tsconfig.json
```

## macOS Experience

Generated apps on macOS are intentionally not just a plain remote browser window.

`appbun` uses a local shell so the desktop app can feel more native:

- hidden inset traffic lights
- unified top bar and content area
- site icon and origin shown in the shell header
- DMG packaging for easier drag-to-Applications installs

## Positioning

If you are searching for any of these, you are in the right place:

- Pake alternative for Electrobun
- turn website into desktop app with Bun
- web app to desktop app CLI
- package URL as macOS app
- generate DMG from web app wrapper
- Electrobun app generator
- website to desktop wrapper

## Local Development

```bash
bun install
bun run check
bun run test
bun run build
```

## Release Checks

```bash
bun run release:check
```

## Contributing

Contributions are welcome.

Good first contribution areas:

- better favicon and manifest icon selection
- Linux and Windows installer packaging flows
- site-specific shell presets
- navigation controls and app menu improvements
- stronger generated app defaults for auth-heavy products
- documentation and example gallery

Open an issue or send a PR if you want to improve:

- generated project quality
- packaging workflows
- metadata extraction
- platform polish
- docs and onboarding

## Roadmap

Short-term areas worth improving:

- Windows installer output
- Linux AppImage or deb packaging helpers
- optional multi-window support
- optional app menu presets
- custom shell themes
- domain-specific presets for chat, mail, docs, dashboards

## Open Source

This project is intentionally simple, inspectable, and hackable.

The goal is not to hide the generated app behind a black box. The goal is to give developers a clean starting point they can own.

## License

MIT
