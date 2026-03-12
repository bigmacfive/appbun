import * as cheerio from "cheerio";

import type { IconCandidate, IconFormat, SiteMetadata } from "./types.js";
import { deriveNameFromUrl, normalizeHexColor } from "./utils.js";

const USER_AGENT = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  "AppleWebKit/537.36 (KHTML, like Gecko)",
  "Chrome/133.0.0.0 Safari/537.36",
  "appbun/0.5.4 (+https://github.com/bigmacfive/appbun)"
].join(" ");

export async function fetchSiteMetadata(rawUrl: string): Promise<SiteMetadata> {
  const url = new URL(rawUrl).toString();
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const title = firstNonEmpty([
    $('meta[property="og:site_name"]').attr("content"),
    $('meta[property="og:title"]').attr("content"),
    $('meta[name="application-name"]').attr("content"),
    $("title").text(),
  ]);

  const description = firstNonEmpty([
    $('meta[name="description"]').attr("content"),
    $('meta[property="og:description"]').attr("content"),
  ]);

  const themeColor = normalizeHexColor(
    firstNonEmpty([
      $('meta[name="theme-color"]').attr("content"),
      $('meta[name="msapplication-TileColor"]').attr("content"),
    ]),
  );

  const iconCandidates = dedupeIconCandidates([
    ...collectLinkIcons($, url),
    ...(await collectManifestIcons($, url)),
    defaultFallbackIcons(url),
  ].flat());

  return {
    title: title?.trim(),
    description: description?.trim(),
    themeColor,
    sourceUrl: url,
    iconCandidates,
  };
}

export function createFallbackSiteMetadata(rawUrl: string): SiteMetadata {
  const url = new URL(rawUrl).toString();
  return {
    title: deriveNameFromUrl(url),
    description: `Desktop wrapper for ${new URL(url).hostname}`,
    sourceUrl: url,
    iconCandidates: defaultFallbackIcons(url),
  };
}

function collectLinkIcons($: cheerio.CheerioAPI, baseUrl: string): IconCandidate[] {
  const candidates: IconCandidate[] = [];
  $("link[href][rel]").each((_, element) => {
    const rel = ($(element).attr("rel") || "").trim().toLowerCase();
    if (!rel.includes("icon")) {
      return;
    }
    if (rel.includes("mask-icon")) {
      return;
    }

    const href = $(element).attr("href");
    if (!href) {
      return;
    }

    const purpose = $(element).attr("purpose") || undefined;
    if (purpose?.trim() === "monochrome") {
      return;
    }

    candidates.push({
      url: resolveUrl(baseUrl, href),
      rel,
      sizes: parseSizes($(element).attr("sizes")),
      purpose,
      mimeType: $(element).attr("type") || undefined,
      format: detectIconFormat($(element).attr("type"), href),
    });
  });
  return candidates;
}

async function collectManifestIcons($: cheerio.CheerioAPI, baseUrl: string): Promise<IconCandidate[]> {
  const href = $('link[rel="manifest"]').attr("href");
  if (!href) {
    return [];
  }

  try {
    const manifestUrl = resolveUrl(baseUrl, href);
    const response = await fetch(manifestUrl, {
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/manifest+json,application/json"
      }
    });
    if (!response.ok) {
      return [];
    }

    const manifest = await response.json() as { icons?: Array<{ src?: string; sizes?: string; purpose?: string; type?: string }> };
    return (manifest.icons || [])
      .filter((icon) => Boolean(icon.src) && icon.purpose !== "monochrome")
      .map((icon) => ({
        url: resolveUrl(manifestUrl, icon.src!),
        rel: "manifest",
        sizes: parseSizes(icon.sizes),
        purpose: icon.purpose,
        mimeType: icon.type,
        format: detectIconFormat(icon.type, icon.src),
      }));
  } catch {
    return [];
  }
}

function defaultFallbackIcons(baseUrl: string): IconCandidate[] {
  const origin = new URL(baseUrl).origin;
  return [
    { url: `${origin}/apple-touch-icon.png`, rel: "apple-touch-icon fallback", sizes: [180], format: "png" },
    { url: `${origin}/favicon.png`, rel: "favicon fallback", sizes: [32], format: "png" },
    { url: `${origin}/favicon.ico`, rel: "favicon fallback", sizes: [16, 32], format: "ico" },
  ];
}

function dedupeIconCandidates(candidates: IconCandidate[]): IconCandidate[] {
  const seen = new Set<string>();
  const results: IconCandidate[] = [];
  for (const candidate of candidates) {
    const key = `${candidate.url}|${candidate.rel}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    results.push(candidate);
  }
  return results;
}

function resolveUrl(baseUrl: string, href: string): string {
  return new URL(href, baseUrl).toString();
}

function parseSizes(value?: string): number[] {
  if (!value) {
    return [];
  }

  return value
    .split(/\s+/)
    .map((part) => {
      const match = part.match(/(\d+)x(\d+)/i);
      if (!match) {
        return undefined;
      }
      return Math.max(Number.parseInt(match[1] || "0", 10), Number.parseInt(match[2] || "0", 10));
    })
    .filter((size): size is number => Boolean(size && Number.isFinite(size)));
}

function detectIconFormat(type?: string, href?: string): IconFormat | undefined {
  const source = `${type || ""} ${href || ""}`.toLowerCase();
  if (source.includes("svg")) {
    return "svg";
  }
  if (source.includes("png")) {
    return "png";
  }
  if (source.includes("ico") || source.includes("icon")) {
    return "ico";
  }
  return undefined;
}

function firstNonEmpty(values: Array<string | undefined>): string | undefined {
  return values.find((value) => Boolean(value && value.trim()));
}
