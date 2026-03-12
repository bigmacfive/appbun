import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test } from "bun:test";

import { buildAgentPrompt } from "../lib/agent-prompt.js";
import { renderTemplateFiles, resolveAppConfig, writeProject } from "../lib/generator.js";
import { createFallbackSiteMetadata } from "../lib/metadata.js";
import { deriveIdentifier, isDirectoryEmpty, normalizeHexColor, slugify, suggestAlternativeOutputDirectory } from "../lib/utils.js";

const tempDirs: string[] = [];
const svgIconDataUrl = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="16" fill="#2255aa" />
    <circle cx="32" cy="32" r="18" fill="#ffffff" />
  </svg>`,
)}`;

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("utils", () => {
  test("slugify produces npm-safe names", () => {
    expect(slugify("My Super App!")).toBe("my-super-app");
    expect(slugify("123app")).toBe("appbun-123app");
  });

  test("normalizeHexColor normalizes short and full hex", () => {
    expect(normalizeHexColor("#abc")).toBe("#aabbcc");
    expect(normalizeHexColor("#AABBCC")).toBe("#aabbcc");
    expect(normalizeHexColor("red")).toBeUndefined();
  });

  test("deriveIdentifier reverses hostname components", () => {
    expect(deriveIdentifier("https://www.linear.app", "linear-app")).toBe("app.linear.linearapp");
  });

  test("suggestAlternativeOutputDirectory appends a numeric suffix", () => {
    const root = mkdtempSync(join(tmpdir(), "appbun-output-"));
    tempDirs.push(root);
    expect(suggestAlternativeOutputDirectory(root)).toBe(`${root}-2`);
  });

  test("isDirectoryEmpty ignores .DS_Store", () => {
    const root = mkdtempSync(join(tmpdir(), "appbun-empty-"));
    tempDirs.push(root);
    writeFileSync(join(root, ".DS_Store"), "");
    expect(isDirectoryEmpty(root)).toBe(true);
  });
});

describe("generator", () => {
  test("buildAgentPrompt targets an existing web app repo workflow", () => {
    const config = resolveAppConfig(
      "http://localhost:3000",
      {
        width: 1440,
        height: 900,
        packageManager: "bun",
        install: false,
        dmg: false,
        yes: false,
        showConfig: false,
        quiet: true,
        name: "My App",
        outDir: "./desktop/my-app",
      },
      {
        title: "My App",
        description: "Internal dashboard",
        themeColor: "#2255aa",
        sourceUrl: "http://localhost:3000",
        iconCandidates: [],
      },
    );

    const prompt = buildAgentPrompt({ ...config, outDir: "./desktop/my-app" }, {
      title: "My App",
      description: "Internal dashboard",
      themeColor: "#2255aa",
      sourceUrl: "http://localhost:3000",
      iconCandidates: [],
    });

    expect(prompt).toContain("You are working inside the repository of an existing web app.");
    expect(prompt).toContain("http://localhost:3000/");
    expect(prompt).toContain("./desktop/my-app");
    expect(prompt).toContain("npx -y appbun@latest");
  });

  test("createFallbackSiteMetadata derives defaults from url", () => {
    const metadata = createFallbackSiteMetadata("https://chat.openai.com");
    expect(metadata.title).toBe("Chat");
    expect(metadata.description).toContain("chat.openai.com");
    expect(metadata.iconCandidates.length).toBeGreaterThan(0);
  });

  test("resolveAppConfig prefers user input over fetched metadata", () => {
    const config = resolveAppConfig(
      "https://linear.app",
      {
        width: 1200,
        height: 800,
        packageManager: "bun",
        install: false,
        showConfig: false,
        quiet: true,
        name: "Linear Desktop",
        themeColor: "#123456",
      },
      {
        title: "Linear",
        description: "Issue tracker",
        themeColor: "#654321",
        sourceUrl: "https://linear.app",
        iconCandidates: [],
      },
    );

    expect(config.name).toBe("Linear Desktop");
    expect(config.themeColor).toBe("#123456");
    expect(config.packageName).toBe("linear-desktop");
  });

  test("renderTemplateFiles includes electrobun entry", () => {
    const config = resolveAppConfig(
      "https://example.com",
      {
        width: 1400,
        height: 900,
        packageManager: "npm",
        install: false,
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
    expect(files.some((file) => file.path === "src/bun/index.ts")).toBe(true);
    expect(files.some((file) => file.path === "src/mainview/index.ts")).toBe(true);
    expect(files.some((file) => file.path === "scripts/create-dmg.mjs")).toBe(true);
    expect(files.find((file) => file.path === "src/mainview/index.html")?.content).toContain("site-origin");
    expect(files.find((file) => file.path === "src/mainview/index.css")?.content).toContain("--shell-toolbar-height: 40px");
  });

  test("system titlebar preset falls back to native chrome", () => {
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
        titlebar: "system",
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
    expect(files.find((file) => file.path === "src/bun/index.ts")?.content).toContain('titleBarStyle: isMac ? "default" : "default"');
    expect(files.find((file) => file.path === "src/mainview/index.html")?.content).not.toContain("<header");
    expect(files.find((file) => file.path === "src/mainview/index.css")?.content).toContain("--shell-topbar-display: none");
  });

  test("compact titlebar preset lowers toolbar height", () => {
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
        titlebar: "compact",
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
    expect(files.find((file) => file.path === "src/bun/index.ts")?.content).toContain('titleBarStyle: isMac ? "hiddenInset" : "default"');
    expect(files.find((file) => file.path === "src/mainview/index.css")?.content).toContain("--shell-toolbar-height: 36px");
  });

  test("npm package manager renders npm-based DMG script", () => {
    const config = resolveAppConfig(
      "https://example.com",
      {
        width: 1400,
        height: 900,
        packageManager: "npm",
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
    expect(files.find((file) => file.path === "package.json")?.content).toContain('"build:dmg": "npm run build:stable && node scripts/create-dmg.mjs"');
  });

  test("generated readme includes first-launch macOS note", () => {
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
    expect(files.find((file) => file.path === "README.md")?.content).toContain("If the installed macOS app does not open from Finder or the Dock the first time");
  });

  test("writeProject creates config and icon files", async () => {
    const root = mkdtempSync(join(tmpdir(), "appbun-test-"));
    tempDirs.push(root);

    const config = resolveAppConfig(
      "https://example.com",
      {
        width: 1280,
        height: 720,
        packageManager: "bun",
        install: false,
        showConfig: false,
        quiet: true,
        outDir: join(root, "example-shell"),
      },
      {
        title: "Example",
        description: "Example app",
        themeColor: "#2255aa",
        sourceUrl: "https://example.com",
        iconCandidates: [
          {
            url: svgIconDataUrl,
            rel: "apple-touch-icon",
            format: "svg",
            sizes: [512],
          },
        ],
      },
    );

    const icons = await writeProject(config, {
      title: "Example",
      description: "Example app",
      themeColor: "#2255aa",
      sourceUrl: "https://example.com",
      iconCandidates: [
        {
          url: svgIconDataUrl,
          rel: "apple-touch-icon",
          format: "svg",
          sizes: [512],
        },
      ],
    });

    expect(existsSync(join(config.outDir, "electrobun.config.ts"))).toBe(true);
    expect(existsSync(join(config.outDir, "assets", "icon.ico"))).toBe(true);
    expect(existsSync(join(config.outDir, "icon.iconset", "icon_512x512.png"))).toBe(true);
    expect(existsSync(join(config.outDir, "scripts", "create-dmg.mjs"))).toBe(true);
    expect(readFileSync(join(config.outDir, "src", "bun", "index.ts"), "utf8")).toContain("views://mainview/index.html");
    expect(readFileSync(join(config.outDir, "src", "mainview", "index.ts"), "utf8")).toContain("https://example.com/");
    expect(readFileSync(join(config.outDir, "src", "mainview", "index.ts"), "utf8")).toContain("example.com");
    expect(readFileSync(join(config.outDir, "package.json"), "utf8")).toContain("\"build:dmg\"");
    expect(icons.sourceUrl).toBe(svgIconDataUrl);
  }, 10000);
});
