import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, test } from "bun:test";

import { renderTemplateFiles, resolveAppConfig, writeProject } from "../lib/generator.js";
import { createFallbackSiteMetadata } from "../lib/metadata.js";
import { normalizeHexColor, deriveIdentifier, slugify } from "../lib/utils.js";

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
});

describe("generator", () => {
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
  });
});
