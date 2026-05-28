# Spec: Native Application Menu & Standard Keyboard Shortcuts

| | |
|---|---|
| **Status** | Ready (open questions resolved 2026-05-28) |
| **Date** | 2026-05-28 |
| **Owner** | @laeyoung |
| **Target release** | appbun `0.10.5` (patch, current is `0.10.4`) |
| **Scope** | Generator template only — no new CLI flags |

## 1. Background

`appbun`이 생성한 macOS DMG 앱을 실제로 사용해 보면, 텍스트 입력 필드에서 다음 표준 단축키가 동작하지 않는다:

- `Cmd+C` / `Cmd+V` / `Cmd+X` (Copy / Paste / Cut)
- `Cmd+A` (Select All)
- `Cmd+Z` / `Cmd+Shift+Z` (Undo / Redo)
- `Cmd+Q` (Quit)

우클릭 컨텍스트 메뉴를 열어도 Cut/Copy가 회색 처리되어 있다 (텍스트 선택이 되어 있어도). 이는 데스크탑 앱으로서 치명적인 사용성 결함이며 `docs/pake-grade-goal.md`의 "instant, inspectable, and **reliable**" 제품 바를 위반한다.

## 2. Root Cause

생성된 `src/bun/index.ts` (템플릿 위치: `src/lib/templates/shell.ts` → `generatedBunEntry()`)는 `BrowserWindow`만 생성하고 애플리케이션 메뉴를 전혀 설치하지 않는다.

macOS에서 `Cmd+C` 등의 표준 단축키가 포커스된 `WKWebView`까지 도달하려면, `NSMenu`의 Edit 메뉴 항목이 표준 셀렉터(`copy:` / `paste:` / `cut:` / `selectAll:` / `undo:` / `redo:`)로 First Responder 체인에 연결돼 있어야 한다. 메뉴 자체가 없으니 키 이벤트가 라우팅되지 않고, WebKit의 컨텍스트 메뉴도 셀렉터에 호응하는 First Responder가 없다고 판단해 항목을 비활성화한다.

Electrobun 1.18.1은 이 문제를 위한 정식 API `ApplicationMenu.setApplicationMenu(...)`를 제공한다. `role`을 지정한 메뉴 항목은 OS가 표준 단축키를 자동 바인딩한다. 따라서 **빌트인 role만 등록해도 표준 단축키 전체가 해결**된다.

## 3. Goals

1. `appbun create ...`로 생성된 모든 macOS 앱이 빌드 직후부터 표준 클립보드/편집/창 단축키를 갖춘다.
2. CLI 플래그를 추가하지 않는다 — 생성물 품질을 올리는 방향 (CLAUDE.md 원칙).
3. Windows/Linux 빌드를 깨뜨리지 않는다.
4. 변경이 CI(`ci.yml` + `scaffold-smoke.yml`)에서 보호된다.

## 4. Non-Goals

- 커스텀 키보드 단축키를 사용자가 설정할 수 있게 하는 기능.
- Recipe 단위로 메뉴를 커스터마이즈하는 기능.
- 윈도우/리눅스용 네이티브 메뉴의 풀 커스터마이즈 (1차에서는 기본 동작 유지).
- 트레이/메뉴바 아이콘.

## 5. Reproduction

```bash
node ./bin/appbun.js https://example.com -o /tmp/appbun-repro --install
cd /tmp/appbun-repro && bun run build:dmg
open build/*.dmg
```

설치 후 입력 가능한 페이지(예: https://duckduckgo.com)를 열고 텍스트를 선택, `Cmd+C` 시도 — 클립보드에 복사되지 않음. 우클릭하면 Cut/Copy 항목이 비활성화 상태.

## 6. Proposed Solution

### 6.1 메뉴 구조

생성된 `src/bun/index.ts`에 다음 메뉴를 설치한다.

| 메뉴 | 항목 | 비고 |
|---|---|---|
| **App** (label 비움 → macOS가 앱 이름으로 채움) | `hide`, `hideOthers`, `showAll`, separator, `quit` | `Cmd+H`, `Cmd+Opt+H`, `Cmd+Q` 자동. `about`은 Electrobun 지원 role 아님 → 제외 (§10 D3). |
| **Edit** | `undo`, `redo`, separator, `cut`, `copy`, `paste`, `pasteAndMatchStyle`, `delete`, `selectAll` | `Cmd+Z`, `Cmd+Shift+Z`, `Cmd+X/C/V`, `Cmd+Shift+Opt+V`, `Cmd+A` 자동 |
| **View** | `Reload` (커스텀 action, accelerator `r`), `toggleFullScreen` | `Cmd+R`, `Cmd+Ctrl+F`. `minimize`/`zoom`은 macOS HIG에 따라 Window 메뉴에만 둬서 중복 바인딩을 피한다. |
| **Window** | `minimize`, `zoom`, separator, `bringAllToFront` | 표준 macOS Window 메뉴. `front`이 아닌 `bringAllToFront`가 올바른 role 이름. |

> `Cmd+R`은 Electrobun에 `reload` role이 없으므로(§10 D1) `{ label: "Reload", action: "reload-app", accelerator: "r" }`로 등록하고 `Electrobun.events.on("application-menu-clicked", ...)`에서 처리. 핸들러 동작은 §10 D2 참고 — **`mainWindow.webview`는 shell(`views://mainview/index.html`)을 가리키며, 실제 원격 페이지는 그 shell 안의 `<electrobun-webview id="remote-app">` 자식**이다. 그래서 핸들러는 `mainWindow.webview.executeJavascript("document.getElementById('remote-app')?.reload()")`로 *자식 webview 태그의 reload 메서드*를 호출한다(공식 문서에 `<electrobun-webview>`의 `reload` 메서드 명시).

**Trade-off — Cmd+R 인터셉트:** 네이티브 메뉴 accelerator는 페이지보다 먼저 키 이벤트를 가져간다. Linear, Notion 등 일부 웹앱이 Cmd+R을 내부 단축키로 쓰는 경우(예: Linear "Create new") 그 바인딩이 silent하게 동작 안 한다. 일반 사용자 기대치(브라우저 리로드)가 더 보편적이라고 판단해 1차 PR에서는 인터셉트를 수용. 후속에서 recipe별 opt-out 또는 메뉴에서 Reload 제거 옵션 검토.

### 6.2 플랫폼 가드

Electrobun 공식 문서에 따르면 `ApplicationMenu`는 **macOS만 완전 지원**, Windows는 단일 문자 accelerator만 지원, **Linux는 미지원**(§10 D5). 1차 PR에서는 `if (process.platform === "darwin")` 가드 안에서만 `ApplicationMenu.setApplicationMenu`를 호출한다. Windows 확장은 별도 후속 PR.

### 6.3 코드 예시 (참고용, 실제 구현은 §7에서 명세)

기존 `generatedBunEntry`는 이미 `const isMac = process.platform === "darwin"` (현 shell.ts:16)를 선언하고 있으므로 **새 코드는 그 변수를 재사용**한다. 재선언하면 TS `Cannot redeclare` 에러.

**TS 컴파일 호환성:** 생성된 `tsconfig.json`(`project.ts:145-158`의 `generatedTsconfig()`)에 현재 `esModuleInterop`이 없다. Electrobun의 default export(`Electrobun`)를 사용하려면 §7에서 `generatedTsconfig()`에 `"esModuleInterop": true`를 추가해야 한다. (또는 default import 대신 Electrobun이 named export로 노출하는 events 객체를 발견하면 default import를 회피 — 1차 PR에서는 공식 문서 예제와 동일하게 default import + esModuleInterop 추가 채택.)

```ts
// import 라인에 ApplicationMenu와 Electrobun(default) 추가
import Electrobun, { BrowserWindow, ApplicationMenu } from "electrobun/bun";

const isMac = process.platform === "darwin";   // 기존 라인 — 재사용
let menuHandlerRegistered = false;             // 모듈 스코프 boolean 가드 (§10 D6)
const mainWindow = new BrowserWindow({ /* 기존 옵션 */ });

if (isMac) {
  ApplicationMenu.setApplicationMenu([
    { submenu: [
      { role: "hide" }, { role: "hideOthers" }, { role: "showAll" },
      { type: "separator" }, { role: "quit" },
    ]},
    { label: "Edit", submenu: [
      { role: "undo" }, { role: "redo" }, { type: "separator" },
      { role: "cut" }, { role: "copy" }, { role: "paste" },
      { role: "pasteAndMatchStyle" }, { role: "delete" }, { role: "selectAll" },
    ]},
    { label: "View", submenu: [
      { label: "Reload", action: "reload-app", accelerator: "r" },
      { role: "toggleFullScreen" },
    ]},
    { label: "Window", submenu: [
      { role: "minimize" }, { role: "zoom" },
      { type: "separator" },
      { role: "bringAllToFront" },
    ]},
  ]);

  // 핸들러 타입은 Electrobun이 application-menu-clicked 이벤트 타입을 export하면
  // 그걸 사용하고, 없으면 아래 인라인 shape로 폴백.
  const handleMenuClick = (e: { data: { action?: string } }) => {
    if (e.data.action === "reload-app") {
      // mainWindow.webview는 shell. 실제 원격 페이지는 그 안의
      // <electrobun-webview id="remote-app">. 자식 webview 태그의 reload 호출.
      mainWindow.webview.executeJavascript(
        "document.getElementById('remote-app')?.reload()"
      );
    }
  };

  // 동일 모듈 인스턴스 수명 내 중복 등록 방지(§10 D6 부분 완화).
  // bun dev --watch 핫리로드 시 모듈 재실행으로 인한 누적은 알려진 한계.
  if (!menuHandlerRegistered) {
    Electrobun.events.on("application-menu-clicked", handleMenuClick);
    menuHandlerRegistered = true;
  }
}
```

## 7. File-Level Changes

| 파일 | 변경 내용 |
|---|---|
| `src/lib/templates/shell.ts` | `generatedBunEntry()`에서: ① 템플릿 리터럴 내부 import 라인을 `import { BrowserWindow } from "electrobun/bun"` → `import Electrobun, { BrowserWindow, ApplicationMenu } from "electrobun/bun"`으로 교체. ② 기존 `isMac` 변수를 재사용해 `if (isMac)` 가드 안에 `ApplicationMenu.setApplicationMenu(...)` 호출 + `reload-app` 핸들러 추가. ③ 모듈 스코프 boolean 가드(§10 D6)로 핸들러 중복 등록 방지. ④ `executeJavascript` 결과가 Promise인지 구현 시 확인하여 필요하면 `.catch(() => {})` 첨부. |
| `src/lib/templates/project.ts` (`generatedTsconfig`) | `compilerOptions`에 `"esModuleInterop": true` 추가 (default import `import Electrobun ...` 호환). |
| `src/__tests__/generator.test.ts` | 생성된 `src/bun/index.ts`에 `ApplicationMenu.setApplicationMenu` 호출 + `process.platform === "darwin"` 가드 + Edit role(`"copy"`, `"paste"`, `"cut"`, `"selectAll"`) 문자열이 포함되는지 어설션 추가. 생성된 `tsconfig.json`에 `esModuleInterop: true`가 들어있는지도 어설션. |
| `.github/workflows/scaffold-smoke.yml` | 3개 grep 추가: `ApplicationMenu.setApplicationMenu`(호출 존재), `'process.platform === "darwin"'`(가드 존재), `'"copy"'`(Edit role 존재) — 부분 회귀 방지. |
| `CLAUDE.md` (top-level) | (a) scaffold 계약 설명에 신규 grep 3종 명시. (b) **워크플로 파일명 정정**: 현재 27행 / 36행이 `scaffold.yml`로 적혀 있으나 실제 파일은 `.github/workflows/scaffold-smoke.yml`이다. 두 곳 모두 `scaffold-smoke.yml`로 정정. |
| `skills/appbun-web-desktop/SKILL.md` | "Quality bar"에 "표준 macOS 단축키(Cmd+C/V/X/A/Z/Q)가 즉시 동작" 항목 추가. |
| `skills/appbun-web-desktop/CLAUDE.md` | 동일 문구 동기화. |
| `package.json` | `version` → `0.10.5` |
| GitHub release body | "Generated apps now ship a native macOS application menu, restoring Cmd+C/V/X/A/Z/Q and other standard shortcuts." (CHANGELOG.md 파일은 repo에 없음 — release note는 GitHub release로 게시.) |

## 8. Test Plan

### 8.1 자동 테스트
- `bun run check` — 타입 통과 (생성된 코드는 사용자 프로젝트에서 컴파일되므로, appbun 자체의 타입체크에는 영향 없음)
- `bun test src` — 새로 추가된 어설션 포함 통과
- `bun run release:check` — pack 검증 통과
- `scaffold-smoke.yml` 그린

### 8.2 수동 검증 (release 전 필수)
재현 경로(§5)와 동일하게 빌드 후 실제 DMG를 설치하고:

- [ ] 우클릭 → Cut/Copy 활성화
- [ ] 텍스트 선택 후 `Cmd+C` → 클립보드 복사 확인 (`pbpaste`로 더블체크)
- [ ] `Cmd+V` 붙여넣기, `Cmd+X` 잘라내기
- [ ] `Cmd+A` 전체 선택, `Cmd+Z` 되돌리기, `Cmd+Shift+Z` 다시 실행
- [ ] `Cmd+Q`로 앱 종료
- [ ] `Cmd+M` 최소화, `Cmd+Ctrl+F` 풀스크린
- [ ] `Cmd+R` → shell이 아니라 **shell 안의 `<electrobun-webview id="remote-app">` 자식 webview만 그 자리에서 리로드** (§10 D2 — `location.reload()`는 잘못된 접근, `document.getElementById('remote-app')?.reload()`가 정공법). 시각적으로 toolbar/메뉴바는 깜박이지 않아야 하며 원격 페이지만 새로고침.
- [ ] 툴바 `#reload-app` 버튼 → 기존 시맨틱(`src`를 `about:blank` → 현재 src 어트리뷰트로 재설정)으로 동작. Cmd+R과 의미가 다름을 §10 D2에서 명시.
- [ ] 한글 입력 IME 작동에 회귀 없음
- [ ] **메뉴바가 실제로 노출되는지 확인** — 앱 메뉴(첫 항목)가 앱 이름으로, Edit/View/Window 메뉴가 메뉴바에 표시. 단축키만 동작하고 메뉴바가 없으면 `setApplicationMenu` 호출이 silent fail한 것이며 WebKit 기본 키바인딩으로 인한 false positive 가능.
- [ ] App 메뉴를 클릭해서 Hide/Hide Others/Show All/Quit 항목이 보이는지
- [ ] Edit 메뉴를 클릭해서 Undo~Select All 8개 항목이 보이는지
- [ ] **알려진 한계 확인:** `bun dev --watch`로 5회 핫리로드 후 Cmd+R 1회 → reload가 N회 트리거되는지 카운트(§10 D6은 watch 모드 누적을 1차 PR에서 해결하지 못함 — N>1이어도 acceptance를 막지 않으나 follow-up 트래킹 대상). 프로덕션(빌드된 DMG)에서는 reload가 1회만 발생해야 함.

대표 recipes로도 1회 검증. **인증 불필요한 사이트 우선**(`appbun create https://duckduckgo.com` 또는 `appbun create wikipedia`)으로 텍스트 입력/단축키 기본 동작 확인. 인증 있는 앱(ChatGPT, Linear, Gmail)은 로그인 후 입력창에서 추가 회귀 확인 — 계정이 있는 경우 한정.

## 9. Rollout

1. `dev-docs/native-menu-shortcuts.md` (이 문서) 머지.
2. 위 §7 파일 변경을 한 PR로 묶어서 머지.
3. **퍼블리시 트리거**: `.github/workflows/publish.yml`이 `release: published` 이벤트(또는 `workflow_dispatch`)로 동작한다. GitHub에서 `v0.10.5` 태그로 Release를 *Publish*해야 npm publish가 실행된다. 직접 `npm publish` 또는 단순 tag push만으로는 발화하지 않는다. Release body에 §7 마지막 행의 노트를 적는다.
4. 퍼블리시 후 사용자 보고된 케이스(우클릭/단축키)가 재현 종료되는지 확인.
5. Windows/Linux 기본 메뉴 활성화 여부는 별도 이슈로 트래킹.

### 9.1 Rollback

`0.10.5` 퍼블리시 후 Windows/Linux 빌드 회귀 또는 macOS에서 예기치 못한 메뉴 동작이 보고되면:

1. `npm deprecate appbun@0.10.5 "regression in generated app menu — use 0.10.4"`로 즉시 deprecate.
   - **선결조건:** 로컬 npm 토큰이 `appbun` 패키지의 owner여야 한다. 사고 발생 *전에* `npm owner ls appbun`으로 권한 확인. publish.yml이 자동 토큰을 쓰는 경우, 메인테이너는 자신의 owner 자격으로 별도 `npm login`이 필요할 수 있음.
2. 다음 파일들을 한꺼번에 revert (계약 일치성 유지를 위해 부분 revert는 피함):
   - `src/lib/templates/shell.ts` — 메뉴 코드 자체 (필수)
   - `src/lib/templates/project.ts` — `esModuleInterop` 추가 (필수, default import가 사라지면 컴파일 에러)
   - `src/__tests__/generator.test.ts` — 신규 어설션 (필수, 어설션이 남으면 테스트 실패)
   - `.github/workflows/scaffold-smoke.yml` — 신규 grep 3종 (필수, 계약 일치)
   - `CLAUDE.md` (top-level) — 신규 grep 계약 설명 (필수). 단 `scaffold.yml → scaffold-smoke.yml` 파일명 정정은 **유지**(별개 정합성 수정).
   - `package.json` — `0.10.5` → `0.10.4` (또는 `0.10.6`로 forward fix 시 유지). 판단은 사후 사고 경위에 따라.
   - **유지(revert 제외):** `skills/appbun-web-desktop/SKILL.md`, `skills/appbun-web-desktop/CLAUDE.md` quality bar 문구 — 문서 표현이며 코드 회귀와 무관.
3. 회귀를 재현하는 테스트를 추가한 뒤 `0.10.6` 또는 `0.10.7`로 재퍼블리시.

## 10. Decisions (resolved 2026-05-28)

근거 출처: Electrobun 공식 문서 `docs/src/content/docs/electrobun/apis/application-menu.mdx`, `browser-view.mdx`, `llms.txt` (context7 인덱스 `/blackboardsh/electrobun`).

### D1. `reload` role은 존재하지 않는다
공식 지원 role 목록(인용 시점 2026-05-28 기준, 본 문서가 사용하는 role 한정으로 충분 — 전체 목록은 공식 문서 참고. `showHelp` 등 본 PR에서 미사용 role도 존재): `quit`, `hide`, `hideOthers`, `showAll`, `undo`, `redo`, `cut`, `copy`, `paste`, `pasteAndMatchStyle`, `delete`, `selectAll`, `startSpeaking`, `stopSpeaking`, `enterFullScreen`, `exitFullScreen`, `toggleFullScreen`, `minimize`, `zoom`, `bringAllToFront`, `close`, `cycleThroughWindows`. **`reload`는 없음.**

**결정:** Reload는 `{ label: "Reload", action: "reload-app", accelerator: "r" }`로 커스텀 등록.

### D2. Reload 핸들러: shell 안의 `<electrobun-webview>` 태그 `.reload()`를 invoke
**중요한 layering 사실:** `mainWindow.webview`는 Bun이 띄운 shell BrowserView(`views://mainview/index.html`)이며, **이 shell이 그 안에 `<electrobun-webview id="remote-app" src="https://...">` 자식 DOM 요소를 만들어 원격 페이지를 표시**한다(`shell.ts:357-371` `remoteApp = document.createElement("electrobun-webview")`).

따라서:
- 잘못된 접근: `mainWindow.webview.executeJavascript("location.reload()")` — shell의 `location`은 `views://mainview/index.html`이라 **shell 자체가 리로드**되어 원격 페이지가 깜박이며 다시 마운트된다(현 toolbar 버튼의 시맨틱과 비슷한 부작용).
- 올바른 접근: `mainWindow.webview.executeJavascript("document.getElementById('remote-app')?.reload()")` — 공식 문서가 `<electrobun-webview>` 태그(렌더러 측 DOM 요소)의 `reload` 메서드를 명시한다. 이 메서드를 호출하면 **자식 webview만 그 자리에서 reload**되어 표준 브라우저 Cmd+R 시맨틱이 된다.

Bun-side `BrowserView`의 공식 메서드 리스트(`loadURL`, `loadHTML`, `executeJavascript`, `setPageZoom`, `getPageZoom`, `setNavigationRules`, `findInPage`, `stopFindInPage`, `openDevTools`, `closeDevTools`, `toggleDevTools`)에는 `reload()`가 없으므로 Bun 측에서 직접 호출할 수 없고 — `executeJavascript`로 자식 webview의 메서드를 우회 호출하는 것이 정공법이다.

**executeJavascript 반환값 처리:** Electrobun의 `executeJavascript` 반환 형태(void vs Promise)는 공식 문서에 명시가 없다. 구현 단계에서 확인 후 Promise라면 `.catch(() => {})`를 붙여 unhandled rejection을 방지(원격 페이지가 사라진 상태에서도 안전하게 처리).

**기존 toolbar `#reload-app` 버튼과의 관계:** 기존 버튼은 `src`를 `about:blank` → 현재 src 어트리뷰트(`APP_CONFIG.url` 폴백)로 복원한다(`shell.ts:377-382`). 신규 Cmd+R은 자식 webview의 `reload`로 *현재 페이지를 그 자리에서* 리로드. 두 경로는 의미가 다르며 1차 PR에서는 의도적으로 공존한다. 후속에서 두 경로를 통합하는 follow-up은 별건.

### D3. `role: "about"`은 존재하지 않는다
D1의 role 목록에 `about` 없음.

**결정:** 1차 PR에서 About 항목을 메뉴에서 **제외**한다. macOS는 첫 메뉴를 앱 이름으로 표시하므로 별도 About 항목이 없어도 사용자 보고된 단축키 문제는 영향 없음. 후속에서 커스텀 action으로 about 다이얼로그를 띄우는 것 고려 가능 (별도 이슈).

### D4. 빈 label은 문서화된 패턴이다
공식 예제(`llms.txt`)가 첫 메뉴를 `{ submenu: [...] }`(label 생략)로 작성하며 주석으로 "First item on macOS becomes the app menu (app name, Quit, etc.)" 명시.

**결정:** 첫 메뉴는 label 생략. 추가 검증 불필요.

### D5. 플랫폼 지원 — Linux 미지원, Windows 부분 지원
공식 문서 명시: "macOS has full support. Windows supports simple single-character accelerators. Application menus are not currently supported on Linux." Linux에서 호출 자체가 안전하지 않을 수 있다고 해석한다.

**결정:** `if (process.platform === "darwin")` 가드를 1차 PR의 정식 동작으로 채택. Windows 확장은 별도 후속 PR(`process.platform === "darwin" || process.platform === "win32"`로 가드 확장 + Windows에서 미동작하는 role 제거)에서 다룬다.

### D6. 이벤트 핸들러 누적 위험 — 부분 완화만 가능, 알려진 한계로 인정
`Electrobun.events.on("application-menu-clicked", handler)`는 모듈 로드 시 등록된다. `bun dev --watch`가 모듈을 통째로 재실행하면 모듈 스코프 변수도 함께 초기화되므로, 단순 boolean 가드는 **재실행 사이 누적을 막지 못한다** — 네이티브 이벤트 emitter가 프로세스 수명 동안 핸들러를 유지하면 watch 모드에서 매 리로드마다 핸들러가 1개씩 더 붙는다.

Electrobun의 events API에는 `on`만 공식 문서화돼 있다. `off`/`removeListener`/unsubscribe 반환값 모두 **공식 문서에서 발견되지 않는다** — 따라서 1차 PR에서는 완전 dedup이 불가능하다.

**결정:** 다음과 같이 처리한다.
1. 모듈 스코프 boolean 가드(`let menuHandlerRegistered = false; if (!menuHandlerRegistered) { Electrobun.events.on(...); menuHandlerRegistered = true; }`)는 **동일 모듈 인스턴스 수명 내** 중복 등록만 막는 부분 완화로 채택. 코드 주석으로 한계를 명시.
2. `bun dev --watch` 핫리로드 시 누적은 **알려진 한계로 인정**한다. 프로덕션(빌드된 DMG) 사용자에게는 영향 없음 — watch 모드는 개발 워크플로에 한정.
3. 구현 단계에서 `Electrobun.events.on`의 반환값을 확인하여 unsubscribe 함수가 있으면 다음 PR에서 그 패턴으로 교체.

**검증 조정:** §8.2의 hot-reload 항목은 PASS 조건이 아니라 **현재 한계 확인**으로 재정의. 5회 리로드 후 Cmd+R 1회에 reload가 N회 트리거되면 한계가 재현된 것이며 별도 follow-up 이슈로 트래킹.

### 부수 정정
초안 §6.1의 Window 메뉴에 적었던 `front`는 잘못된 이름 — 올바른 role은 `bringAllToFront`. 본문 §6.1/§6.3에 반영 완료. 또한 초안의 View 메뉴에서 `minimize`/`zoom`은 Window 메뉴와 중복되어 macOS HIG 위반 → View 메뉴에서 제거.

## 11. References

- 우클릭 메뉴 스크린샷 (Cut/Copy 비활성화 — 사용자 보고 2026-05-28)
- Electrobun 공식 문서: ApplicationMenu, Creating UI 가이드 (context7 `/blackboardsh/electrobun` 인덱스 기준)
- `docs/pake-grade-goal.md` — 제품 바
- `CLAUDE.md` — "CLI 플래그를 늘리기보다 생성물 품질을 올린다" 원칙
- 영향받는 코드: `src/lib/templates/shell.ts`의 `generatedBunEntry()` 함수 (현재 라인 4-39; §7 적용 후에는 라인 범위가 약 30줄 늘어남 — 함수명을 기준으로 참조).
