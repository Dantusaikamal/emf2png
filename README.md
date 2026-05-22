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
import { convert, convertFile } from "emf-to-png";
import { readFile } from "node:fs/promises";

await convertFile("diagram.emf", "diagram.png", { width: 1200 });

const input = await readFile("diagram.emf");
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

Environment options:

```bash
EMF_PNG_WIDTH=1200
EMF_PNG_HEIGHT=800
EMF_PNG_DPI=96
EMF_PNG_BG=#ffffff
EMF_PNG_FORMAT=png
```

## API

```ts
convert(input: Buffer | Uint8Array, options?: ConvertOptions): Promise<Buffer>
convertFile(inputPath: string, outputPath?: string, options?: ConvertOptions): Promise<string>
emfOrWmfToSvg(kind: "emf", data: Uint8Array, dpi?: number): Promise<string>
```

`ConvertOptions`:

```ts
interface ConvertOptions {
  width?: number;
  height?: number;
  background?: string;
  dpi?: number;
  format?: "png" | "jpeg";
  fallback?: boolean;
  logger?: (message: string) => void;
}
```

By default, conversion errors throw. Set `fallback: true` if you prefer a
placeholder PNG instead.

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
