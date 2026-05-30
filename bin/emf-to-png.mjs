#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { convert, convertFile } from "../dist/index.js";

const args = process.argv.slice(2);

function help(exit = 0) {
  console.log(`Usage:
  emf-to-png <input.emf> [output.(png|jpg)]
  emf-to-png <input.emf> -o <output.(png|jpg)>

Env options:
  EMF_PNG_WIDTH, EMF_PNG_HEIGHT, EMF_PNG_DPI, EMF_PNG_BG,
  EMF_PNG_FORMAT (png|jpeg), DEBUG=1`);
  process.exit(exit);
}

if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
  help(args.length ? 1 : 0);
}

const input = args[0];

// 1) parse flags first
let output;
const oi = args.indexOf("-o");
const oi2 = args.indexOf("--out");
if (oi !== -1) {
  if (!args[oi + 1] || args[oi + 1].startsWith("-")) {
    console.error("Error: -o requires a file path");
    help(1);
  }
  output = args[oi + 1];
} else if (oi2 !== -1) {
  if (!args[oi2 + 1] || args[oi2 + 1].startsWith("-")) {
    console.error("Error: --out requires a file path");
    help(1);
  }
  output = args[oi2 + 1];
} else {
  // 2) fall back to positional output (second arg)
  output = args[1] && !args[1].startsWith("-") ? args[1] : undefined;
}

const opts = {
  width: process.env.EMF_PNG_WIDTH
    ? Number(process.env.EMF_PNG_WIDTH)
    : undefined,
  height: process.env.EMF_PNG_HEIGHT
    ? Number(process.env.EMF_PNG_HEIGHT)
    : undefined,
  dpi: process.env.EMF_PNG_DPI ? Number(process.env.EMF_PNG_DPI) : undefined,
  background: process.env.EMF_PNG_BG,
  format: process.env.EMF_PNG_FORMAT === "jpeg" ? "jpeg" : "png",
  logger: (m) => process.env.DEBUG && console.error(m),
};

(async () => {
  try {
    if (output) {
      const outPath = await convertFile(input, output, opts).catch(async () => {
        const buf = await convert(await readFile(input), opts);
        const abs = resolve(output);
        await mkdir(dirname(abs), { recursive: true });
        await writeFile(abs, buf);
        return abs;
      });
      console.log(outPath);
    } else {
      const buf = await convert(await readFile(input), opts);
      process.stdout.write(buf);
    }
  } catch (e) {
    console.error(String(e?.stack || e));
    process.exit(1);
  }
})();
