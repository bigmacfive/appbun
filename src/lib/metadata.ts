import * as cheerio from "cheerio";

import type { SiteMetadata } from "./types.js";
import { normalizeHexColor } from "./utils.js";

const USER_AGENT = "appbun/0.1.0 (+https://github.com/bigmacfive/appbun)";

export async function fetchSiteMetadata(rawUrl: string): Promise<SiteMetadata> {
  const url = new URL(rawUrl).toString();
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml"
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

  return {
    title: title?.trim(),
    description: description?.trim(),
    themeColor,
    sourceUrl: url,
  };
}

function firstNonEmpty(values: Array<string | undefined>): string | undefined {
  return values.find((value) => Boolean(value && value.trim()));
}
