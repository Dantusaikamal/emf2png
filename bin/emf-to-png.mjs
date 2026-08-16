#!/usr/bin/env node
import { readFile, mkdir } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { convert, convertFile } from "../dist/index.js";

const args = process.argv.slice(2);

function help(exit = 0) {
  console.log(`Usage:
  emf-to-png <input.emf> [output.(png|jpg)]
  emf-to-png <input.emf> -o <output.(png|jpg)>

Env options:
  EMF_PNG_WIDTH, EMF_PNG_HEIGHT, EMF_PNG_DPI, EMF_PNG_BG,
  EMF_PNG_FORMAT (png|jpeg), EMF_PNG_QUALITY, DEBUG=1

Flags:
  --width <px>       Output width
  --height <px>      Output height
  --dpi <n>          Input DPI, default 96
  --background <css> Background color
  --format <fmt>     png or jpeg
  --quality <1-100>  JPEG quality, default 90
  --fit <mode>       width, height, or contain
  --fallback         Return a placeholder image on failure`);
  process.exit(exit);
}

if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
  help(0);
}

const input = args[0];
if (!input || input.startsWith("-")) {
  console.error("Error: input EMF path is required");
  help(1);
}

let output;
const flags = parseFlags(args.slice(1));
output = flags.output ?? flags.positionals[0];

const inferredFormat = output && [".jpg", ".jpeg"].includes(extname(output).toLowerCase())
  ? "jpeg"
  : undefined;

const opts = {
  width: numberOption(flags.width, process.env.EMF_PNG_WIDTH, "width"),
  height: numberOption(flags.height, process.env.EMF_PNG_HEIGHT, "height"),
  dpi: numberOption(flags.dpi, process.env.EMF_PNG_DPI, "dpi"),
  background: flags.background ?? process.env.EMF_PNG_BG,
  format:
    flags.format ??
    normalizeOptionalChoice(process.env.EMF_PNG_FORMAT, ["png", "jpeg"], "EMF_PNG_FORMAT") ??
    inferredFormat ??
    "png",
  quality: numberOption(flags.quality, process.env.EMF_PNG_QUALITY, "quality"),
  fit: flags.fit,
  fallback: flags.fallback,
  logger: (m) => process.env.DEBUG && console.error(m),
};

(async () => {
  try {
    if (output) {
      const abs = resolve(output);
      await mkdir(dirname(abs), { recursive: true });
      console.log(await convertFile(input, abs, opts));
    } else {
      const buf = await convert(await readFile(input), opts);
      process.stdout.write(buf);
    }
  } catch (e) {
    console.error(String(e?.stack || e));
    process.exit(1);
  }
})();

function parseFlags(rest) {
  const flags = { positionals: [] };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg.startsWith("-")) {
      flags.positionals.push(arg);
      continue;
    }

    const [name, inlineValue] = arg.split("=", 2);
    const readValue = () => {
      if (inlineValue !== undefined) return inlineValue;
      const value = rest[i + 1];
      if (!value || value.startsWith("-")) {
        console.error(`Error: ${name} requires a value`);
        help(1);
      }
      i++;
      return value;
    };

    switch (name) {
      case "-o":
      case "--out":
        flags.output = readValue();
        break;
      case "--width":
        flags.width = readValue();
        break;
      case "--height":
        flags.height = readValue();
        break;
      case "--dpi":
        flags.dpi = readValue();
        break;
      case "--background":
      case "--bg":
        flags.background = readValue();
        break;
      case "--format":
        flags.format = normalizeChoice(readValue(), ["png", "jpeg"], "--format");
        break;
      case "--quality":
        flags.quality = readValue();
        break;
      case "--fit":
        flags.fit = normalizeChoice(readValue(), ["width", "height", "contain"], "--fit");
        break;
      case "--fallback":
        flags.fallback = true;
        break;
      default:
        console.error(`Error: unknown option ${name}`);
        help(1);
    }
  }
  return flags;
}

function numberOption(flagValue, envValue, name) {
  const values = [flagValue, envValue];
  const value = values.find((v) => v !== undefined && v !== "");
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    console.error(`Error: ${name} must be a number`);
    help(1);
  }
  return n;
}

function normalizeChoice(value, choices, flag) {
  const normalized = String(value).toLowerCase();
  if (normalized === "jpg") return "jpeg";
  if (!choices.includes(normalized)) {
    console.error(`Error: ${flag} must be one of ${choices.join(", ")}`);
    help(1);
  }
  return normalized;
}

function normalizeOptionalChoice(value, choices, name) {
  if (!value) return undefined;
  return normalizeChoice(value, choices, name);
}
