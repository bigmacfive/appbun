# appbun

[English](./README.md) | **한국어**

[![npm version](https://img.shields.io/npm/v/appbun?color=cb3837&logo=npm)](https://www.npmjs.com/package/appbun)
[![npm downloads](https://img.shields.io/npm/dm/appbun?color=111827&logo=npm)](https://www.npmjs.com/package/appbun)
[![CI](https://img.shields.io/github/actions/workflow/status/bigmacfive/appbun/ci.yml?branch=main&label=ci)](https://github.com/bigmacfive/appbun/actions/workflows/ci.yml)
[![Last commit](https://img.shields.io/github/last-commit/bigmacfive/appbun)](https://github.com/bigmacfive/appbun/commits/main)
[![Closed issues](https://img.shields.io/github/issues-closed/bigmacfive/appbun)](https://github.com/bigmacfive/appbun/issues?q=is%3Aissue+is%3Aclosed)
[![License](https://img.shields.io/github/license/bigmacfive/appbun)](./LICENSE)

한 줄 명령으로 아무 웹페이지나 데스크톱 앱으로 바꿉니다. `appbun`은 URL 하나를 [Electrobun](https://electrobun.dev) 프로젝트로 감싸고, 사이트 메타데이터에서 쓸 만한 아이콘을 가져오고, macOS 설치 흐름까지 이어지도록 패키징 경로를 잡아줍니다.

macOS, Windows, Linux를 지원합니다.

![appbun social card](https://raw.githubusercontent.com/bigmacfive/appbun/main/docs/assets/social-card.png)

## 왜 appbun인가

`appbun`은 사람들이 Pake를 찾는 이유와 같은 문제를 다룹니다. `URL -> desktop app` 흐름이 빠르고 유용하기 때문입니다.

차이는 결과물입니다.

`appbun`은 결과를 블랙박스로 숨기지 않습니다. 대신 직접 읽고, 수정하고, 버전 관리하고, 배포할 수 있는 일반적인 Electrobun 프로젝트를 만들어줍니다.

처리해 주는 것:

- title, description, theme color, favicon, apple-touch-icon, manifest icon 수집
- 깨진 응답이나 저품질 raster 아이콘을 패키징 전에 걸러냄
- 대상 URL을 감싸는 로컬 Electrobun shell 생성
- macOS에서 자주 쓰는 윈도우 chrome 패턴을 프리셋으로 고를 수 있게 생성
- macOS용 DMG 흐름 포함, 나머지 플랫폼도 빌드 가능한 출력 제공
- interactive 터미널에서는 파괴적이거나 무거운 작업 전에 확인 프롬프트 표시, 자동 승인은 `--yes`

## 설치

```bash
bun add -g appbun
```

```bash
npm install -g appbun
```

npm 글로벌 prefix 권한이 막혀 있으면 `bun add -g appbun`을 쓰거나 `npx appbun@latest ...`로 실행하면 됩니다.

로컬 머신에 Bun이 있으면 `appbun`은 Bun을 우선 쓰고, Bun이 없으면 `--package-manager`를 강제로 주지 않는 한 npm으로 자동 폴백합니다.

## 빠른 시작

```bash
appbun https://chat.openai.com --name "ChatGPT" --dmg
```

이 한 줄로 프로젝트 생성, 의존성 설치, 앱 빌드, macOS DMG 생성, 설치 창 열기까지 이어집니다.

바로 빌드하지 않고 생성된 프로젝트만 받고 싶다면:

```bash
appbun https://linear.app --name "Linear Desktop"
cd linear-desktop
bun install
bun run build
```

처음부터 더 타이트한 macOS 상단바를 쓰고 싶다면:

```bash
appbun https://chat.openai.com --name "ChatGPT" --titlebar compact --dmg
```

## CLI 예시

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

```bash
appbun https://github.com --name "GitHub" --titlebar system
```

스크립트나 CI에서 확인 프롬프트를 건너뛰려면:

```bash
appbun https://github.com --name "GitHub" --out-dir ./github --yes
```

개발 중인 웹서비스를 에이전트가 바로 데스크톱 앱으로 빼게 하고 싶다면, 아래 정적 프롬프트를 복붙하면 됩니다:

- [docs/agent-prompts/web-app-repo.ko.md](docs/agent-prompts/web-app-repo.ko.md)

특정 로컬 URL 기준으로 `appbun`이 프롬프트를 미리 채워주게 하려면:

```bash
appbun prompt http://localhost:3000 --name "My App"
```

그러면 에이전트가 현재 웹앱을 `./desktop/my-app` 아래에 `appbun@latest`로 패키징하고 빌드하게 만드는 지시문이 출력됩니다.

## 윈도우 chrome 프리셋

이제 `appbun`은 생성되는 macOS 상단바를 한 가지 스타일로 고정하지 않고, 사용자가 프리셋으로 고를 수 있게 만들었습니다.

| 프리셋 | 어울리는 경우 | macOS 동작 |
| --- | --- | --- |
| `system` | 가장 네이티브한 창이 좋을 때 | 기본 시스템 title bar, 로컬 shell header 없음 |
| `unified` | 기본값, 가장 균형 잡힌 wrapper | hidden inset traffic lights + 연결된 로컬 toolbar |
| `compact` | 콘텐츠가 우선인 앱 | 같은 패턴이지만 더 낮고 더 조밀함 |
| `minimal` | 시각적 chrome을 덜 보이고 싶을 때 | 같은 패턴이지만 메타데이터를 줄이고 경계를 약하게 표현 |

Windows와 Linux에서는 현재 표준 네이티브 title bar로 폴백합니다.

옵션 전체를 빨리 보려면:

```bash
appbun create --help
```

## 트러블슈팅

### Bun이 설치되어 있지 않을 때

이제 `appbun`은 Bun이 없는 머신에서는 생성 프로젝트와 설치/빌드 흐름에서 자동으로 npm으로 폴백합니다. 그래도 명시적으로 고르고 싶다면:

```bash
appbun https://example.com --package-manager npm
```

### macOS 앱이 첫 실행에 열리지 않을 때

일부 로컬 Electrobun macOS 빌드는 첫 실행 때 launcher 권한 프롬프트가 한 번 뜰 수 있습니다. 설치한 앱이 Finder나 Dock에서 바로 열리지 않으면:

1. Applications 폴더에서 앱을 찾는다.
2. 앱을 우클릭해서 `Open`을 한 번 선택한다.
3. macOS가 launcher 프롬프트를 띄우면 허용한다.

첫 실행이 한 번 통과되면 이후에는 정상적으로 열려야 합니다.

## Showcase

로그인 없이 바로 동작하는 공개 웹앱을 Playwright로 캡처하고, 생성되는 shell 느낌에 맞춰 프레임한 예시입니다.

![appbun showcase](https://raw.githubusercontent.com/bigmacfive/appbun/main/docs/screenshots/showcase-grid.png)

### 예시 대상

| 앱 | URL | 명령 |
| --- | --- | --- |
| GitHub | `https://github.com` | `appbun https://github.com --name "GitHub" --dmg` |
| YouTube | `https://www.youtube.com` | `appbun https://www.youtube.com --name "YouTube" --dmg` |
| YouTube Music | `https://music.youtube.com` | `appbun https://music.youtube.com --name "YouTube Music" --dmg` |
| Excalidraw | `https://excalidraw.com` | `appbun https://excalidraw.com --name "Excalidraw" --dmg` |
| Photopea | `https://www.photopea.com` | `appbun https://www.photopea.com --name "Photopea" --dmg` |
| Google Maps | `https://www.google.com/maps` | `appbun https://www.google.com/maps --name "Google Maps" --dmg` |
| Google Translate | `https://translate.google.com` | `appbun https://translate.google.com --name "Google Translate" --dmg` |
| Squoosh | `https://squoosh.app` | `appbun https://squoosh.app --name "Squoosh" --dmg` |
| Desmos | `https://www.desmos.com/calculator` | `appbun https://www.desmos.com/calculator --name "Desmos" --dmg` |

자세한 내용은 [docs/showcase/README.md](./docs/showcase/README.md)에 있습니다.

## 생성되는 프로젝트 구조

```text
my-app/
├── assets/                 # 패키징용으로 정리된 아이콘 자산
├── icon.iconset/           # macOS iconset 크기들 (16~1024)
├── scripts/
│   └── create-dmg.mjs      # macOS DMG helper
├── src/
│   ├── bun/
│   │   └── index.ts        # Electrobun window entrypoint
│   └── mainview/
│       ├── index.html      # 로컬 shell 마크업
│       ├── index.css       # 통합 title area 스타일
│       └── index.ts        # remote webview 부트스트랩
├── electrobun.config.ts
├── package.json
└── tsconfig.json
```

## 플랫폼 메모

### macOS

생성 앱은 다음 중 하나를 사용합니다.

- `--titlebar system`일 때 기본 시스템 title bar
- `--titlebar unified`, `compact`, `minimal`일 때 `hiddenInset` traffic lights
- 연결형 프리셋에서 `UnifiedTitleAndToolbar` + `FullSizeContentView`
- 고정된 가짜 헤더 하나가 아니라 선택한 프리셋에 맞는 로컬 title area
- 설치형 배포를 위한 `build:dmg`

### Windows 와 Linux

생성된 Electrobun 프로젝트는 이미 빌드 가능합니다. 현재 `appbun`은 이 플랫폼들에서는 표준 네이티브 title bar를 유지하고, 우선 macOS 설치 자동화에 집중하고 있습니다. Windows/Linux 패키징 helper는 로드맵에 있습니다.

## 로컬 개발

```bash
bun install
bun run check
bun run test
bun run build
```

## showcase 자산 갱신

```bash
bunx playwright install chromium
bun run showcase:capture
```

이 명령은 다음을 갱신합니다.

- `docs/screenshots/*.png`
- `docs/assets/social-card.png`
- `docs/showcase/manifest.json`

## 릴리즈 점검

```bash
bun run release:check
```

## 기여

기여 기준은 단순합니다. 생성 앱 품질, 패키징 흐름, 문서를 개선하고, 재현 가능한 테스트나 샘플 scaffold로 증명하면 됩니다.

시작 지점:

- [CONTRIBUTING.md](./CONTRIBUTING.md)
- [Bug report template](./.github/ISSUE_TEMPLATE/bug_report.yml)
- [Feature request template](./.github/ISSUE_TEMPLATE/feature_request.yml)

가치가 큰 기여 영역:

- 사이트별 아이콘 선택 휴리스틱 개선
- Windows installer helper
- Linux packaging helper
- auth-heavy 웹앱 preset
- navigation control 과 app menu
- 문서, gallery, compatibility notes

## 포지셔닝

아래 같은 검색어를 찾고 있다면 이 프로젝트와 맞습니다.

- Electrobun용 Pake 대안
- Bun으로 웹사이트를 데스크톱 앱으로 만들기
- website to desktop app CLI
- URL을 macOS 앱으로 패키징하기
- web app wrapper에서 DMG 만들기
- Electrobun app generator
- macOS, Windows, Linux용 website wrapper

## 라이선스

MIT
