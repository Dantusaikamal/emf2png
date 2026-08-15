# Publishing to npm

This project publishes as the `emf-to-png` npm package. The published package
contains the compiled JavaScript entrypoint, the CLI, and the bundled
WebAssembly renderer under `dist/wasm`.

## Requirements

- Node.js 18 or newer.
- npm account with publish access to `emf-to-png`.
- Docker Desktop running, because `npm run build` rebuilds the EMF WebAssembly
  module with the `emscripten/emsdk` Docker image.
- PowerShell or `pwsh`, because `scripts/build-wasm.emf.mjs` launches
  `scripts/build-wasm.emf.ps1`.

## Pre-publish checklist

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Run the full publish validation:

   ```bash
   npm run prepublishOnly
   ```

   This runs:

   ```bash
   npm run clean
   npm run build
   npm test
   ```

3. Inspect the package contents:

   ```bash
   npm pack --dry-run
   ```

   Expected contents are roughly:

   ```text
   CHANGELOG.md
   README.md
   bin/emf-to-png.mjs
   dist/index.d.ts
   dist/index.js
   dist/wasm/emf2svg.js
   dist/wasm/emf2svg.wasm
   package.json
   ```

4. Check production dependency audit:

   ```bash
   npm audit --omit=dev
   ```

5. Confirm `package.json` has the intended version.

   For this reliability release, the intended version is `0.2.0`. If you want a
   more cautious release, publish a prerelease such as `0.2.0-beta.0` first.

## Publishing

Login if needed:

```bash
npm login
```

Publish:

```bash
npm publish
```

For a beta tag:

```bash
npm publish --tag beta
```

## Post-publish smoke test

Use a temporary directory outside this repository:

```bash
mkdir emf-to-png-smoke
cd emf-to-png-smoke
npm init -y
npm install emf-to-png
```

Test import:

```bash
node --input-type=module -e "import { convert } from 'emf-to-png'; console.log(typeof convert)"
```

Test the CLI with a real EMF file:

```bash
npx emf-to-png ./input.emf ./output.png
```

## Important release notes

- The package currently supports classic EMF conversion.
- WMF is detected by `src/detect.ts`, but `src/emf2svg.ts` intentionally throws
  for WMF because WMF support is not built yet.
- EMF+ and advanced records may fail depending on upstream `libemf2svg`
  support.
- Conversion errors throw by default. Users can opt into placeholder output with
  `fallback: true`.
