# Changelog

## 0.2.0

- Added `inspect()` for format detection, EMF+ detection, byte size, support
  status, and basic EMF header metadata.
- Added typed errors for unsupported features, WASM initialization failures, EMF
  parse failures, and rasterization failures.
- Added `quality` option for JPEG output.
- Added `fit` option for width/height behavior.
- Fixed fallback output so `format: "jpeg"` returns JPEG bytes instead of PNG.
- Fixed EMF+ detection inside `EMR_GDICOMMENT` records by reading the signature
  after the `DataSize` field.
- Fixed `convertFile("input.emf", "output.jpg")` so JPEG is inferred from the
  output extension unless `options.format` is explicitly provided.
- Defaulted JPEG rasterization backgrounds to white when no background is
  supplied.
- Added validation for positive `width`, `height`, and `dpi` values.
- Added CLI flags for width, height, DPI, background, format, JPEG quality, fit,
  and fallback behavior.
- Simplified CLI output directory handling so conversion failures are not
  retried as write failures.
- Added tests for metadata inspection, WMF rejection, JPEG fallback, and typed
  errors.
- Added a packed npm tarball smoke test that installs the generated package in a
  temporary project and converts a real fixture.

## 0.1.0

- Initial release: EMF -> SVG (WASM bridge) -> PNG/JPEG (resvg).
- CLI + graceful placeholder fallback.
