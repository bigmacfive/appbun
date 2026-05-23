# Web App Repo Prompt

Copy the prompt below into your coding agent when you want it to turn the web app you are currently building into a desktop app.

```text
You are working inside the repository of an existing web app.

Create a desktop app wrapper for this app using `appbun`.

Inputs you must fill in before running:
- Web app URL to package: [WEB_APP_URL]
- App name: [APP_NAME]
- Desktop wrapper output directory: ../appbun-output/[APP_SLUG]
- Window size: [WIDTH]x[HEIGHT]
- Titlebar preset: [system|unified|compact|minimal]
- Theme color: [THEME_COLOR]

Rules:
- Treat the current repository as the source web app project.
- Use `appbun@latest`; do not hand-roll the wrapper unless appbun output needs a specific fix.
- Prefer a dedicated output directory outside this source repo, such as ../appbun-output/[APP_SLUG].
- If the wrapper must live inside this repo, commit or back up the source app before installing or building it.
- If the URL points to a local dev server, make sure the dev server is running and reachable before packaging.
- If local favicon or manifest icons fail during scaffolding, rerun with `--no-icon` and add icons manually later.
- Keep the generated project inspectable and editable.
- Preserve site branding and icon metadata when available.
- If the output directory already exists, prefer a safe non-destructive path or explicit confirmation.
- Run create, install, build, and DMG packaging as separate steps.

Execution plan:
1. If needed, start the current web app and verify [WEB_APP_URL] loads.
2. Run:
   npx -y appbun@latest [WEB_APP_URL] --name "[APP_NAME]" --out-dir ../appbun-output/[APP_SLUG] --titlebar [system|unified|compact|minimal] --width [WIDTH] --height [HEIGHT] --theme-color [THEME_COLOR] --yes
   # If icon parsing fails, rerun the same command with --no-icon.
3. Change into the generated wrapper directory:
   cd ../appbun-output/[APP_SLUG]
4. Install dependencies:
   bun install
5. Build the desktop wrapper:
   bun run build
6. On macOS, also build the DMG only after the normal build succeeds and the source repo is backed up:
   bun run build:dmg
7. If useful, add a short README note explaining how to rebuild the desktop wrapper.

When you reply, include:
- what command you ran
- where the generated project was written
- what metadata or icons were detected
- what still needs manual attention, if anything
```
