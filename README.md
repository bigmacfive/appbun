# appbun

`appbun` turns any web app URL into a desktop wrapper powered by [Electrobun](https://electrobun.dev). It is the same basic idea as Pake, but the generated app targets Electrobun instead of Tauri.

## What it does

- Fetches metadata from the target site
- Derives a sensible app name, description, identifier, and theme color
- Pulls favicon, apple-touch-icon, and manifest icons from the target site when available
- Generates an Electrobun shell that wraps the remote URL in an embedded webview
- Uses a unified shell header so macOS traffic lights feel integrated with the app content
- Adds a macOS `build:dmg` flow that opens with the familiar drag-to-Applications installer window
- Produces a project that is ready for `bun install`, `npm install`, and `electrobun build`

## Install

```bash
npm install -g appbun
```

```bash
bun add -g appbun
```

## Usage

```bash
appbun https://linear.app --name "Linear Desktop"
```

```bash
appbun create https://calendar.google.com \
  --name "Calendar" \
  --out-dir ./calendar-app \
  --theme-color '#1a73e8' \
  --width 1600 \
  --height 1000
```

## Generated project

The generated project includes:

- `src/bun/index.ts`: the Electrobun window entrypoint
- `src/mainview/`: the local shell header plus embedded `electrobun-webview`
- `electrobun.config.ts`: metadata and packaging configuration
- `assets/icon.png`, `assets/icon.ico`
- `icon.iconset/`: a macOS iconset derived from the site icon when available

## Local development

```bash
bun install
bun run check
bun test
bun run build
```

## Publishing

Both npm and Bun install from the npm registry. In practice, one successful registry publish is enough for both of these commands to work:

```bash
npm install -g appbun
bun add -g appbun
```

Release checks:

```bash
bun run release:check
```

Actual publish commands:

```bash
npm publish --access public
```

```bash
bun publish --access public
```

`bun publish --dry-run` currently still expects registry auth, so `release:check` uses `npm pack --dry-run` as the anonymous verification step. Do not run both publish commands for the same version; they publish to the same npm registry entry.
