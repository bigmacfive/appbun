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
- If the local URL is unclear but the dev server is already running, prefer `npx -y appbun@latest dev --name "[APP_NAME]" --out-dir ../appbun-output/[APP_SLUG] --yes`.
- appbun creates fallback icons when site icons are missing or broken; only use `--no-icon` when the user explicitly wants to skip icon generation.
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
4. Diagnose the generated project:
   npx -y appbun@latest doctor --project
5. Install dependencies and build the desktop wrapper:
   npx -y appbun@latest package --install
6. On macOS, also build the DMG only after the normal build succeeds and the source repo is backed up:
   npx -y appbun@latest package --dmg
7. For signed or notarized distribution, use `package --dmg --sign` or `package --notarize` only when Apple signing/notary env vars are available.
8. If useful, add a short README note explaining how to rebuild the desktop wrapper.

When you reply, include:
- what command you ran
- where the generated project was written
- what metadata or icons were detected
- what still needs manual attention, if anything
```
