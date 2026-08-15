# Technical Notes for Blog Article

This document is a factual source document for writing about the implementation
of `emf-to-png`. It is not written as a marketing blog post.

## 1. Real Problem This Package Solves

The package solves a specific Node.js/server-side image conversion problem:
turning EMF files into PNG or JPEG buffers without depending on Microsoft
Office, LibreOffice, Inkscape, or a desktop graphics stack.

The motivating use case is DOCX extraction. When a `.docx` file is unpacked,
some embedded images can appear as `.emf` files. Those files are vector graphics
in Windows Enhanced Metafile format. In many Node.js pipelines, the desired
output is not EMF; it is a web-safe raster format like PNG.

The public API exposes this as:

```ts
convert(input: Buffer | Uint8Array, options?: ConvertOptions): Promise<Buffer>
convertFile(inputPath: string, outputPath?: string, options?: ConvertOptions): Promise<string>
```

These functions are implemented in `src/index.ts`.

## 2. Why EMF Files Appear When Extracting Images from DOCX Files

DOCX files are ZIP containers. Embedded media can be stored under paths such as
`word/media/`. Microsoft Office documents may contain vector drawings, equations,
diagrams, or pasted Windows graphics as EMF. When the DOCX is extracted, those
objects can surface directly as `.emf` files instead of `.png` or `.jpg`.

The problem is not extracting the bytes. The problem is rendering the EMF format
in a Node.js process after extraction.

## 3. Why Office, LibreOffice, and Inkscape Were Not Ideal

The package intentionally avoids shelling out to Office, LibreOffice, or
Inkscape. The reasons are mostly operational:

- Office is not a normal server-side dependency and is not practical for Linux
  or headless CI/server deployments.
- LibreOffice can convert many office formats, but it is heavy, starts slowly,
  and introduces process management concerns in a Node.js pipeline.
- Inkscape is also a large native dependency and may require installation,
  version management, and runtime availability on every target platform.
- A Node package should ideally work after `npm install`, not after users
  configure a desktop conversion toolchain.

The architecture therefore uses a bundled WebAssembly renderer plus a Node
rasterizer.

## 4. Package Architecture

The conversion pipeline is:

```text
EMF bytes
  -> format sniffing
  -> libemf2svg compiled to WebAssembly
  -> SVG string
  -> @resvg/resvg-js rasterization
  -> PNG or JPEG Buffer
```

Important files:

- `src/index.ts`: public `convert()` and `convertFile()` APIs.
- `src/detect.ts`: lightweight EMF/WMF signature detection.
- `src/emf2svg.ts`: Emscripten/WebAssembly bridge for EMF to SVG.
- `src/svgRaster.ts`: SVG to PNG/JPEG rasterization.
- `src/placeholder.ts`: optional placeholder PNG path when `fallback: true`.
- `bin/emf-to-png.mjs`: CLI entrypoint.
- `scripts/build-wasm.emf.ps1`: Docker/Emscripten build script for
  `libemf2svg`.
- `scripts/build-wasm.emf.mjs`: cross-platform Node launcher for the PowerShell
  build script.
- `scripts/postbuild-copy-wasm.mjs`: copies `wasm/emf2svg.*` into
  `dist/wasm`.
- `scripts/clean.mjs`: cross-platform cleanup for `dist`, generated WASM glue,
  and `.work-*` build directories.

The npm package is ESM-only:

```json
{
  "type": "module",
  "main": "./dist/index.js",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./cli": "./bin/emf-to-png.mjs"
  }
}
```

## 5. Internal EMF Conversion Pipeline

`convert()` in `src/index.ts` receives a `Buffer` or `Uint8Array`.

It first normalizes the input:

```ts
const data = input instanceof Uint8Array ? input : new Uint8Array(input);
```

It then calls `sniffKind(data)` from `src/detect.ts`. EMF detection checks for
the common EMF signature bytes at offsets `40..43`:

```ts
if (a === 0x20 && b === 0x45 && c === 0x4d && d === 0x46) return "emf";
```

Before conversion, `src/index.ts` validates user-facing numeric options:

```ts
validatePositiveNumber(options.width, "width");
validatePositiveNumber(options.height, "height");
validatePositiveNumber(options.dpi, "dpi");
```

Invalid `width`, `height`, or `dpi` values throw `ConversionError` before
fallback behavior is considered.

After detection:

```ts
const svg = await emfOrWmfToSvg(kind, data, options.dpi ?? 96);
const out = rasterizeSvg(svg, options);
```

`emfOrWmfToSvg()` is exported from `src/emf2svg.ts`. Despite the historical name,
the current implementation only supports `kind === "emf"`. If called with WMF,
it throws:

```ts
throw new UnsupportedFeatureError(
  "wmf",
  "WMF support is not built yet. Use EMF files for now."
);
```

## 6. How WebAssembly Is Used

The EMF renderer is compiled with Emscripten into:

```text
wasm/emf2svg.js
wasm/emf2svg.wasm
```

During packaging, `scripts/postbuild-copy-wasm.mjs` copies these into:

```text
dist/wasm/emf2svg.js
dist/wasm/emf2svg.wasm
```

`src/emf2svg.ts` loads the generated Emscripten glue dynamically:

```ts
const glueMod = await import(glueUrl.href);
const factory = glueMod.default as (opts?: any) => Promise<EmscriptenModule>;
```

The Emscripten factory is configured with:

```ts
locateFile: (p: string) => new URL(p, glueUrl).href,
noInitialRun: true,
arguments: [],
print: () => {},
printErr: () => {},
```

The bridge calls the exported native conversion function directly. The function
signature expected by TypeScript is:

```ts
_convert(ptr, len, dpi, outPtrPtr, outLenPtr) => number
```

`runDirectExport()` allocates memory in the WASM heap:

```ts
const inPtr = mod._malloc(data.length + 1);
const outPtrPtr = mod._malloc(4);
const outLenPtr = mod._malloc(4);
```

The input bytes are copied into the WASM heap and a NUL byte is appended:

```ts
heap.set(data, inPtr);
heap[inPtr + data.length] = 0;
```

The NUL byte is a defensive compatibility detail because the underlying C code
accepts a byte pointer but may pass it through code paths that treat it like a
C string.

After `_convert()` returns, the JS bridge reads the output pointer and length:

```ts
const outPtr = mod.getValue(outPtrPtr, "i32") >>> 0;
const outLen = mod.getValue(outLenPtr, "i32") >>> 0;
```

The SVG bytes are decoded with `TextDecoder`, then the native output buffer and
temporary pointer buffers are freed.

## 7. How libemf2svg Is Bundled

The build process clones upstream `libemf2svg` during the WASM build:

```text
git clone --depth=1 https://github.com/kakwa/libemf2svg.git
```

This happens inside the Docker build script generated by
`scripts/build-wasm.emf.ps1`.

The build script also includes selected vendored `libuemf` sources from the
upstream repository:

```text
vendor/libuemf/uemf_utf.c
vendor/libuemf/uemf_endian.c
vendor/libuemf/uemf.c
vendor/libuemf/upmf.c
```

The script creates a small C wrapper at build time:

```c
int convert(const uint8_t* in, int len, int dpi, uint8_t** out, int* out_len)
```

That wrapper calls `emf2svg()` from `libemf2svg` and adapts the return convention
to a Node-friendly exported function. `libemf2svg` returns `1` on success; the
wrapper returns `0` on success for the JS side:

```c
if (rc != 1 || !svg || L == 0) return rc == 1 ? 99 : 1;
*out=(uint8_t*)svg; *out_len=(int)L; return 0;
```

The wrapper sets generator options:

```c
opt.verbose=0;
opt.emfplus=0;
opt.nameSpace="svg";
opt.svgDelimiter=1;
opt.imgWidth=0;
opt.imgHeight=0;
```

There is also a header-only `fontconfig` shim generated in
`scripts/build-wasm.emf.ps1`. It supplies minimal no-op definitions needed by
`libemf2svg` during compilation.

## 8. SVG Rasterization with @resvg/resvg-js

Rasterization is implemented in `src/svgRaster.ts`.

The function:

```ts
export function rasterizeSvg(svg: string, opts: ConvertOptions = {}): Buffer
```

uses:

```ts
import { Resvg } from "@resvg/resvg-js";
```

Sizing is mapped into `resvg`'s `fitTo` option:

```ts
const fitTo = width
  ? { mode: "width" as const, value: width }
  : height
  ? { mode: "height" as const, value: height }
  : undefined;
```

For PNG:

```ts
return Buffer.from(img.asPng());
```

For JPEG, the code asks `resvg` for RGBA pixels and encodes them with
`jpeg-js`:

```ts
const effectiveBackground =
  background ?? (format === "jpeg" ? "#ffffff" : undefined);
const raw = Buffer.from(img.pixels);
const jpegBuf = jpeg.encode(
  { data: raw, width: img.width, height: img.height },
  clampQuality(opts.quality)
).data;
```

JPEG quality is exposed through `ConvertOptions.quality` and clamped to `1..100`.
If no background is supplied for JPEG output, `src/svgRaster.ts` uses white
instead of leaving transparent SVG areas dependent on discarded alpha data.

## 9. CLI Design

The CLI entrypoint is `bin/emf-to-png.mjs`.

It imports the built package:

```js
import { convert, convertFile } from "../dist/index.js";
```

Supported forms:

```bash
emf-to-png <input.emf> [output.(png|jpg)]
emf-to-png <input.emf> -o <output.(png|jpg)>
```

Common flags:

```bash
--width <px>
--height <px>
--dpi <n>
--background <css>
--format <png|jpeg>
--quality <1-100>
--fit <width|height|contain>
--fallback
```

If an output path is provided, the CLI writes to a file via `convertFile()`.
If no output is provided, it writes the image bytes to `stdout`:

```js
process.stdout.write(buf);
```

Environment variables are used for options:

```text
EMF_PNG_WIDTH
EMF_PNG_HEIGHT
EMF_PNG_DPI
EMF_PNG_BG
EMF_PNG_FORMAT
EMF_PNG_QUALITY
DEBUG
```

`DEBUG=1` enables log output through the `logger` option.

The CLI intentionally documents EMF only. WMF is not implemented by the runtime
yet.

## 10. API Design

The main API is intentionally small:

- `convert(input, options)`: returns a PNG or JPEG `Buffer`.
- `convertFile(inputPath, outputPath, options)`: reads an input file, writes the
  converted output, and returns the output path.
- `emfOrWmfToSvg(kind, data, dpi)`: lower-level SVG conversion hook.
- `inspect(input)`: returns format/support metadata without rendering.

The options are defined in `src/types.ts`:

```ts
export interface ConvertOptions {
  width?: number;
  height?: number;
  background?: string;
  dpi?: number;
  antialias?: boolean;
  format?: "png" | "jpeg";
  quality?: number;
  fit?: "width" | "height" | "contain";
  fallback?: boolean;
  logger?: (msg: string) => void;
}
```

`convertFile()` infers the output format from the output extension when
`options.format` is not explicitly supplied:

```ts
format: options.format ?? inferFormatFromPath(outPath) ?? "png"
```

So `convertFile("a.emf", "a.jpg")` writes JPEG bytes, while an explicit
`options.format` still takes precedence.

## 11. Important Limitations

WMF:

- `src/detect.ts` can detect a placeable WMF header.
- `src/emf2svg.ts` rejects WMF with an explicit error.
- The package should not claim stable WMF support yet.

EMF+:

- `src/detect.ts` includes `isEmfPlus()`, which scans EMF records for
  `EMR_GDICOMMENT` records containing the `"EMF+"` signature.
- `EMR_GDICOMMENT` stores a `DataSize` DWORD before the comment bytes, so the
  `"EMF+"` signature is checked at `recordOffset + 12`, not `recordOffset + 8`.
- `convert()` calls `inspect()` and logs when EMF+ records are present. If an
  EMF+ file fails through the classic EMF path with `EmfParseError`, the error
  is wrapped as `UnsupportedFeatureError`.
- The WASM wrapper sets `opt.emfplus=0`, so EMF+ handling is not enabled.

Advanced EMF records:

- The implementation depends on upstream `libemf2svg` coverage.
- Some application-specific or uncommon records may fail or render
  imperfectly.

Fallback behavior:

- By default, errors throw.
- If `fallback: true`, `src/index.ts` calls `placeholderImage()` from
  `src/placeholder.ts`.
- The placeholder is an SVG rendered with `@resvg/resvg-js`, containing the text
  `"Unsupported EMF"`.

SVG normalization:

- `src/emf2svg.ts` has a `normalizeSvg()` helper:

  ```ts
  return svg.replace(/"(?=xmlns:)/g, '" ');
  ```

- This works around malformed adjacent XML namespace attributes emitted by the
  upstream SVG output in tested cases.

## 12. Build Process and Docker/WASM Details

Main scripts from `package.json`:

```json
{
  "clean": "node scripts/clean.mjs",
  "build:wasm:emf": "node scripts/build-wasm.emf.mjs",
  "build:wasm": "npm run build:wasm:emf",
  "build:js": "tsup src/index.ts --format esm --dts --clean",
  "build": "npm run build:wasm && npm run build:js && node scripts/postbuild-copy-wasm.mjs",
  "test": "vitest run",
  "test:pack": "node scripts/smoke-packed.mjs",
  "prepublishOnly": "npm run clean && npm run build && npm test && npm run test:pack"
}
```

`scripts/build-wasm.emf.mjs` launches PowerShell or `pwsh` and runs
`scripts/build-wasm.emf.ps1`.

`scripts/build-wasm.emf.ps1`:

- checks Docker availability,
- removes and recreates `wasm/` and `.work-emf/`,
- writes a generated bash build script,
- runs `emscripten/emsdk:latest` with Docker,
- clones `libemf2svg`,
- generates shims and a wrapper,
- compiles with `emcc`,
- writes `wasm/emf2svg.js` and `wasm/emf2svg.wasm`.

Important Emscripten flags:

```text
-s MODULARIZE=1
-s EXPORT_ES6=1
-s ENVIRONMENT=node
-s FORCE_FILESYSTEM=1
-s ALLOW_MEMORY_GROWTH=1
-s INITIAL_MEMORY=256MB
-s STACK_SIZE=2MB
-s INVOKE_RUN=0
-s EXIT_RUNTIME=1
-s EXPORTED_FUNCTIONS='["_malloc","_free","_convert"]'
-s EXPORTED_RUNTIME_METHODS='["getValue","setValue","FS","HEAPU8","HEAP8","HEAP32","cwrap","ccall"]'
-s USE_ZLIB=1
-s USE_FREETYPE=1
-s USE_LIBPNG=1
```

## 13. Testing Strategy

Tests are in `test/convert.test.ts` and run with Vitest.

They verify:

- EMF bytes convert to SVG.
- SVG contains expected SVG/path markers.
- SVG normalization removed the malformed `"xmlns:` sequence.
- `test1.emf` converts to a PNG buffer.
- `test1.emf` converts to a JPEG buffer.
- `test2.emf` converts to a PNG buffer.
- invalid input throws `UnsupportedFormatError` by default.
- invalid input can return a placeholder image with `fallback: true`.
- fallback JPEG output has JPEG magic bytes.
- synthetic EMF+ data is detected at the correct `EMR_GDICOMMENT` signature
  offset.
- `convertFile()` infers JPEG from `.jpg` output paths.
- invalid `width`, `height`, and `dpi` options throw `ConversionError`.
- WMF input throws `UnsupportedFeatureError`.
- `scripts/smoke-packed.mjs` installs the packed npm tarball in a temporary
  project, imports `emf-to-png`, and converts a real EMF fixture.

PNG validation checks the PNG magic number:

```ts
expect(buf.slice(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
```

The tests intentionally avoid only checking "some PNG came back" for valid EMF
input, because fallback placeholders are also PNGs.

## 14. Engineering Trade-offs

Bundled WASM instead of native binaries:

- Avoids publishing platform-specific native addons.
- Keeps install simple for users.
- Pushes complexity into the build pipeline.

`libemf2svg` instead of writing a renderer:

- Reuses an existing EMF parser/renderer.
- Limits output quality to upstream record support.
- Requires adaptation because the library was not designed primarily as a Node
  package dependency.

SVG intermediate:

- Makes the pipeline easier to inspect and test.
- Allows `resvg` to handle rasterization.
- Adds a second stage where SVG validity matters.

ESM-only package:

- Keeps dynamic import and Emscripten ES module glue straightforward.
- Does not currently provide a CommonJS export.

Strict errors by default:

- Avoids hiding conversion failures.
- `fallback: true` exists for workflows that prefer placeholder images over
  exceptions.

## 15. Rough Edges and Future Improvements

- Add true WMF support if it can be made reliable.
- Expand EMF+ diagnostics and decide whether EMF+ should be rejected earlier or
  treated as partial classic-EMF rendering.
- Explore enabling EMF+ handling in the `libemf2svg` wrapper if upstream support
  is good enough.
- Add more real DOCX-extracted EMF fixtures.
- Add visual regression tests or image snapshot tests instead of only PNG magic
  number checks.
- Add exact canvas sizing for `fit: "contain"` if users need padded output with
  exact requested dimensions.
- Replace or reduce generated build verbosity once the WASM build stabilizes.
- Consider pinning the exact upstream `libemf2svg` commit instead of cloning the
  latest default branch.
- Consider adding a CommonJS compatibility wrapper if users ask for `require()`
  support.
- Publish a small troubleshooting guide for unsupported records and how to
  collect failing fixtures.
