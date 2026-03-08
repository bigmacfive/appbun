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

interface LoadedIcon {
  format: "png" | "svg";
  sourceUrl: string;
  rasterPng?: Buffer;
  svg?: string;
  originalIco?: Buffer;
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
    const buffer = await fetchBuffer(candidate.url).catch(() => undefined);
    if (!buffer || buffer.byteLength === 0) {
      continue;
    }

    const format = detectFormat(candidate, buffer);
    if (format === "svg") {
      return {
        format,
        sourceUrl: candidate.url,
        svg: buffer.toString("utf8"),
      };
    }

    if (format === "png") {
      try {
        PNG.sync.read(buffer);
        return {
          format,
          sourceUrl: candidate.url,
          rasterPng: buffer,
        };
      } catch {
        continue;
      }
    }

    if (format === "ico") {
      try {
        const parsed = await parseICO(buffer, "image/png");
        const largest = [...parsed].sort((left, right) => right.width - left.width)[0];
        if (!largest) {
          continue;
        }
        return {
          format: "png",
          sourceUrl: candidate.url,
          rasterPng: Buffer.from(largest.buffer),
          originalIco: buffer,
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

async function fetchBuffer(url: string): Promise<Buffer> {
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
  return Buffer.from(await response.arrayBuffer());
}

function detectFormat(candidate: IconCandidate, buffer: Buffer): IconFormat | undefined {
  if (candidate.format) {
    return candidate.format;
  }

  const trimmed = buffer.subarray(0, 64).toString("utf8").trimStart().toLowerCase();
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
  if (rel.includes("fallback")) {
    score -= 40;
  }

  return score;
}

function decodeDataUrl(url: string): Buffer {
  const match = url.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) {
    throw new Error("Invalid data URL");
  }

  const isBase64 = Boolean(match[2]);
  const payload = match[3] || "";
  return isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload), "utf8");
}
