# Showcase

These examples are public web apps that work without logging in first and wrap cleanly into desktop shells.

## Included examples

- GitHub
- YouTube
- YouTube Music
- Excalidraw
- Photopea
- Google Maps
- Google Translate
- Squoosh
- Desmos

## Refresh screenshots

```bash
bun install
bunx playwright install chromium
bun run showcase:capture
```

The script captures current public entry pages with Playwright and writes framed assets to `docs/screenshots/`.

## Refresh launch GIFs

```bash
node scripts/render-terminal-demo.mjs
```

The renderer writes the main README demo plus reusable launch clips to `docs/assets/`:

- `terminal-demo.gif`
- `url-to-code.gif`
- `code-to-dmg.gif`
- `agent-workflow.gif`
