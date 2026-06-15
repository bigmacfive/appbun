# appbun

[English](./README.md) | **한국어**

[![npm version](https://img.shields.io/npm/v/appbun?color=cb3837&logo=npm)](https://www.npmjs.com/package/appbun)
[![npm downloads](https://img.shields.io/npm/dm/appbun?color=111827&logo=npm)](https://www.npmjs.com/package/appbun)
[![CI](https://img.shields.io/github/actions/workflow/status/bigmacfive/appbun/ci.yml?branch=main&label=ci)](https://github.com/bigmacfive/appbun/actions/workflows/ci.yml)
[![Last commit](https://img.shields.io/github/last-commit/bigmacfive/appbun)](https://github.com/bigmacfive/appbun/commits/main)
[![License](https://img.shields.io/github/license/bigmacfive/appbun)](./LICENSE)

어떤 웹앱이든 읽고 고칠 수 있는 데스크톱 앱과 DMG로 바꿉니다. 블랙박스 wrapper가 아닙니다.

```bash
npx -y appbun@latest https://github.com --name "GitHub" --dmg
```

`appbun`은 정체를 알 수 없는 바이너리 하나를 던져주지 않습니다. 읽고 고칠 수 있는 [Electrobun](https://electrobun.dev) 프로젝트, 아이콘, native-runner 빌드 스크립트, macOS DMG 패키징, 에이전트용 지침까지 함께 만들어줍니다.

![appbun terminal demo](https://raw.githubusercontent.com/bigmacfive/appbun/main/docs/assets/terminal-demo.gif)

## Codex 또는 Claude Code에 바로 주기

Codex는 localhost 앱을 DMG까지 만들 수 있습니다:

```text
Use appbun to package my running web app at http://localhost:3000 as an inspectable desktop app.
Create it in ./desktop/my-app, run the generated project doctor, install dependencies, and build a macOS DMG if this machine supports it.
```

에이전트가 더 자연스럽게 appbun을 쓰게 하려면:

```bash
npx -y appbun@latest skill --install
npx -y appbun@latest skill --install-claude --cwd .
npx -y appbun@latest mcp
```

## 무엇을 얻나

| 원하는 것 | 명령 | 결과 |
| --- | --- | --- |
| 공개 사이트 앱으로 만들기 | `appbun https://example.com --name Example` | 수정 가능한 데스크톱 wrapper 프로젝트 |
| 로컬 프론트엔드 앱으로 만들기 | `appbun dev --name "My App"` | 흔한 localhost 포트 자동 감지 |
| 생성과 패키징 한 번에 하기 | `appbun https://example.com --name Example --dmg` | 프로젝트와 비서명 macOS DMG |
| 개인용 macOS installer 만들기 | `appbun package --dmg` | 생성 프로젝트 안에서 비서명 로컬 DMG 생성 |
| 서명 배포 준비 | `appbun package --dmg --sign` | `APPLE_SIGN_IDENTITY` 필요 |
| 노터라이즈 배포 준비 | `appbun package --notarize` | Apple notary 환경변수 사용 |
| 에이전트에게 맡기기 | `appbun skill --install-claude --cwd .` | Claude Code용 가이드 설치 |
| 모든 AI 에이전트에서 구동 | `appbun mcp` | create/recipes/discover를 노출하는 MCP 서버 |
| README에 배지 넣기 | `appbun badge <url>` | "Get the desktop app" 마크다운 배지 |
| 공유 카드 만들기 | `appbun showcase chatgpt` | README, Release, SNS용 마크다운 preview |

## 로컬 설치 없이 쓰는 세 가지 방법

터미널이 부담스러운 사용자를 위해:

- **🖼️ 갤러리 둘러보기** — 오픈 툴(Excalidraw, Photopea, Squoosh, Desmos)용 사전 빌드 macOS 앱을 바로 다운로드. [앱 갤러리](https://bigmacfive.github.io/appbun/) 참고.
- **🤖 온라인 빌드 요청** — URL을 담아 [Build a desktop app](https://github.com/bigmacfive/appbun/issues/new?template=build-app.yml) 이슈를 열면 GitHub Action이 `.dmg`를 만들어 다운로드 링크를 댓글로 남깁니다. 로컬 설치 불필요.
- **📣 만든 앱 공유** — [I built an app with appbun](https://github.com/bigmacfive/appbun/issues/new?template=submit-app.yml) 이슈를 열면 갤러리 workflow가 community card PR을 만듭니다.
- **⌨️ 한 줄 명령** — `npx -y appbun@latest <url> --name "My App" --dmg`.

갤러리/온라인 빌더의 다운로드는 **미서명**입니다. 첫 실행 시 **시스템 설정 → 개인정보 보호 및 보안 → 확인 없이 열기**를 사용하세요.

## 60초 경로

실행 중인 로컬 앱을 패키징:

```bash
cd your-web-app
npm run dev
npx -y appbun@latest dev --name "My App" --out-dir ../appbun-output/my-app --yes
cd ../appbun-output/my-app
npx -y appbun@latest doctor --project
npx -y appbun@latest package --install
```

macOS에서 DMG 만들기:

```bash
npx -y appbun@latest package --dmg
```

생성된 프로젝트는 평범한 코드입니다. 열어보고, shell을 고치고, 커밋하고, CI에 올리고, 다른 개발자에게 넘길 수 있습니다.

이 경로는 `appbun@latest` 기준으로 스모크 테스트합니다: 공개 URL scaffold, `appbun.generated.json` 확인, 의존성 설치, Electrobun 앱 빌드, 비서명 macOS DMG 생성.

## 왜 다른가

많은 URL-to-app 도구는 가장 짧은 데모에 집중합니다. `appbun`은 다음 날에도 계속 다룰 수 있는 결과물에 집중합니다.

- **읽을 수 있는 출력**: 막힌 wrapper가 아니라 일반 Electrobun 프로젝트.
- **쓸 만한 기본값**: 메타데이터, 테마 색상, 아이콘, fallback icon, 로컬 shell, loading/error 상태.
- **개인 앱 친화적**: 내 맥에서 쓸 DMG까지 한 번에 갈 수 있음.
- **정직한 릴리스 경로**: macOS, Windows, Linux native-runner 스크립트 제공. 가짜 cross-compile 약속 없음.
- **에이전트 친화적**: Codex skill, Claude Code `CLAUDE.md`, 복붙용 prompt 제공.
- **복구 가능**: `doctor`가 환경과 생성 프로젝트를 모두 진단.

## 설치

```bash
bun add -g appbun
```

```bash
npm install -g appbun
```

설치 없이 바로 실행:

```bash
npx -y appbun@latest chatgpt --dmg
```

`appbun`은 Bun이 있으면 Bun을 우선 사용합니다. Bun이 없으면 `--package-manager`로 강제하지 않는 한 npm으로 폴백할 수 있습니다.

## AI 에이전트에서 사용 (MCP)

`appbun`은 Model Context Protocol 서버를 내장해, MCP를 지원하는 클라이언트(Claude Desktop, Cursor, Codex 등)에서 데스크톱 앱을 바로 스캐폴드할 수 있습니다. 클라이언트 설정에 추가하세요:

```json
{
  "mcpServers": {
    "appbun": { "command": "npx", "args": ["-y", "appbun@latest", "mcp"] }
  }
}
```

세 가지 툴을 노출합니다: `appbun_create`(URL/레시피로 프로젝트 생성), `appbun_recipes`(내장 앱 목록), `appbun_discover`(개념 검색). 자체 가이드를 선호하면 `appbun skill --install-claude --cwd .`로 저장소에 `CLAUDE.md`를 추가하세요.

## 핵심 명령

### 생성

```bash
appbun https://linear.app --name "Linear Desktop"
appbun chatgpt --dmg
appbun github --titlebar compact
appbun create https://calendar.google.com --name Calendar --width 1600 --height 1000
```

### 탐색

```bash
appbun recipes
appbun recipes --concept music
appbun discover design
appbun discover gcal
```

### 진단

```bash
appbun doctor
appbun doctor --target macos
appbun doctor --project
appbun doctor --project ../appbun-output/my-app --json
```

### 패키징

생성된 appbun 프로젝트 안에서 실행하거나 `--cwd`를 넘기면 됩니다.

```bash
appbun package
appbun package --install
appbun package --dmg
appbun package --dmg --sign
appbun package --notarize
```

### 공유

```bash
appbun badge https://example.com --name "Example"
appbun showcase chatgpt
```

생성된 README에는 **Built with appbun** 배지와 이 앱을 다시 만드는 명령이 자동으로 들어갑니다. 짧은 배지는 `appbun badge <url>`, 이미지와 명령이 포함된 공유 카드는 `appbun showcase <recipe|url>`을 쓰면 됩니다.

## macOS DMG, 서명, 노터라이즈

개인용 로컬 DMG:

```bash
appbun package --dmg
```

signed DMG:

```bash
APPLE_SIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)" \
appbun package --dmg --sign
```

notarized DMG:

```bash
APPLE_SIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)" \
APPLE_ID="you@example.com" \
APPLE_TEAM_ID="TEAMID" \
APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx" \
appbun package --notarize
```

비서명 DMG는 개인 사용과 내부 확인에 좋습니다. 공개 macOS 배포는 보통 서명과 노터라이즈가 필요합니다.

## 에이전트 워크플로우

Codex skill 설치:

```bash
appbun skill --install
```

Codex에서 사용:

```text
$appbun-web-desktop package my local web app at http://localhost:3000 as a desktop app
```

Claude Code 지침 설치:

```bash
appbun skill --install-claude --cwd .
```

그러면 프로젝트에 `CLAUDE.md`가 생기고 Claude가 자연스럽게 다음 흐름을 사용합니다:

- `appbun dev`
- `appbun doctor --project`
- `appbun package --install`
- `appbun package --dmg`

다른 에이전트용 일회성 프롬프트가 필요하면:

```bash
appbun prompt http://localhost:3000 --name "My App"
```

정적 prompt 템플릿:

- [docs/agent-prompts/web-app-repo.md](docs/agent-prompts/web-app-repo.md)
- [docs/agent-prompts/web-app-repo.ko.md](docs/agent-prompts/web-app-repo.ko.md)

## 생성되는 프로젝트

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

포함되는 것:

- `appbun.generated.json`에 source URL과 generator metadata 기록
- 사이트 기반 또는 fallback icon 자산
- loading/error 상태가 있는 로컬 webview shell
- macOS titlebar preset
- native-runner 빌드 스크립트
- GitHub Actions release workflow

## Window Chrome Presets

| 프리셋 | 어울리는 경우 | macOS 동작 |
| --- | --- | --- |
| `system` | 가장 네이티브한 창 | 기본 시스템 title bar |
| `unified` | 균형 잡힌 기본값 | hidden inset traffic lights + 로컬 toolbar |
| `compact` | 콘텐츠가 중요한 앱 | 더 낮은 unified toolbar |
| `minimal` | 방해가 적은 wrapper | 더 가벼운 metadata와 border |

Windows와 Linux는 현재 표준 native title bar를 사용합니다.

## Showcase

로그인 없이 열리는 공개 대상들을 Playwright로 캡처한 예시입니다.

![appbun showcase](https://raw.githubusercontent.com/bigmacfive/appbun/main/docs/screenshots/showcase-grid.png)

| 앱 | 명령 |
| --- | --- |
| GitHub | `appbun github --dmg` |
| YouTube | `appbun https://www.youtube.com --name "YouTube" --dmg` |
| Excalidraw | `appbun https://excalidraw.com --name "Excalidraw" --dmg` |
| Photopea | `appbun https://www.photopea.com --name "Photopea" --dmg` |
| Squoosh | `appbun https://squoosh.app --name "Squoosh" --dmg` |

더 많은 예시: [docs/showcase/README.md](docs/showcase/README.md)

## 문제 해결

### Bun이 설치되어 있지 않을 때

npm을 사용하세요:

```bash
appbun https://example.com --package-manager npm
```

### 생성 프로젝트가 이상해 보일 때

실행:

```bash
appbun doctor --project
```

### macOS 앱이 첫 실행에 열리지 않을 때

일부 로컬 Electrobun macOS 빌드는 첫 실행 때 launcher 권한 프롬프트가 한 번 뜰 수 있습니다.

1. Applications 폴더를 엽니다.
2. 앱을 우클릭하고 `Open`을 선택합니다.
3. macOS launcher 프롬프트가 뜨면 허용합니다.

## 개발

```bash
bun install
bun run check
bun run test
bun run build
npm pack --dry-run
```

showcase 자산 갱신:

```bash
bunx playwright install chromium
bun run showcase:capture
```

## 기여

[CONTRIBUTING.md](CONTRIBUTING.md)와 [Pake-grade goal](docs/pake-grade-goal.md)부터 읽어주세요.

가치가 큰 영역:

- Windows installer helper
- Linux packaging helper
- 더 안정적인 site metadata와 icon heuristic
- 인증이 많은 웹앱 recipe
- 생성 shell UX 개선
