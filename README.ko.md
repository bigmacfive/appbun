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
- macOS에서 윈도우 chrome과 콘텐츠가 붙어 보이도록 통합 상단바 적용
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

스크립트나 CI에서 확인 프롬프트를 건너뛰려면:

```bash
appbun https://github.com --name "GitHub" --out-dir ./github --yes
```

## Showcase

Playwright로 공개 웹 엔트리 포인트를 캡처하고, 생성되는 shell 느낌에 맞춰 프레임한 예시입니다.

![appbun showcase](https://raw.githubusercontent.com/bigmacfive/appbun/main/docs/screenshots/showcase-grid.png)

### 예시 대상

| 앱 | URL | 명령 |
| --- | --- | --- |
| ChatGPT | `https://chat.openai.com` | `appbun https://chat.openai.com --name "ChatGPT" --dmg` |
| GitHub | `https://github.com` | `appbun https://github.com --name "GitHub" --dmg` |
| Notion | `https://www.notion.so` | `appbun https://www.notion.so --name "Notion" --dmg` |
| Figma | `https://www.figma.com` | `appbun https://www.figma.com --name "Figma" --dmg` |
| Linear | `https://linear.app` | `appbun https://linear.app --name "Linear" --dmg` |
| Telegram | `https://web.telegram.org/k` | `appbun https://web.telegram.org/k --name "Telegram" --dmg` |

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

생성 앱은 다음을 사용합니다.

- `hiddenInset` traffic lights
- `UnifiedTitleAndToolbar`
- 떠 있는 가짜 헤더 대신 전체 폭 로컬 title area
- 설치형 배포를 위한 `build:dmg`

### Windows 와 Linux

생성된 Electrobun 프로젝트는 이미 빌드 가능합니다. 현재 `appbun`은 우선 macOS 설치 자동화에 집중하고 있고, Windows/Linux 패키징 helper는 로드맵에 있습니다.

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
