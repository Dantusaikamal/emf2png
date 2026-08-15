import { Resvg } from "@resvg/resvg-js";
import jpeg from "jpeg-js";
import type { ConvertOptions } from "./types.js";

export function rasterizeSvg(svg: string, opts: ConvertOptions = {}): Buffer {
  const { width, height, background, format = "png" } = opts;
  const fitTo = resolveFitTo(svg, opts);

  const resvg = new Resvg(svg, {
    background: background ?? undefined,
    fitTo,
  });

  const img = resvg.render();

  if (format === "png") {
    return Buffer.from(img.asPng());
  } else {
    const raw = Buffer.from(img.pixels); // RGBA
    const jpegBuf = jpeg.encode(
      { data: raw, width: img.width, height: img.height },
      clampQuality(opts.quality)
    ).data;
    return Buffer.from(jpegBuf);
  }
}

function resolveFitTo(svg: string, opts: ConvertOptions) {
  const { width, height, fit } = opts;
  if (width && height && (fit ?? "contain") === "contain") {
    const probe = new Resvg(svg);
    if (!probe.width || !probe.height) {
      return { mode: "width" as const, value: width };
    }
    const scale = Math.min(width / probe.width, height / probe.height);
    return { mode: "zoom" as const, value: scale };
  }
  if (height && fit === "height") {
    return { mode: "height" as const, value: height };
  }
  if (width) {
    return { mode: "width" as const, value: width };
  }
  if (height) {
    return { mode: "height" as const, value: height };
  }
  return undefined;
}

function clampQuality(quality = 90): number {
  if (!Number.isFinite(quality)) return 90;
  return Math.max(1, Math.min(100, Math.round(quality)));
}
