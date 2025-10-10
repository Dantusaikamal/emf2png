import { Resvg } from "@resvg/resvg-js";
import jpeg from "jpeg-js";
import type { ConvertOptions } from "./types.js";

export function rasterizeSvg(svg: string, opts: ConvertOptions = {}): Buffer {
  const { width, height, background, format = "png" } = opts;
  const fitTo = width
    ? { mode: "width" as const, value: width }
    : height
    ? { mode: "height" as const, value: height }
    : undefined;

  const resvg = new Resvg(svg, {
    background: background ?? undefined,
    fitTo,
  });

  const img = resvg.render();

  if (format === "png") {
    return Buffer.from(img.asPng());
  } else {
    const { data, width: w, height: h } = img.asRaw(); // RGBA
    const raw = Buffer.from(data);
    const jpegBuf = jpeg.encode({ data: raw, width: w, height: h }, 90).data;
    return Buffer.from(jpegBuf);
  }
}
