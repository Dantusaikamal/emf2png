import { Resvg } from "@resvg/resvg-js";

export function placeholderPng(
  text = "Unsupported EMF",
  w = 800,
  h = 400,
  bg = "transparent"
): Buffer {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#888">
    ${escapeXml(text)}
  </text>
</svg>`;
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: w } });
  return Buffer.from(resvg.render().asPng());
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
