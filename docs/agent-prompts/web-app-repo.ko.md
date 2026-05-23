# Web App Repo Prompt

현재 개발 중인 웹앱을 데스크톱 앱으로 뽑고 싶을 때, 아래 프롬프트를 그대로 복사해서 코딩 에이전트에게 넣으면 됩니다.

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
1. 필요하면 현재 웹앱 dev server를 띄우고 [WEB_APP_URL]이 실제로 열리는지 확인한다.
2. 아래 명령을 실행한다.
   npx -y appbun@latest [WEB_APP_URL] --name "[APP_NAME]" --out-dir ../appbun-output/[APP_SLUG] --titlebar [system|unified|compact|minimal] --width [WIDTH] --height [HEIGHT] --theme-color [THEME_COLOR] --yes
   # If icon parsing fails, rerun the same command with --no-icon.
3. 생성된 wrapper 디렉터리로 이동한다.
   cd ../appbun-output/[APP_SLUG]
4. 의존성을 설치한다.
   bun install
5. 데스크톱 wrapper를 빌드한다.
   bun run build
6. macOS라면 일반 빌드가 성공하고 source repo가 백업된 뒤 DMG도 만든다.
   bun run build:dmg
7. 필요하면 wrapper를 다시 빌드하는 방법을 README에 짧게 적는다.

When you reply, include:
- what command you ran
- where the generated project was written
- what metadata or icons were detected
- what still needs manual attention, if anything
```
