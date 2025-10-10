import { readFile, writeFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { ConvertOptions } from "./types.js";
import {
  UnsupportedFormatError,
  ParseError,
  ConversionError,
} from "./errors.js";
import { sniffKind } from "./detect.js";
import { emfOrWmfToSvg } from "./emf2svg.js";
import { rasterizeSvg } from "./svgRaster.js";
import { placeholderPng } from "./placeholder.js";

export type { ConvertOptions } from "./types.js";
export {
  UnsupportedFormatError,
  ParseError,
  ConversionError,
} from "./errors.js";

export async function convert(
  input: Buffer | Uint8Array,
  options: ConvertOptions = {}
): Promise<Buffer> {
  const logger = options.logger ?? (() => {});
  try {
    const data = input instanceof Uint8Array ? input : new Uint8Array(input);
    const kind = sniffKind(data);
    if (!kind) throw new UnsupportedFormatError();

    logger(`[emf-to-png] Detected ${kind.toUpperCase()}; converting to SVG...`);
    const svg = await emfOrWmfToSvg(kind, data, options.dpi ?? 96);

    logger("[emf-to-png] Rasterizing SVG...");
    const out = rasterizeSvg(svg, options);
    logger("[emf-to-png] Done.");
    return out;
  } catch (err: any) {
    // graceful fallback
    const msg = `[emf-to-png] ${err?.code || err?.name || "ERROR"}: ${
      err?.message || err
    }`;
    (options.logger ?? (() => {}))(msg);
    const png = placeholderPng(
      "Unsupported EMF",
      options.width ?? 800,
      options.height ?? 400,
      options.background ?? "transparent"
    );
    return png;
  }
}

export async function convertFile(
  inputPath: string,
  outputPath?: string,
  options: ConvertOptions = {}
): Promise<string> {
  const buf = await readFile(inputPath);
  const outBuf = await convert(buf, options);
  let outPath = outputPath;
  if (!outPath) {
    const ext = options.format === "jpeg" ? ".jpg" : ".png";
    const base = basename(inputPath, extname(inputPath));
    outPath = base + ext;
  }
  await writeFile(outPath, outBuf);
  return outPath;
}

export { emfOrWmfToSvg } from "./emf2svg.js";
