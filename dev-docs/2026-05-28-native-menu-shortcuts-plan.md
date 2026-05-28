# Native macOS Menu & Standard Keyboard Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generated appbun macOS apps install a native `NSMenu` (App / Edit / View / Window) so that `Cmd+C/V/X/A/Z/Q/R/F/M` and the right-click Cut/Copy items work out of the box, restoring expected desktop behavior in any text-input field.

**Architecture:** Modify the template that emits `src/bun/index.ts` (`generatedBunEntry()` in `src/lib/templates/shell.ts`) so that on macOS it calls `ApplicationMenu.setApplicationMenu([...])` with built-in `role`-based items plus one custom `Reload` action that proxies to the embedded `<electrobun-webview id="remote-app">`. Enable `esModuleInterop` in the generated `tsconfig.json` so the default `import Electrobun` line compiles. Wrap the menu install in `if (isMac)` to leave Windows/Linux untouched. Lock the behavior with a generator unit test + three new `scaffold-smoke.yml` greps. No new CLI flags.

**Tech Stack:** TypeScript (NodeNext, strict), Bun test runner, Commander-based CLI, Electrobun 1.18.1 `ApplicationMenu` API.

**Spec source:** [`dev-docs/native-menu-shortcuts.md`](../../../dev-docs/native-menu-shortcuts.md) — resolved 2026-05-28.

---

## File Structure

Files to touch (all already exist except the new plan file):

| File | Responsibility |
|---|---|
| `src/lib/templates/shell.ts` | `generatedBunEntry()` template — owns the menu install + Reload handler emitted into `src/bun/index.ts` of every generated project. |
| `src/lib/templates/project.ts` | `generatedTsconfig()` — emits the generated project's `tsconfig.json`. Needs `esModuleInterop: true` for default-import compatibility. |
| `src/__tests__/generator.test.ts` | Generator regression tests. Add assertions on the new menu install + tsconfig flag. |
| `.github/workflows/scaffold-smoke.yml` | Smoke CI. Add three greps protecting the menu contract. |
| `CLAUDE.md` (top-level) | Mention the new grep contract + fix the stale `scaffold.yml` filename references (real file is `scaffold-smoke.yml`). |
| `skills/appbun-web-desktop/SKILL.md` | Add a Quality Bar bullet about macOS shortcuts. |
| `skills/appbun-web-desktop/CLAUDE.md` | Sync the same statement (added under "Verification"). |
| `package.json` | Version bump `0.10.4` → `0.10.5`. |

The work is decomposed into 9 small tasks. Each task is a single self-contained edit + assertions + commit.

---

## Task Decomposition Overview

1. Enable `esModuleInterop` in generated `tsconfig.json` (with test).
2. Update `generatedBunEntry()` to install the macOS application menu and wire the `reload-app` handler (with test).
3. Extend `scaffold-smoke.yml` with 3 grep guards.
4. Update top-level `CLAUDE.md` — fix `scaffold.yml` → `scaffold-smoke.yml` and document the new grep contract.
5. Add Quality Bar entry to `skills/appbun-web-desktop/SKILL.md`.
6. Sync `skills/appbun-web-desktop/CLAUDE.md`.
7. Run full local verification (`check` + `test` + `release:check`).
8. Bump version to `0.10.5`.
9. Manual macOS DMG verification (checklist from spec §8.2) — release-blocking but not commit-gated.

---

## Task 1: Enable `esModuleInterop` in the generated `tsconfig.json`

**Why first:** Task 2's new template code uses `import Electrobun, { … } from "electrobun/bun"` (default import). Without `esModuleInterop`, the consumer project will fail `tsc`. Doing this first keeps every intermediate commit in a state where the generated project still compiles.

**Files:**
- Modify: `src/lib/templates/project.ts:145-158` (`generatedTsconfig()`)
- Test: `src/__tests__/generator.test.ts` — extend the existing `renderTemplateFiles includes electrobun entry` test (so we don't add a brand-new test that competes for the same fixture). Add one assertion inside that test.

- [ ] **Step 1: Read the current generator test for context**

Run: `bun test src --test-name-pattern "renders electrobun entry" 2>&1 | head -20` to confirm the test currently passes; then read `src/__tests__/generator.test.ts:227-273` (the `renderTemplateFiles includes electrobun entry` test) so you know exactly which `files` array is available to assert against.

- [ ] **Step 2: Add the failing assertion**

Open `src/__tests__/generator.test.ts`. Inside `test("renderTemplateFiles includes electrobun entry", ...)` (around line 273, before the closing `});` of that test), add this assertion as a new line right after the existing `expect(manifest).toContain('"version": ...)` line:

```ts
    expect(files.find((file) => file.path === "tsconfig.json")?.content).toContain('"esModuleInterop": true');
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun test src --test-name-pattern "renderTemplateFiles includes electrobun entry"`
Expected: FAIL with message containing `Expected: ... "esModuleInterop": true ... Received: undefined` (or a `toContain` mismatch on the rendered tsconfig string).

- [ ] **Step 4: Update `generatedTsconfig()` to emit the flag**

Open `src/lib/templates/project.ts`. Replace the `generatedTsconfig` function body (currently lines 145-158) with:

```ts
function generatedTsconfig(): string {
  return [
    "{",
    '  "compilerOptions": {',
    '    "target": "ES2022",',
    '    "module": "ESNext",',
    '    "moduleResolution": "Bundler",',
    '    "strict": true,',
    '    "esModuleInterop": true,',
    '    "types": ["bun"]',
    "  }",
    "}",
    "",
  ].join("\n");
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test src --test-name-pattern "renderTemplateFiles includes electrobun entry"`
Expected: PASS.

Also run the full suite to be safe: `bun run check && bun test src`
Expected: type check clean, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/templates/project.ts src/__tests__/generator.test.ts
git commit -m "Enable esModuleInterop in generated tsconfig"
```

---

## Task 2: Install the macOS application menu in the generated `src/bun/index.ts`

**Files:**
- Modify: `src/lib/templates/shell.ts:4-39` (`generatedBunEntry()`)
- Test: `src/__tests__/generator.test.ts` — add a new `test(...)` inside the `describe("generator", ...)` block.

This is the largest task. Each step is small.

- [ ] **Step 1: Read the current template output to confirm starting state**

Read `src/lib/templates/shell.ts:1-39`. Confirm the function:
- declares `const isMac = process.platform === "darwin";` (line 16 of the emitted template literal)
- imports only `BrowserWindow` from `electrobun/bun`
- defines `mainWindow` but never installs a menu.

This matches the spec §6.3 starting state.

- [ ] **Step 2: Add a failing test that asserts the menu install is present**

Open `src/__tests__/generator.test.ts`. Add this new test just below the existing `test("renderTemplateFiles includes electrobun entry", ...)` test (so it shares the same describe block, around the line that now ends with `});` after the `tsconfig` assertion you added in Task 1):

```ts
  test("generated bun entry installs the macOS application menu", () => {
    const config = resolveAppConfig(
      "https://example.com",
      {
        width: 1400,
        height: 900,
        packageManager: "bun",
        install: false,
        dmg: false,
        yes: false,
        showConfig: false,
        quiet: true,
      },
      {
        title: "Example",
        description: "Example app",
        themeColor: "#336699",
        sourceUrl: "https://example.com",
        iconCandidates: [],
      },
    );

    const files = renderTemplateFiles(config, {});
    const bunEntry = files.find((file) => file.path === "src/bun/index.ts")?.content ?? "";

    // import line includes ApplicationMenu + default Electrobun import
    expect(bunEntry).toContain('import Electrobun, { BrowserWindow, ApplicationMenu } from "electrobun/bun"');

    // platform guard reuses the existing isMac variable, no redeclaration
    expect(bunEntry).toContain("if (isMac) {");
    expect((bunEntry.match(/const isMac = /g) ?? []).length).toBe(1);

    // setApplicationMenu call exists
    expect(bunEntry).toContain("ApplicationMenu.setApplicationMenu(");

    // Edit menu roles present (spec §6.1). Use the `role: "X"` form so the
    // assertion can't pass on a stray substring (e.g. "copy" inside a comment).
    expect(bunEntry).toContain('role: "copy"');
    expect(bunEntry).toContain('role: "paste"');
    expect(bunEntry).toContain('role: "cut"');
    expect(bunEntry).toContain('role: "selectAll"');
    expect(bunEntry).toContain('role: "undo"');
    expect(bunEntry).toContain('role: "redo"');
    expect(bunEntry).toContain('role: "pasteAndMatchStyle"');
    expect(bunEntry).toContain('role: "delete"');

    // App menu roles present
    expect(bunEntry).toContain('role: "hide"');
    expect(bunEntry).toContain('role: "hideOthers"');
    expect(bunEntry).toContain('role: "showAll"');
    expect(bunEntry).toContain('role: "quit"');

    // View menu — custom Reload action + accelerator + toggleFullScreen role
    expect(bunEntry).toContain('action: "reload-app"');
    expect(bunEntry).toContain('accelerator: "r"');
    expect(bunEntry).toContain('role: "toggleFullScreen"');

    // Window menu — correct role name is bringAllToFront (not "front")
    expect(bunEntry).toContain('role: "minimize"');
    expect(bunEntry).toContain('role: "zoom"');
    expect(bunEntry).toContain('role: "bringAllToFront"');

    // Reload handler invokes the child <electrobun-webview>, NOT location.reload().
    // The bare-substring check below catches both the bad-string form
    // (`executeJavascript("location.reload()")`) and a bare `location.reload()` call.
    expect(bunEntry).toContain("document.getElementById('remote-app')?.reload()");
    expect(bunEntry).not.toContain("location.reload()");
    // The reload JS must be passed through `mainWindow.webview.executeJavascript(...)`.
    // Bare-call placement in the Bun process would do nothing — the call must cross
    // the webview boundary. Anchor the wrapper presence here.
    expect(bunEntry).toContain("mainWindow.webview.executeJavascript(");

    // Duplicate-handler-registration guard (spec §10 D6). The boolean MUST be at
    // module scope (declared before `if (isMac)`) — spec §6.3 wording is explicit.
    // The state transition `menuHandlerRegistered = true` must also be present —
    // omitting it would leave the guard permanently false and re-fire registrations.
    expect(bunEntry).toContain("let menuHandlerRegistered = false");
    expect(bunEntry.indexOf("menuHandlerRegistered")).toBeLessThan(
      bunEntry.indexOf("if (isMac) {"),
    );
    expect(bunEntry).toContain("menuHandlerRegistered = true");
    // The state transition must be inside `if (!menuHandlerRegistered) { ... }`,
    // not before it — otherwise the guard is always-false after first execution
    // and no registration ever fires (or always re-fires, depending on placement).
    expect(bunEntry.indexOf("menuHandlerRegistered = true")).toBeGreaterThan(
      bunEntry.indexOf("if (!menuHandlerRegistered)"),
    );
    expect(bunEntry).toContain('Electrobun.events.on("application-menu-clicked"');
  });
```

- [ ] **Step 3: Run the new test to verify it fails**

Run: `bun test src --test-name-pattern "generated bun entry installs the macOS application menu"`
Expected: FAIL — every `expect(...).toContain(...)` for menu-related text will fail because `generatedBunEntry()` hasn't been updated yet.

- [ ] **Step 4: Update `generatedBunEntry()` to emit the menu install**

Open `src/lib/templates/shell.ts`. Replace the entire `generatedBunEntry()` function body (currently lines 4-39) with the implementation below.

Two non-obvious notes before editing:
1. The function returns a template literal whose contents become the generated `src/bun/index.ts`. Backslashes for newlines, dollar signs, and backticks inside that returned string must be escaped (`\\n`, `\${...}`, `` \` ``) so they survive the outer template literal in `shell.ts`. The block below already escapes everything correctly.
2. We keep the existing `isMac` declaration **once**, exactly as today. The new menu block reuses it. Do not redeclare.

```ts
export function generatedBunEntry(config: ResolvedAppConfig): string {
  const preset = getTitlebarPreset(config.titlebar);
  const startMessage = `appbun wrapper started for ${config.url}`;
  const descriptionMessage = `Description: ${config.description}`;
  const styleMask = preset.macUsesUnifiedChrome
    ? `{
        UnifiedTitleAndToolbar: true,
        FullSizeContentView: true,
      }`
    : "{}";
  return `import Electrobun, { BrowserWindow, ApplicationMenu } from "electrobun/bun";

const isMac = process.platform === "darwin";
let menuHandlerRegistered = false;

const mainWindow = new BrowserWindow({
  title: ${JSON.stringify(config.title)},
  url: "views://mainview/index.html",
  frame: {
    width: ${config.width},
    height: ${config.height},
    x: 120,
    y: 120,
  },
  titleBarStyle: isMac ? ${JSON.stringify(preset.macTitleBarStyle)} : "default",
  styleMask: isMac ? ${styleMask} : {},
  transparent: false,
});

mainWindow.webview.on("dom-ready", () => {
  console.log(${JSON.stringify(`${config.name} shell loaded`)})
});

if (isMac) {
  // Built-in roles bind their own Cmd shortcuts; one custom Reload action
  // routes Cmd+R to the embedded <electrobun-webview> rather than reloading the shell.
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

  const handleMenuClick = (e: { data: { action?: string } }) => {
    if (e.data.action === "reload-app") {
      // mainWindow.webview is the shell; reload the child <electrobun-webview id="remote-app">
      // so only the remote page refreshes, not the shell chrome.
      // Cast to unknown so the optional-Promise check stays valid even if the
      // declared return type is void (avoids TS strict "always false" error).
      const result: unknown = mainWindow.webview.executeJavascript(
        "document.getElementById('remote-app')?.reload()"
      );
      if (result && typeof (result as { catch?: unknown }).catch === "function") {
        (result as Promise<unknown>).catch(() => {});
      }
    }
  };

  // Boolean guard prevents duplicate handler registration within one module instance.
  // bun dev --watch hot-reload may still accumulate handlers across module reloads;
  // tracked as a known limitation (see dev-docs/native-menu-shortcuts.md §10 D6).
  if (!menuHandlerRegistered) {
    Electrobun.events.on("application-menu-clicked", handleMenuClick);
    menuHandlerRegistered = true;
  }
}

console.log(${JSON.stringify(startMessage)});
console.log(${JSON.stringify(descriptionMessage)});
`;
}
```

- [ ] **Step 5: Run the new test to verify it passes**

Run: `bun test src --test-name-pattern "generated bun entry installs the macOS application menu"`
Expected: PASS — every assertion matches.

- [ ] **Step 6: Re-run the full generator test suite to catch regressions**

Run: `bun run check && bun test src`
Expected: type check clean, every test passes (including the previously updated `renderTemplateFiles includes electrobun entry` test from Task 1, the `system titlebar preset falls back to native chrome` test that asserts `'titleBarStyle: isMac ? "default" : "default"'`, and the `compact titlebar preset lowers toolbar height` test).

If any titlebar-preset test fails, the most likely cause is that you removed or shifted the `titleBarStyle: isMac ? ${JSON.stringify(...)} : "default"` line. Restore it exactly.

- [ ] **Step 7: Build and run the CLI against a throwaway target to eye-check the emitted file**

Run:
```bash
bun run build && node ./bin/appbun.js https://example.com --name Example --out-dir /tmp/appbun-menu-check --quiet
```
Then:
```bash
grep -n "ApplicationMenu.setApplicationMenu\|reload-app\|menuHandlerRegistered" /tmp/appbun-menu-check/src/bun/index.ts
```
Expected output: three matches, all in correct positions (import / menu install / handler registration). Clean up: `rm -rf /tmp/appbun-menu-check`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/templates/shell.ts src/__tests__/generator.test.ts
git commit -m "Install native macOS menu in generated bun entry"
```

---

## Task 3: Extend `scaffold-smoke.yml` with three grep guards

**Files:**
- Modify: `.github/workflows/scaffold-smoke.yml` (current last asserts are around lines 25-28)

**Trigger scope (intentional):** `scaffold-smoke.yml` runs on `push: main` + `workflow_dispatch` only — i.e., *after* merge. We do **not** add a `pull_request` trigger because the smoke step invokes `node ./bin/appbun.js https://example.com ...`, which makes a live network fetch to `https://example.com` for metadata; turning that into a required PR check would create a flaky merge gate when the external host or CI network has a transient issue. The pre-merge gate is `ci.yml` (which already runs on `pull_request` and executes the Task 2 unit test — covering the same menu contract in-process). If the post-merge smoke fails after a bad change lands, revert and re-land per the rollback note in Task 9 step 4.

- [ ] **Step 1: Add the three new grep steps**

Open `.github/workflows/scaffold-smoke.yml`. After the existing `- run: grep -q appbun.generated.json ./tmp/example/README.md` step (currently the last step at line 28), append three new steps so the tail of the `steps:` list reads:

```yaml
      - run: grep -q appbun.generated.json ./tmp/example/README.md
      - run: grep -q 'ApplicationMenu.setApplicationMenu' ./tmp/example/src/bun/index.ts
      - run: grep -q 'process.platform === "darwin"' ./tmp/example/src/bun/index.ts
      - run: grep -q 'role: "copy"' ./tmp/example/src/bun/index.ts
```

> Note on quoting: GitHub Actions YAML wraps each `run:` value in a shell invocation. The single-quoted patterns above are passed verbatim to `grep -q`; the inner double-quotes survive because they're inside single quotes. `process.platform === "darwin"` is not literally present in our `generatedBunEntry()` output today — we use `const isMac = process.platform === "darwin"`, so the substring match is satisfied.
>
> The `role: "copy"` grep (instead of just `"copy"`) makes the assertion specific to the Edit-menu Copy role — it cannot pass by coincidence on the word "copy" appearing in a comment or string elsewhere.

- [ ] **Step 2: Smoke-run the same commands locally**

Run:
```bash
bun run build && node ./bin/appbun.js https://example.com --name Example --out-dir /tmp/appbun-smoke --quiet
grep -q 'ApplicationMenu.setApplicationMenu' /tmp/appbun-smoke/src/bun/index.ts && echo OK1
grep -q 'process.platform === "darwin"' /tmp/appbun-smoke/src/bun/index.ts && echo OK2
grep -q 'role: "copy"' /tmp/appbun-smoke/src/bun/index.ts && echo OK3
rm -rf /tmp/appbun-smoke
```
Expected: three lines `OK1`, `OK2`, `OK3`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/scaffold-smoke.yml
git commit -m "Assert native macOS menu lands in generated project (scaffold-smoke)"
```

---

## Task 4: Update top-level `CLAUDE.md`

Two changes: (a) fix two stale references to `scaffold.yml` (real file is `scaffold-smoke.yml`); (b) document the new grep contract.

**Files:**
- Modify: `CLAUDE.md` (top-level; lines 27 and 36 hold the stale filename; line 27 also holds the contract-grep list)

- [ ] **Step 1: Replace the stale filename + extended grep contract on line 27**

Find the line that begins `CI (`.github/workflows/ci.yml`)` (currently line 27). Replace it with:

```markdown
CI (`.github/workflows/ci.yml`) runs `check`, `test`, `build`, and `npm pack --dry-run`. A separate `scaffold-smoke.yml` smoke-tests `node ./bin/appbun.js https://example.com ...` and asserts specific files in the generated project — keep these references intact in templates: `APPLE_SIGN_IDENTITY`, `APPLE_NOTARIZE`, `shell-status`, `appbun.generated.json`, `ApplicationMenu.setApplicationMenu`, `process.platform === "darwin"`, and the literal `role: "copy"` (the Edit-menu role) in `src/bun/index.ts`.
```

- [ ] **Step 2: Fix the second stale reference on line 36**

Find the line that begins `- `templates/` —` and contains the phrase `updating `.github/workflows/scaffold.yml``. Replace `.github/workflows/scaffold.yml` with `.github/workflows/scaffold-smoke.yml` in that line.

- [ ] **Step 3: Verify no other occurrences of the stale name remain**

Run: `grep -n "scaffold\.yml" /Users/laeyoung/Documents/personal/appbun/CLAUDE.md`
Expected: no output (an empty result). Any remaining match indicates a missed reference — fix it before continuing. (Use the absolute path so this check is independent of the shell's current working directory.)

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "Document menu grep contract and fix scaffold-smoke filename in CLAUDE.md"
```

---

## Task 5: Add Quality Bar entry to `skills/appbun-web-desktop/SKILL.md`

**Files:**
- Modify: `skills/appbun-web-desktop/SKILL.md:73-83` (the `## Quality Bar` section)

- [ ] **Step 1: Insert the new bullet**

Open `skills/appbun-web-desktop/SKILL.md`. The existing Quality Bar list ends with the bullet about "Temporary smoke-test output is created outside the source repo and deleted when the user only asked for validation." (line 83). Add **one** new bullet directly above the bullet that starts `- The wrapper source is committed...` so the list reads (in this order):

```markdown
## Quality Bar

Before considering the desktop wrapper done:

- The generated app name, package name, icon, window size, and theme color match the product.
- On macOS, standard keyboard shortcuts (`Cmd+C/V/X/A/Z/Shift+Z/Q/R/M`) and the right-click Cut/Copy items work immediately in the built app.
- The wrapper source is committed or clearly isolated from the main web app in a dedicated output directory.
- `bun run build` succeeds inside the generated project, or the remaining blocker is stated with logs.
- `appbun doctor --project` is run in the generated project and warnings are explained.
- Release workflows use native OS runners for platform builds.
- README or release notes explain that the output is inspectable Electrobun code, not a black-box binary wrapper.
- Temporary smoke-test output is created outside the source repo and deleted when the user only asked for validation.
```

- [ ] **Step 2: Commit**

```bash
git add skills/appbun-web-desktop/SKILL.md
git commit -m "Add macOS shortcut expectation to the appbun-web-desktop Quality Bar"
```

---

## Task 6: Sync `skills/appbun-web-desktop/CLAUDE.md`

The skill's CLAUDE.md doesn't currently have a Quality Bar section, so we add the same statement under the existing `## Verification` section.

**Files:**
- Modify: `skills/appbun-web-desktop/CLAUDE.md` (the `## Verification` section)

- [ ] **Step 1: Insert the shortcut verification bullet**

Open `skills/appbun-web-desktop/CLAUDE.md`. Find the `## Verification` heading. After the existing code block ending with `npx -y appbun@latest package --install`, add a new paragraph and bullet so the section reads (only the new paragraph + bullet is new — everything else is existing):

```markdown
## Verification

After generation:

```bash
cd ../appbun-output/<app-slug>
npx -y appbun@latest doctor --project
npx -y appbun@latest package --install
```

After installing the built macOS DMG, also confirm desktop fundamentals:

- In any text input on the launched app, `Cmd+C/V/X/A/Z/Shift+Z` work, the App / Edit / View / Window menus appear in the menu bar, and right-click Cut/Copy are enabled when text is selected. If they are not, the generated `src/bun/index.ts` is likely missing the `ApplicationMenu.setApplicationMenu(...)` call.

On macOS, build a local DMG:
```

(Keep the rest of the file exactly as-is.)

- [ ] **Step 2: Commit**

```bash
git add skills/appbun-web-desktop/CLAUDE.md
git commit -m "Mirror macOS shortcut verification in appbun-web-desktop CLAUDE.md"
```

---

## Task 7: Full local verification

This task is verification-only — no code edits. It exists as a hard checkpoint before bumping the version.

- [ ] **Step 1: Run the full check + test pipeline**

Run: `bun run check && bun test src`
Expected: all green.

- [ ] **Step 2: Run `release:check` to validate the published file list**

Run: `bun run release:check`
Expected: build succeeds, `npm pack --dry-run` lists `bin/`, `dist/`, `skills/`, `README.md`, `CONTRIBUTING.md`, `LICENSE`. No new files should sneak into the tarball (the spec changes touch only files already inside `files`).

- [ ] **Step 3: End-to-end scaffold smoke locally**

Reproduce what `scaffold-smoke.yml` does:

```bash
node ./bin/appbun.js https://example.com --name Example --out-dir /tmp/appbun-e2e --quiet
test -f /tmp/appbun-e2e/electrobun.config.ts
test -f /tmp/appbun-e2e/appbun.generated.json
test -f /tmp/appbun-e2e/package.json
test -f /tmp/appbun-e2e/src/mainview/index.ts
test -f /tmp/appbun-e2e/scripts/create-dmg.mjs
grep -q APPLE_SIGN_IDENTITY /tmp/appbun-e2e/scripts/create-dmg.mjs
grep -q APPLE_NOTARIZE /tmp/appbun-e2e/scripts/create-dmg.mjs
grep -q shell-status /tmp/appbun-e2e/src/mainview/index.html
grep -q appbun.generated.json /tmp/appbun-e2e/README.md
grep -q 'ApplicationMenu.setApplicationMenu' /tmp/appbun-e2e/src/bun/index.ts
grep -q 'process.platform === "darwin"' /tmp/appbun-e2e/src/bun/index.ts
grep -q 'role: "copy"' /tmp/appbun-e2e/src/bun/index.ts
rm -rf /tmp/appbun-e2e
```
Expected: every command exits 0; no output is the success case.

- [ ] **Step 4: Type-check the generated project to confirm `Electrobun.events.on` resolves**

The spec (§10 D6) acknowledges that the Electrobun events API is documented only as `on` and the default-export shape is inferred from the example, not verified from the package types. Catch any import/type mismatch *before* the version bump by type-checking the throwaway project from Step 3:

```bash
node ./bin/appbun.js https://example.com --name Example --out-dir /tmp/appbun-typecheck --install --quiet
cd /tmp/appbun-typecheck
npx --yes typescript@latest tsc --noEmit
cd - && rm -rf /tmp/appbun-typecheck
```

Expected: `tsc --noEmit` exits 0. If it errors on the `Electrobun` default import or on `Electrobun.events.on`, swap to the named-import fallback noted in spec §6.3:

```ts
import { BrowserWindow, ApplicationMenu, events } from "electrobun/bun";
// …
events.on("application-menu-clicked", handleMenuClick);
```

Apply **both** swaps inside the `generatedBunEntry()` template literal in `src/lib/templates/shell.ts`: (a) change the emitted import line from `import Electrobun, { BrowserWindow, ApplicationMenu } from "electrobun/bun"` to `import { BrowserWindow, ApplicationMenu, events } from "electrobun/bun"`, and (b) change the emitted `Electrobun.events.on("application-menu-clicked", handleMenuClick)` call to `events.on("application-menu-clicked", handleMenuClick)`. Without (b), the generated project still references the broken default export and the type-check failure recurs. Then drop the `esModuleInterop: true` from `generatedTsconfig()` in `src/lib/templates/project.ts` (Task 1's emit change is reverted), **and remove the Task 1 assertion** `expect(files.find((file) => file.path === "tsconfig.json")?.content).toContain('"esModuleInterop": true')` from `src/__tests__/generator.test.ts` so it doesn't keep failing. Then update the Task 2 test in `src/__tests__/generator.test.ts` so both menu-import assertions match the named-import form — **replace** `expect(bunEntry).toContain('import Electrobun, { BrowserWindow, ApplicationMenu } from "electrobun/bun"')` with `expect(bunEntry).toContain('import { BrowserWindow, ApplicationMenu, events } from "electrobun/bun"')`, and **replace** `expect(bunEntry).toContain('Electrobun.events.on("application-menu-clicked"')` with `expect(bunEntry).toContain('events.on("application-menu-clicked"')`. Leaving the original default-import assertion in place would silently fail every test run. Re-run the full pipeline from Task 7 step 1.

- [ ] **Step 5: No commit — verification only**

If anything in this task fails, do **not** proceed to Task 8. Go back to whichever earlier task produced the regression and fix it there.

---

## Task 8: Bump version to `0.10.5`

**Files:**
- Modify: `package.json` (the `"version"` field)

- [ ] **Step 1: Read the current version**

Run: `grep -n '"version"' package.json | head -1`
Expected: `  "version": "0.10.4",`

- [ ] **Step 2: Update to `0.10.5`**

Open `package.json`. Change the line `"version": "0.10.4",` to `"version": "0.10.5",`.

- [ ] **Step 3: Verify `getAppbunVersion()` reads the new value**

Run: `bun test src --test-name-pattern "renderTemplateFiles includes electrobun entry"`
Expected: PASS — the test asserts `"version": "${getAppbunVersion()}"` is embedded in the generated manifest, so a version mismatch would fail here.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "Release v0.10.5"
```

---

## Task 9: Manual macOS DMG verification (release-blocking, not commit-gated)

This is the spec §8.2 checklist. It must pass on a real macOS machine before publishing the GitHub Release that triggers `publish.yml`. It is **not** part of the merged-PR gate — it gates the release tag, per spec §9.

- [ ] **Step 1: Build the DMG from a fresh scaffold**

First, make sure the CLI's own `dist/` is fresh — Task 7 step 2 was the last build, and Task 8 only edited `package.json`, but rebuild anyway to guarantee the version-bumped CLI is what's running:

```bash
bun run build
node ./bin/appbun.js https://duckduckgo.com -o /tmp/appbun-menu-dmg --install
cd /tmp/appbun-menu-dmg && bun run build:dmg
open build/*.dmg
```

**Apple credentials note:** `bun run build:dmg` invokes `scripts/create-dmg.mjs`. The generated script only requires `APPLE_SIGN_IDENTITY` when you explicitly run `package --sign` or `--notarize`; an unsigned DMG (Gatekeeper-restricted on first launch, fine for local verification) is produced when no Apple env vars are set. If `build:dmg` errors with a `codesign` failure, re-run as `APPLE_SIGN_IDENTITY="" bun run build:dmg` to force the unsigned path, or use `bun run build` (no DMG) and launch the app from `build/<platform>/<App>.app` directly.

Install the app from the DMG and launch it.

- [ ] **Step 2: Verify every item in the spec §8.2 manual checklist**

For each item, mark pass/fail in the PR description:

- Right-click → Cut/Copy enabled when text is selected
- `Cmd+C` copies (cross-check with `pbpaste`)
- `Cmd+V` pastes, `Cmd+X` cuts
- `Cmd+A` selects all
- `Cmd+Z` undoes, `Cmd+Shift+Z` redoes
- `Cmd+Q` quits the app
- `Cmd+M` minimizes, `Cmd+Ctrl+F` toggles fullscreen
- `Cmd+R` reloads **only** the embedded `<electrobun-webview id="remote-app">` — shell chrome/menu bar should not flicker. Only the remote page refreshes.
- Toolbar `#reload-app` button still works (`about:blank` → current src semantics, distinct from Cmd+R, per spec §10 D2)
- Korean (or any IME) input still works in text inputs
- The menu bar actually shows App / Edit / View / Window. If shortcuts work but the menu bar is empty, `setApplicationMenu` silently failed and item 8 is a false positive.
- App menu (first item) contains Hide / Hide Others / Show All / Quit
- Edit menu contains all 8 items (Undo through Select All including Paste and Match Style)
- Known limitation check (do NOT block on this): in `bun dev --watch`, after 5 hot reloads, one Cmd+R should fire ≥1 reload — N>1 is the documented limitation (spec §10 D6). In the production DMG it must be exactly 1.

- [ ] **Step 3: Verify on one or two recipe apps**

Quick sanity on an unauthenticated recipe:

```bash
node ./bin/appbun.js wikipedia -o /tmp/appbun-menu-wiki --install
cd /tmp/appbun-menu-wiki && bun run build:dmg && open build/*.dmg
```

Confirm Cmd+C and Cmd+Q work in the installed Wikipedia app. Clean up `/tmp/appbun-menu-dmg` and `/tmp/appbun-menu-wiki` after verification.

- [ ] **Step 4: Open the PR and request review**

PR title suggestion: `Install native macOS menu in generated apps (v0.10.5)`

PR body must include:
- A link to `dev-docs/native-menu-shortcuts.md`
- The §8.2 checklist with pass/fail marks
- A Windows follow-up note: "Windows partial support (single-character accelerators per spec §10 D5) is tracked as a separate post-0.10.5 PR; this change leaves Windows/Linux behavior unchanged."
- Rollback note (matches spec §9.1): if a regression is reported post-publish, revert the **five** commits from Tasks 1, 2, 3, 4, and 8. **Do not revert Tasks 5 or 6** — the skills/Quality-Bar updates are documentation expressing the new product expectation, and spec §9.1 explicitly excludes `skills/appbun-web-desktop/SKILL.md` and `skills/appbun-web-desktop/CLAUDE.md` from rollback. Within Task 4, keep the `scaffold.yml → scaffold-smoke.yml` filename fix (it is a standalone correctness fix unrelated to the menu code) by reverting only the grep-contract paragraph if needed. See spec §9.1 for the full revert recipe and `npm deprecate` syntax.
- Note: the Release that triggers `publish.yml` should be created **after** merge by publishing the `v0.10.5` GitHub Release (a bare tag push will not fire the workflow, per spec §9 step 3). `publish.yml` also accepts `workflow_dispatch` as a manual fallback. Release body text is in spec §7 (last row).

- [ ] **Step 5: Publish the GitHub Release to fire `publish.yml`**

After PR merge, on the GitHub UI: **Releases → Draft a new release → Tag: `v0.10.5` → Publish release** with the release body verbatim from spec §7's last row:

> Generated apps now ship a native macOS application menu, restoring Cmd+C/V/X/A/Z/Q and other standard shortcuts.

`publish.yml` fires on `release: published` and runs `check` + `test` + `build` + `npm publish` itself — any of those gates failing aborts the publish. If a gate fails or the trigger does not fire for any reason: fix the issue, then re-run via `workflow_dispatch` from the Actions tab (or delete + recreate the GitHub Release to re-fire `release: published`).

---

## Self-Review (executed by the plan author)

**Spec coverage check:**

| Spec section | Plan task |
|---|---|
| §2 Root cause (no NSMenu) | Addressed by Task 2 — menu install + roles |
| §3 Goal 1 (works out of box) | Task 2 (template emits it unconditionally on darwin) |
| §3 Goal 2 (no new CLI flags) | No CLI changes anywhere in the plan |
| §3 Goal 3 (don't break Win/Linux) | Task 2 wraps in `if (isMac)`; no Win/Linux paths touched |
| §3 Goal 4 (CI protected) | Task 3 (grep guards) + Task 2 (unit test) |
| §6.1 menu structure | Task 2 step 4 matches the table exactly (App, Edit, View, Window) |
| §6.2 platform guard | Task 2 step 4 uses `if (isMac) { ApplicationMenu.setApplicationMenu(...) }` |
| §7 file changes | Tasks 1, 2, 3, 4, 5, 6, 8 cover every row of the §7 table |
| §8.1 automated tests | Tasks 1, 2 (`bun test` assertions); Task 7 step 1 (`check`+`test`), step 2 (`release:check`), step 3 (scaffold-smoke parity), step 4 (generated-project type-check) |
| §8.2 manual checklist | Task 9 |
| §9 rollout | Task 8 + Task 9 PR/release notes |
| §10 D1 (no `reload` role) | Task 2 uses `{ label: "Reload", action: "reload-app", accelerator: "r" }` |
| §10 D2 (child webview reload) | Task 2 handler invokes `document.getElementById('remote-app')?.reload()`; test asserts the wrong-form `location.reload()` is absent |
| §10 D3 (no `about` role) | Task 2 menu structure has no About item |
| §10 D4 (empty label = app menu) | Task 2 step 4: first submenu entry has no `label`, matching the documented pattern |
| §10 D5 (Linux unsupported / Windows partial) | `if (isMac)` guard in Task 2; Windows partial support tracked as follow-up in Task 9 step 4 PR body |
| §10 D6 (handler dedup) | Task 2 emits `menuHandlerRegistered` boolean guard + inline comment |
| §10 bringAllToFront vs front | Task 2 emits `role: "bringAllToFront"`; positive `expect(bunEntry).toContain('role: "bringAllToFront"')` assertion locks the correct name (no separate negative assertion — `bringAllToFront` does not contain the substring `role: "front"`). |

No gaps.

**Placeholder scan:** None. Every step has either exact code or an exact command + expected output.

**Type consistency:** The Reload action string `"reload-app"` is identical in the menu definition and the handler `if (e.data.action === "reload-app")`. The boolean guard variable name `menuHandlerRegistered` is identical at declaration and at the `if (!menuHandlerRegistered)` check. The DOM id `"remote-app"` matches what `src/mainview/index.ts` already sets at `shell.ts:359` (`remoteApp.setAttribute("id", "remote-app");`).

---

Plan complete and saved to `dev-docs/2026-05-28-native-menu-shortcuts-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
