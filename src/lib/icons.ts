import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { parseICO } from "icojs";
import { PNG } from "pngjs";
import { Resvg } from "@resvg/resvg-js";
import pngToIco from "png-to-ico";

import type { IconCandidate, IconFormat, PreparedIconAssets, SiteMetadata } from "./types.js";

const ICONSET_SPECS = [
  { file: "icon_16x16.png", size: 16 },
  { file: "icon_16x16@2x.png", size: 32 },
  { file: "icon_32x32.png", size: 32 },
  { file: "icon_32x32@2x.png", size: 64 },
  { file: "icon_128x128.png", size: 128 },
  { file: "icon_128x128@2x.png", size: 256 },
  { file: "icon_256x256.png", size: 256 },
  { file: "icon_256x256@2x.png", size: 512 },
  { file: "icon_512x512.png", size: 512 },
  { file: "icon_512x512@2x.png", size: 1024 },
] as const;

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256] as const;
const MIN_USABLE_ICON_SIZE = 64;

interface LoadedIcon {
  format: "png" | "svg";
  sourceUrl: string;
  rasterPng?: Buffer;
  svg?: string;
  originalIco?: Buffer;
}

interface FetchedIconAsset {
  buffer: Buffer;
  contentType?: string;
}

export async function prepareIconAssets(targetDir: string, metadata: SiteMetadata): Promise<PreparedIconAssets> {
  const assetsDir = join(targetDir, "assets");
  const iconsetDir = join(targetDir, "icon.iconset");
  await mkdir(assetsDir, { recursive: true });

  const loadedIcon = await loadBestIcon(metadata.iconCandidates);
  if (!loadedIcon) {
    return {};
  }

  const iconBuffers = new Map<number, Buffer>();
  for (const spec of ICONSET_SPECS) {
    const buffer = renderIconToPng(loadedIcon, spec.size);
    iconBuffers.set(spec.size, buffer);
  }

  await mkdir(iconsetDir, { recursive: true });
  for (const spec of ICONSET_SPECS) {
    const buffer = iconBuffers.get(spec.size);
    if (buffer) {
      await writeFile(join(iconsetDir, spec.file), buffer);
    }
  }

  const pngPath = join("assets", "icon.png");
  await writeFile(join(targetDir, pngPath), iconBuffers.get(512) ?? renderIconToPng(loadedIcon, 512));

  const icoPath = join("assets", "icon.ico");
  const icoBuffer = loadedIcon.originalIco ?? await pngToIco(
    ICO_SIZES.map((size) => Buffer.from(iconBuffers.get(size) ?? renderIconToPng(loadedIcon, size))),
  );
  await writeFile(join(targetDir, icoPath), icoBuffer);

  return {
    png: pngPath,
    ico: icoPath,
    macIconset: "icon.iconset",
    sourceUrl: loadedIcon.sourceUrl,
  };
}

async function loadBestIcon(candidates: IconCandidate[]): Promise<LoadedIcon | undefined> {
  const sortedCandidates = [...candidates].sort((left, right) => scoreCandidate(right) - scoreCandidate(left));
  for (const candidate of sortedCandidates) {
    const asset = await fetchIconAsset(candidate.url).catch(() => undefined);
    if (!asset?.buffer || asset.buffer.byteLength === 0) {
      continue;
    }

    if (asset.contentType && isClearlyNotAnImage(asset.contentType)) {
      continue;
    }

    const format = detectFormat(candidate, asset.buffer, asset.contentType);
    if (format === "svg") {
      const svg = asset.buffer.toString("utf8");
      if (!isLikelySvg(svg)) {
        continue;
      }
      if (!isLikelySquareSvg(svg)) {
        continue;
      }
      return {
        format,
        sourceUrl: candidate.url,
        svg,
      };
    }

    if (format === "png") {
      try {
        const png = PNG.sync.read(asset.buffer);
        if (!isUsableRasterSize(png.width, png.height)) {
          continue;
        }
        return {
          format,
          sourceUrl: candidate.url,
          rasterPng: asset.buffer,
        };
      } catch {
        continue;
      }
    }

    if (format === "ico") {
      try {
        const parsed = await parseICO(asset.buffer, "image/png");
        const largest = [...parsed]
          .filter((entry) => isUsableRasterSize(entry.width, entry.height))
          .sort((left, right) => right.width - left.width)[0];
        if (!largest) {
          continue;
        }
        return {
          format: "png",
          sourceUrl: candidate.url,
          rasterPng: Buffer.from(largest.buffer),
          originalIco: asset.buffer,
        };
      } catch {
        continue;
      }
    }
  }

  return undefined;
}

function renderIconToPng(icon: LoadedIcon, size: number): Buffer {
  if (icon.svg) {
    return Buffer.from(new Resvg(icon.svg, {
      fitTo: {
        mode: "width",
        value: size,
      },
    }).render().asPng());
  }

  if (!icon.rasterPng) {
    throw new Error("Icon source did not contain raster or SVG data");
  }

  return resizePng(icon.rasterPng, size);
}

function resizePng(buffer: Buffer, size: number): Buffer {
  const source = PNG.sync.read(buffer);
  const destination = new PNG({ width: size, height: size, colorType: 6 });
  const scale = Math.min(size / source.width, size / source.height);
  const targetWidth = Math.max(1, Math.round(source.width * scale));
  const targetHeight = Math.max(1, Math.round(source.height * scale));
  const offsetX = Math.floor((size - targetWidth) / 2);
  const offsetY = Math.floor((size - targetHeight) / 2);

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const sourceX = Math.min(source.width - 1, Math.floor(x / scale));
      const sourceY = Math.min(source.height - 1, Math.floor(y / scale));
      const sourceIndex = (sourceY * source.width + sourceX) << 2;
      const destinationIndex = ((y + offsetY) * size + (x + offsetX)) << 2;
      destination.data[destinationIndex] = source.data[sourceIndex] ?? 0;
      destination.data[destinationIndex + 1] = source.data[sourceIndex + 1] ?? 0;
      destination.data[destinationIndex + 2] = source.data[sourceIndex + 2] ?? 0;
      destination.data[destinationIndex + 3] = source.data[sourceIndex + 3] ?? 0;
    }
  }

  return PNG.sync.write(destination);
}

async function fetchIconAsset(url: string): Promise<FetchedIconAsset> {
  if (url.startsWith("data:")) {
    return decodeDataUrl(url);
  }

  const response = await fetch(url, {
    headers: {
      accept: "image/*,*/*;q=0.8",
      "user-agent": "appbun/0.1.0"
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch icon ${url}: ${response.status}`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || undefined,
  };
}

function detectFormat(candidate: IconCandidate, buffer: Buffer, contentType?: string): IconFormat | undefined {
  if (candidate.format) {
    return candidate.format;
  }

  const source = `${contentType || ""} ${candidate.mimeType || ""}`.toLowerCase();
  if (source.includes("svg")) {
    return "svg";
  }
  if (source.includes("png")) {
    return "png";
  }
  if (source.includes("ico") || source.includes("icon")) {
    return "ico";
  }

  const trimmed = buffer.subarray(0, 256).toString("utf8").trimStart().toLowerCase();
  if (trimmed.startsWith("<svg") || trimmed.includes("<svg")) {
    return "svg";
  }
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "png";
  }
  if (buffer.subarray(0, 4).equals(Buffer.from([0x00, 0x00, 0x01, 0x00]))) {
    return "ico";
  }
  return undefined;
}

function scoreCandidate(candidate: IconCandidate): number {
  const largestSize = candidate.sizes.length > 0 ? Math.max(...candidate.sizes) : 16;
  const rel = candidate.rel.toLowerCase();
  let score = largestSize;

  if (rel.includes("apple-touch-icon")) {
    score += 500;
  } else if (rel.includes("manifest")) {
    score += 350;
  } else if (rel.includes("icon")) {
    score += 250;
  }

  if (candidate.format === "svg") {
    score += 120;
  }
  if (candidate.format === "png") {
    score += 80;
  }
  if (candidate.format === "ico") {
    score += 40;
  }
  if (candidate.sizes.length > 0 && candidate.sizes.every((size) => size >= 180)) {
    score += 60;
  }
  if (largestSize < MIN_USABLE_ICON_SIZE && candidate.format !== "svg") {
    score -= 300;
  }
  if (rel.includes("fallback")) {
    score -= 140;
  }
  if (candidate.purpose?.includes("maskable")) {
    score += 25;
  }
  if (candidate.purpose?.includes("monochrome")) {
    score -= 500;
  }

  return score;
}

function decodeDataUrl(url: string): FetchedIconAsset {
  const match = url.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) {
    throw new Error("Invalid data URL");
  }

  const isBase64 = Boolean(match[2]);
  const payload = match[3] || "";
  return {
    buffer: isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf8"),
    contentType: match[1] || undefined,
  };
}

function isClearlyNotAnImage(contentType: string): boolean {
  const normalized = contentType.toLowerCase();
  return normalized.startsWith("text/html") || normalized.startsWith("application/json");
}

function isLikelySvg(svg: string): boolean {
  const trimmed = svg.trimStart().toLowerCase();
  return trimmed.startsWith("<svg") || trimmed.includes("<svg");
}

function isLikelySquareSvg(svg: string): boolean {
  const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/i);
  if (viewBoxMatch?.[1]) {
    const values = viewBoxMatch[1]
      .trim()
      .split(/[\s,]+/)
      .map((value) => Number.parseFloat(value))
      .filter((value) => Number.isFinite(value));
    if (values.length === 4) {
      return isAlmostSquare(values[2] || 0, values[3] || 0);
    }
  }

  const widthMatch = svg.match(/width=["'](\d+(?:\.\d+)?)/i);
  const heightMatch = svg.match(/height=["'](\d+(?:\.\d+)?)/i);
  if (widthMatch && heightMatch) {
    return isAlmostSquare(Number.parseFloat(widthMatch[1] || "0"), Number.parseFloat(heightMatch[1] || "0"));
  }

  return true;
}

function isUsableRasterSize(width: number, height: number): boolean {
  return Math.min(width, height) >= MIN_USABLE_ICON_SIZE && isAlmostSquare(width, height);
}

function isAlmostSquare(width: number, height: number): boolean {
  if (!width || !height) {
    return false;
  }
  const ratio = Math.max(width, height) / Math.min(width, height);
  return ratio <= 1.15;
}
