# Changelog

## 0.2.0

- Added `inspect()` for format detection, EMF+ detection, byte size, support
  status, and basic EMF header metadata.
- Added typed errors for unsupported features, WASM initialization failures, EMF
  parse failures, and rasterization failures.
- Added `quality` option for JPEG output.
- Added `fit` option for width/height behavior.
- Fixed fallback output so `format: "jpeg"` returns JPEG bytes instead of PNG.
- Added CLI flags for width, height, DPI, background, format, JPEG quality, fit,
  and fallback behavior.
- Added tests for metadata inspection, WMF rejection, JPEG fallback, and typed
  errors.

## 0.1.0

- Initial release: EMF -> SVG (WASM bridge) -> PNG/JPEG (resvg).
- CLI + graceful placeholder fallback.
