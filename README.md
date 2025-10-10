# emf-to-png

WASM-based **EMF/WMF → PNG/JPEG** converter for Node.js. No Office, LibreOffice, or Inkscape. Works on Linux/macOS/Windows and headless servers.

## Install

```bash
npm i emf-to-png
# or
npx emf-to-png input.emf output.png
```

## Usage:

```javascript
import { convertFile, convert } from "emf-to-png";

await convertFile("reaction.emf", "reaction.png");

const buf = await convert(await fs.promises.readFile("diagram.emf"), {
  width: 1200,
  background: "#ffffff",
  format: "png",
});
```

### API:

```javascript

convert(emfBuffer: Buffer | Uint8Array, options?: ConvertOptions): Promise<Buffer>

convertFile(inputPath: string, outputPath?: string, options?: ConvertOptions): Promise<string>

```

## CLI

```bash
npx emf-to-png input.emf output.png
```

### Errors

- UnsupportedFormatError
- ParseError
- ConversionError

## WASM build notes (one-time)

We’ll compile the EMF/WMF→SVG engines to WebAssembly:

1. **libemf2svg (EMF → SVG)**
2. **libwmf (WMF → SVG)**

Typical Emscripten command pattern (adjust to your sources/exports):

```bash
emcc -O3 -s MODULARIZE=1 -s EXPORT_ES6=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_FUNCTIONS='["_convert","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["getValue","setValue"]' \
  -o wasm/emf2svg.js \
  src-cpp/emf2svg.cpp

emf-to-png/
├─ package.json
├─ README.md
├─ LICENSE
├─ src/
│ ├─ index.ts
│ ├─ types.ts
│ ├─ errors.ts
│ ├─ detect.ts
│ ├─ emf2svg.ts # WASM bridge for EMF/WMF → SVG
│ ├─ svgRaster.ts # SVG → PNG/JPEG via resvg-js + jpeg-js
│ └─ placeholder.ts # graceful fallback ("Unsupported EMF")
├─ bin/
│ └─ emf-to-png.mjs # CLI
├─ wasm/
│ ├─ emf2svg.wasm # prebuilt from libemf2svg (emscripten)
│ └─ wmf2svg.wasm # (optional) if WMF isn’t covered by emf2svg
├─ test/
│ ├─ convert.test.ts
│ └─ fixtures/
│ ├─ test1.emf
│ └─ test2.wmf
└─ .github/workflows/ci.yml
```
