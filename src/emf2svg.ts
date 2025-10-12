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
    const glueUrl = new URL("./esm/wasm/emf2svg.js", import.meta.url).href;
    const glueMod = await import(glueUrl);
    const f = glueMod.default as (o: any) => Promise<EmscriptenModule>;
    emfFactory = (opts) =>
      f({
        ...opts,
        locateFile: (p: string) => new URL(p, glueUrl).href,
        noInitialRun: true, // ← belt-and-suspenders with INVOKE_RUN=0
        arguments: [], // ← prevent the runtime from using process.argv
        print: (...a: any[]) => console.log("[wasm out]", ...a),
        printErr: (...a: any[]) => console.error("[wasm err]", ...a),
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
  const convertFn = mod.cwrap?.("convert", "number", [
    "number",
    "number",
    "number",
    "number",
    "number",
  ]) as
    | ((
        inPtr: number,
        len: number,
        dpi: number,
        outPtrPtr: number,
        outLenPtr: number
      ) => number)
    | undefined;

  if (!convertFn || !mod._malloc || !mod._free) {
    throw new Error("Direct convert API not exported");
  }

  const heap = getHeap(mod);
  const inPtr = mod._malloc(data.length);
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

  const outPtr = mod.getValue(outPtrPtr, "i32") >>> 0;
  const outLen = mod.getValue(outLenPtr, "i32") >>> 0;

  if (!outPtr || !outLen) {
    mod._free(inPtr);
    mod._free(outPtrPtr);
    mod._free(outLenPtr);
    throw new Error(
      `convert produced empty result (ptr=${outPtr}, len=${outLen})`
    );
  }

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

  // Clean slate
  for (const p of [IN, OUT]) {
    try {
      mod.FS.unlink(p);
    } catch {}
  }
  try {
    mod.FS.mkdir("/tmp");
  } catch {}

  // Write input
  mod.FS.writeFile(IN, data);

  // Sanity: check we can stat/read back exactly
  try {
    const st = mod.FS.stat(IN);
    console.log(`[emf-to-png][cli] wrote ${IN} size=${st.size}`);
    if (st.size !== data.length) {
      throw new Error(
        `[cli] size mismatch: stat(${st.size}) vs buffer(${data.length})`
      );
    }
  } catch (e) {
    console.error("[emf-to-png][cli] STAT FAILED", e);
    console.error("[emf-to-png][cli] / listing:", mod.FS.readdir("/"));
    throw e;
  }

  // Extra visibility
  console.log("[emf-to-png][cli] root listing:", mod.FS.readdir("/"));

  const args = [IN, OUT, "--dpi", String(dpi)];
  const argvPtr = toArgv(mod, ["tool", ...args]); // argv[0] is program name
  const exitCode = mod._main!(args.length + 1, argvPtr);

  console.log(`[emf-to-png][cli] _main exit=${exitCode}`);
  if (exitCode !== 0) {
    throw new Error(`CLI _main exited with code ${exitCode}`);
  }

  const svgBytes = mod.FS.readFile(OUT, { encoding: "binary" });
  return new TextDecoder("utf-8").decode(svgBytes);
}

function toArgv(mod: any, args: string[]) {
  const heap = getHeap(mod);
  const enc = new TextEncoder();

  const bufStr = (s: string) => {
    const bytes = enc.encode(s + "\0");
    const p = mod._malloc(bytes.length);
    heap.set(bytes, p);
    return p;
  };

  // +1 for the NULL terminator
  const argc = args.length;
  const argv = mod._malloc(4 * (argc + 1));
  const HEAP32: Int32Array = mod.HEAP32 ?? new Int32Array(heap.buffer);

  for (let i = 0; i < argc; i++) {
    const p = bufStr(args[i]);
    if (mod.setValue) mod.setValue(argv + i * 4, p, "i32");
    else HEAP32[(argv >> 2) + i] = p;
  }

  // argv[argc] = NULL
  if (mod.setValue) mod.setValue(argv + argc * 4, 0, "i32");
  else HEAP32[(argv >> 2) + argc] = 0;

  return argv;
}

export async function emfOrWmfToSvg(kind: VectorKind, data: Uint8Array, dpi = 96) {
  if (kind !== "emf") throw new Error("WMF support isn’t built yet. Use EMF for now.");
  const mod = await getModule(kind);
  try {
    return await runDirectExport(mod, data, dpi);
  } catch (e) {
    console.error("[emf-to-png] direct convert failed; falling back to CLI:", e);
    // NEW: fresh instance for CLI mode
    const mod2 = await getModule(kind);
    return runCliMain(mod2, kind, data, dpi);
  }
}
