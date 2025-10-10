# Contributing

- Keep dependencies minimal.
- Add/adjust tests with Vitest.
- For EMF/WMF engines, prefer small, well-scoped C/C++ wrappers compiled to WASM.
- Make sure `npm test` passes on Linux/macOS/Windows.

## Dev Setup

```bash
npm i
npm run build
npm test
```
