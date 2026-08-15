import { Resvg } from "@resvg/resvg-js";
import { rasterizeSvg } from "./svgRaster.js";
import type { ConvertOptions } from "./types.js";

export function placeholderPng(
  text = "Unsupported EMF",
  w = 800,
  h = 400,
  bg = "transparent"
): Buffer {
  const svg = placeholderSvg(text, w, h, bg);
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: w } });
  return Buffer.from(resvg.render().asPng());
}

export function placeholderImage(
  text = "Unsupported EMF",
  opts: ConvertOptions = {}
): Buffer {
  const width = opts.width ?? 800;
  const height = opts.height ?? 400;
  const background = opts.background ?? (opts.format === "jpeg" ? "#ffffff" : "transparent");
  return rasterizeSvg(placeholderSvg(text, width, height, background), {
    ...opts,
    width,
    height,
    background,
    fit: "contain",
  });
}

function placeholderSvg(text: string, w: number, h: number, bg: string): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#888">
    ${escapeXml(text)}
  </text>
</svg>`;
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
