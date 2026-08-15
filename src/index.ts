import { readFile, writeFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { ConvertOptions, InspectResult } from "./types.js";
import {
  EmfToPngError,
  UnsupportedFormatError,
  UnsupportedFeatureError,
  InvalidEmfError,
  ParseError,
  EmfParseError,
  ConversionError,
  WasmInitializationError,
  RasterizationError,
} from "./errors.js";
import { isEmfPlus, readEmfHeader, sniffKind } from "./detect.js";
import { emfOrWmfToSvg } from "./emf2svg.js";
import { rasterizeSvg } from "./svgRaster.js";
import { placeholderImage } from "./placeholder.js";

export type { ConvertOptions, InspectResult } from "./types.js";
export {
  EmfToPngError,
  UnsupportedFormatError,
  UnsupportedFeatureError,
  InvalidEmfError,
  ParseError,
  EmfParseError,
  ConversionError,
  WasmInitializationError,
  RasterizationError,
} from "./errors.js";

export async function convert(
  input: Buffer | Uint8Array,
  options: ConvertOptions = {}
): Promise<Buffer> {
  const logger = options.logger ?? (() => {});
  let info: InspectResult | null = null;
  try {
    const data = input instanceof Uint8Array ? input : new Uint8Array(input);
    info = inspect(data);
    const kind = info.kind;
    if (!kind) throw new UnsupportedFormatError();

    if (info.emfPlus) {
      logger(
        "[emf-to-png] EMF+ records detected; rendering uses classic EMF records only."
      );
    }

    logger(`[emf-to-png] Detected ${kind.toUpperCase()}; converting to SVG...`);
    const svg = await emfOrWmfToSvg(kind, data, options.dpi ?? 96);

    logger("[emf-to-png] Rasterizing SVG...");
    const out = safeRasterizeSvg(svg, options);
    logger("[emf-to-png] Done.");
    return out;
  } catch (err: any) {
    const convertedError =
      info?.emfPlus && err instanceof EmfParseError
        ? new UnsupportedFeatureError(
            "emf+",
            "EMF+ records were detected and this file could not be rendered through the classic EMF path.",
            err
          )
        : err;
    const msg = `[emf-to-png] ${
      convertedError?.code || convertedError?.name || "ERROR"
    }: ${convertedError?.message || convertedError}`;
    logger(msg);
    if (!options.fallback) {
      throw convertedError;
    }
    return placeholderImage("Unsupported EMF", options);
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

export function inspect(input: Buffer | Uint8Array): InspectResult {
  const data = input instanceof Uint8Array ? input : new Uint8Array(input);
  const kind = sniffKind(data);
  const emfPlus = kind === "emf" ? isEmfPlus(data) : false;
  const header = kind === "emf" ? readEmfHeader(data) : null;
  const supported = kind === "emf" && !emfPlus;
  const reason =
    kind === null
      ? "Unsupported format."
      : kind === "wmf"
      ? "WMF support is not built yet."
      : emfPlus
      ? "EMF+ records detected; rendering may be unsupported or partial."
      : undefined;

  return {
    kind,
    bytes: data.length,
    supported,
    emfPlus,
    reason,
    width: header?.bounds.width,
    height: header?.bounds.height,
    bounds: header?.bounds,
    frame: header?.frame,
    records: header?.records,
  };
}

function safeRasterizeSvg(svg: string, options: ConvertOptions): Buffer {
  try {
    return rasterizeSvg(svg, options);
  } catch (err) {
    throw new RasterizationError("Failed to rasterize SVG output.", err);
  }
}
