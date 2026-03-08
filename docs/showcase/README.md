# Showcase

These examples are current public web entry points that wrap cleanly into desktop shells.

## Included examples

- ChatGPT
- GitHub
- Notion
- Figma
- Linear
- Telegram

## Refresh screenshots

```bash
bun install
bunx playwright install chromium
bun run showcase:capture
```

The script captures current public entry pages with Playwright and writes framed assets to `docs/screenshots/`.
