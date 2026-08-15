# emf-to-png

Convert EMF files to PNG or JPEG in Node.js without Office, LibreOffice, or
Inkscape.

This package is built for the common DOCX extraction case where images appear as
`.emf` files and need to be rendered on a server or in a Node.js pipeline.

## Status

EMF support is working for classic EMF files through a bundled WebAssembly build
of `libemf2svg`, followed by rasterization with `@resvg/resvg-js`.

WMF and EMF+ are not part of the current stable API yet. Some advanced or
application-specific EMF records may still fail depending on upstream renderer
coverage.

## Install

```bash
npm install emf-to-png
```

## Usage

```js
import { convert, convertFile, inspect } from "emf-to-png";
import { readFile } from "node:fs/promises";

await convertFile("diagram.emf", "diagram.png", { width: 1200 });

const input = await readFile("diagram.emf");
const info = inspect(input);

const png = await convert(input, {
  width: 1200,
  background: "#ffffff",
  format: "png",
});
```

## CLI

```bash
npx emf-to-png input.emf output.png
```

CLI flags:

```bash
npx emf-to-png input.emf output.jpg \
  --width 1200 \
  --background "#ffffff" \
  --format jpeg \
  --quality 85
```

Environment options:

```bash
EMF_PNG_WIDTH=1200
EMF_PNG_HEIGHT=800
EMF_PNG_DPI=96
EMF_PNG_BG=#ffffff
EMF_PNG_FORMAT=png
EMF_PNG_QUALITY=90
```

## API

```ts
convert(input: Buffer | Uint8Array, options?: ConvertOptions): Promise<Buffer>
convertFile(inputPath: string, outputPath?: string, options?: ConvertOptions): Promise<string>
emfOrWmfToSvg(kind: "emf", data: Uint8Array, dpi?: number): Promise<string>
inspect(input: Buffer | Uint8Array): InspectResult
```

`ConvertOptions`:

```ts
interface ConvertOptions {
  width?: number;
  height?: number;
  background?: string;
  dpi?: number;
  format?: "png" | "jpeg";
  quality?: number;
  fit?: "width" | "height" | "contain";
  fallback?: boolean;
  logger?: (message: string) => void;
}
```

By default, conversion errors throw. Set `fallback: true` if you prefer a
placeholder image instead. Fallback output respects `format`, so JPEG requests
receive JPEG bytes.

When both `width` and `height` are provided, `fit: "contain"` is used by
default. This preserves aspect ratio and fits the rendered image inside the
requested box. Use `fit: "width"` or `fit: "height"` to force a specific
dimension.

## Inspecting Inputs

```js
const info = inspect(emfBuffer);
```

`inspect()` does not render the file. It returns detected format, byte size,
classic EMF support status, EMF+ detection, and basic EMF header dimensions when
available.

```ts
interface InspectResult {
  kind: "emf" | "wmf" | null;
  bytes: number;
  supported: boolean;
  emfPlus: boolean;
  reason?: string;
  width?: number;
  height?: number;
  records?: number;
}
```

## Errors

The package exports typed errors:

- `UnsupportedFormatError`
- `UnsupportedFeatureError`
- `InvalidEmfError`
- `WasmInitializationError`
- `EmfParseError`
- `RasterizationError`
- `ConversionError`

This lets production pipelines distinguish invalid input, unsupported features,
WASM loading failures, and rasterization failures.

## Development

Build the EMF WebAssembly renderer with Docker:

```bash
npm run build:wasm
```

Build the JavaScript package:

```bash
npm run build:js
node scripts/postbuild-copy-wasm.mjs
```

Run tests:

```bash
npm test
```

Full build:

```bash
npm run build
```
