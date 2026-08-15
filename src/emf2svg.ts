import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { VectorKind } from "./detect.js";
import {
  EmfParseError,
  UnsupportedFeatureError,
  WasmInitializationError,
} from "./errors.js";

type EmscriptenModule = {
  HEAPU8?: Uint8Array;
  HEAP8?: Int8Array;
  HEAP32?: Int32Array;
  asm?: { memory?: WebAssembly.Memory };
  wasmMemory?: WebAssembly.Memory;
  memory?: WebAssembly.Memory;
  _malloc: (n: number) => number;
  _free: (ptr: number) => void;
  _convert?: (
    ptr: number,
    len: number,
    dpi: number,
    outPtrPtr: number,
    outLenPtr: number
  ) => number;
  getValue: (ptr: number, type: "i32" | "i8" | "double" | string) => number;
  cwrap?: (...args: any[]) => any;
};

let emfFactory: ((opts?: any) => Promise<EmscriptenModule>) | null = null;

function getHeap(mod: EmscriptenModule): Uint8Array {
  if (mod.HEAPU8) return mod.HEAPU8;
  if (mod.HEAP8) return new Uint8Array(mod.HEAP8.buffer);

  const memBuf =
    mod.asm?.memory?.buffer ?? mod.wasmMemory?.buffer ?? mod.memory?.buffer;
  if (memBuf instanceof ArrayBuffer) return new Uint8Array(memBuf);

  throw new WasmInitializationError("WASM heap view is not available");
}

async function fileExists(url: URL): Promise<boolean> {
  try {
    await access(fileURLToPath(url));
    return true;
  } catch {
    return false;
  }
}

async function resolveWasmGlue(): Promise<URL> {
  const candidates = [
    new URL("../wasm/emf2svg.js", import.meta.url),
    new URL("./wasm/emf2svg.js", import.meta.url),
  ];

  for (const candidate of candidates) {
    if (candidate.protocol === "file:" && (await fileExists(candidate))) {
      return candidate;
    }
  }

  throw new WasmInitializationError(
    "Could not find bundled emf2svg WASM files. Run `npm run build:wasm:emf` first."
  );
}

async function getModule(kind: VectorKind): Promise<EmscriptenModule> {
  if (kind !== "emf") {
    throw new UnsupportedFeatureError(
      "wmf",
      "WMF support is not built yet. Use EMF files for now."
    );
  }

  if (!emfFactory) {
    const glueUrl = await resolveWasmGlue();
    const glueMod = await import(glueUrl.href).catch((err) => {
      throw new WasmInitializationError(
        "Failed to import bundled emf2svg WASM glue.",
        err
      );
    });
    const factory = glueMod.default as (opts?: any) => Promise<EmscriptenModule>;

    emfFactory = (opts) =>
      factory({
        ...opts,
        locateFile: (p: string) => new URL(p, glueUrl).href,
        noInitialRun: true,
        arguments: [],
        print: () => {},
        printErr: () => {},
      });
  }

  return emfFactory({}).catch((err) => {
    throw new WasmInitializationError(
      "Failed to initialize bundled emf2svg WASM module.",
      err
    );
  });
}

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
          inPtr: number,
          len: number,
          dpi: number,
          outPtrPtr: number,
          outLenPtr: number
        ) => number)
      | undefined);

  if (!convertFn) {
    throw new WasmInitializationError(
      "Direct convert API is not exported by the WASM module"
    );
  }

  const inPtr = mod._malloc(data.length + 1);
  const outPtrPtr = mod._malloc(4);
  const outLenPtr = mod._malloc(4);

  try {
    const heap = getHeap(mod);
    heap.set(data, inPtr);
    heap[inPtr + data.length] = 0;

    const rc = convertFn(inPtr, data.length, dpi, outPtrPtr, outLenPtr);
    if (rc !== 0) {
      throw new EmfParseError(`emf2svg convert returned ${rc}`);
    }

    const outPtr = mod.getValue(outPtrPtr, "i32") >>> 0;
    const outLen = mod.getValue(outLenPtr, "i32") >>> 0;
    if (!outPtr || !outLen) {
      throw new EmfParseError(
        `emf2svg produced empty output (ptr=${outPtr}, len=${outLen})`
      );
    }

    const svg = new TextDecoder("utf-8").decode(
      getHeap(mod).slice(outPtr, outPtr + outLen)
    );
    mod._free(outPtr);
    return normalizeSvg(svg);
  } finally {
    mod._free(inPtr);
    mod._free(outPtrPtr);
    mod._free(outLenPtr);
  }
}

export async function emfOrWmfToSvg(
  kind: VectorKind,
  data: Uint8Array,
  dpi = 96
): Promise<string> {
  const mod = await getModule(kind);
  return runDirectExport(mod, data, dpi);
}

function normalizeSvg(svg: string): string {
  return svg.replace(/"(?=xmlns:)/g, '" ');
}
