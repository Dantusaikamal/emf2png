// src/emf2svg.ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { VectorKind } from "./detect.js";

type EmscriptenModule = {
  HEAPU8: Uint8Array;
  _malloc: (n: number) => number;
  _free: (ptr: number) => void;
  getValue: (ptr: number, type: "i32" | "i8" | "double" | string) => number;
  setValue?: (ptr: number, v: number, type: string) => void;
  _convert?: (
    ptr: number,
    len: number,
    dpi: number,
    outPtrPtr: number,
    outLenPtr: number
  ) => number;
  _main?: (argc?: number, argvPtr?: number) => number;
  FS?: any;
  cwrap?: (...args: any[]) => any;
};

let emfFactory: ((opts?: any) => Promise<EmscriptenModule>) | null = null;

function getHeap(mod: any): Uint8Array {
  // Try the common locations in priority order.
  // Works with traditional runtime and minimal runtime.
  if (mod.HEAPU8) return mod.HEAPU8 as Uint8Array;
  if (mod.HEAP8) return new Uint8Array(mod.HEAP8.buffer);

  // Minimal runtime often exposes memory on asm or wasmMemory
  const memBuf =
    mod.asm?.memory?.buffer ?? mod.wasmMemory?.buffer ?? mod.memory?.buffer;

  if (memBuf instanceof ArrayBuffer) return new Uint8Array(memBuf);

  throw new Error(
    "WASM heap view not available (no HEAPU8/HEAP8/asm.memory/wasmMemory)"
  );
}

async function getModule(kind: VectorKind): Promise<EmscriptenModule> {
  if (kind !== "emf")
    throw new Error("WMF support isn’t built yet. Use EMF files for now.");

  if (!emfFactory) {
    // IMPORTANT: keep the glue and .wasm under dist/<esm|cjs>/wasm/
    const glueUrl = new URL("./esm/wasm/emf2svg.js", import.meta.url).href;
    const glueMod = await import(glueUrl);
    const f = glueMod.default as (o: any) => Promise<EmscriptenModule>;
    emfFactory = (opts) =>
      f({
        ...opts,
        // Make sure the glue can find the .wasm no matter where we call from
        locateFile: (p: string) => new URL(p, glueUrl).href,
      });
  }
  return emfFactory({});
}
function wasmBytes(name: string): Uint8Array {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const p = join(__dirname, "..", "wasm", name);
  return new Uint8Array(readFileSync(p));
}

/**
 * Preferred: direct-export mode (Module._convert).
 */
async function runDirectExport(
  mod: EmscriptenModule,
  data: Uint8Array,
  dpi: number
): Promise<string> {
  const convertFn =
    mod._convert ??
    (mod.cwrap?.("convert", "number", [
      "number",
      "number",
      "number",
      "number",
      "number",
    ]) as
      | ((
          ptr: number,
          len: number,
          dpi: number,
          outPtrPtr: number,
          outLenPtr: number
        ) => number)
      | undefined);

  if (!convertFn || !mod._malloc || !mod._free) {
    throw new Error("Direct convert API not exported");
  }

  const inPtr = mod._malloc(data.length);
  const heap = getHeap(mod);
  heap.set(data, inPtr);
  const outPtrPtr = mod._malloc(4);
  const outLenPtr = mod._malloc(4);

  const rc = convertFn(inPtr, data.length, dpi, outPtrPtr, outLenPtr);
  if (rc !== 0) {
    mod._free(inPtr);
    mod._free(outPtrPtr);
    mod._free(outLenPtr);
    throw new Error(`convert returned ${rc}`);
  }
  const outPtr = mod.getValue(outPtrPtr, "i32");
  const outLen = mod.getValue(outLenPtr, "i32");

  const svg = new TextDecoder("utf-8").decode(
    heap.slice(outPtr, outPtr + outLen)
  );
  mod._free(outPtr);
  mod._free(inPtr);
  mod._free(outPtrPtr);
  mod._free(outLenPtr);
  return svg;
}
/**
 * CLI-mode: write to MEMFS, call `_main` of the CLI tool (emf2svg/wmf2svg), read back /out.svg.
 * We try common argument patterns; adjust if your tool expects different flags.
 */
async function runCliMain(
  mod: EmscriptenModule,
  kind: VectorKind,
  data: Uint8Array,
  dpi: number
): Promise<string> {
  if (!mod.FS || !mod._main) {
    throw new Error("CLI mode not available (no FS/_main)");
  }
  const IN = kind === "emf" ? "/in.emf" : "/in.wmf";
  const OUT = "/out.svg";

  // Reset FS state between runs if needed
  try {
    mod.FS.unlink(IN);
  } catch {}
  try {
    mod.FS.unlink(OUT);
  } catch {}
  try {
    mod.FS.mkdir("/tmp");
  } catch {}

  mod.FS.writeFile(IN, data);

  // Try typical CLI args: <input> <output> --dpi <dpi>
  const args = [IN, OUT, "--dpi", String(dpi)];
  const exitCode = mod._main!(args.length + 1, toArgv(mod, ["tool", ...args]));
  if (exitCode !== 0) {
    throw new Error(`CLI _main exited with code ${exitCode}`);
  }
  const svgBytes = mod.FS.readFile(OUT, { encoding: "binary" });
  return new TextDecoder("utf-8").decode(svgBytes);
}

function toArgv(mod: any, args: string[]) {
  // Allocate argv in Emscripten heap
  const heap = getHeap(mod);
  const argvPtrs: number[] = [];
  const buf = (s: string) => {
    const str = new TextEncoder().encode(s + "\0");
    const ptr = mod._malloc(str.length);
    heap.set(str, ptr);
    return ptr;
  };
  const argv = mod._malloc(4 * args.length);
  args.forEach((a: string, i: number) => {
    argvPtrs[i] = buf(a);
    mod.setValue ? mod.setValue(argv + i * 4, argvPtrs[i], "i32") : heap; // no-op fallback when setValue missing
    // fallback not needed if setValue exists; Emscripten JS glue normally provides setValue
  });
  return argv;
}

// src/emf2svg.ts
export async function emfOrWmfToSvg(
  kind: VectorKind,
  data: Uint8Array,
  dpi = 96
): Promise<string> {
  const mod = await getModule(kind);

  if (typeof (mod as any)._convert === "function")
    return runDirectExport(mod, data, dpi);
  if ((mod as any)._main && (mod as any).FS)
    return runCliMain(mod, kind, data, dpi);

  throw new Error(
    "No convert entry in wasm module (missing _convert and _main). Rebuild the wasm with one of them exported."
  );
}
