# Roadmap

This roadmap is intentionally conservative. The package already has organic npm
usage, so future releases should prioritize reliability and predictable behavior
over broad but fragile format claims.

## v0.2.x: Reliability Patch Line

Focus: keep existing users safe while improving diagnostics.

- Add more real-world EMF fixtures from DOCX, PPTX, Excel, Visio, and chart
  exports.
- Improve error messages with record-level context when `libemf2svg` fails.
- Expand package smoke tests to include CLI execution after tarball install.
- Add cross-platform CI for Windows, macOS, and Linux across supported Node
  versions.
- Document unsupported examples and fixture-submission guidance.

## v0.3.0: Compatibility Expansion

Focus: broaden supported inputs only where behavior can be tested.

- Investigate WMF support as a separate renderer path.
- Decide whether WMF should become a supported public input or remain explicitly
  unsupported.
- Wire EMF+ detection into clearer diagnostics and compatibility reporting.
- Investigate whether upstream `libemf2svg` EMF+ handling can be enabled safely.
- Add optional conversion metadata output, for example `convertWithMetadata()`.

## v0.4.0: Document Pipeline Utilities

Focus: help users who process many extracted files.

- Add batch conversion helpers with concurrency control.
- Add CLI glob/directory support.
- Add progress and per-file error reporting.
- Consider output naming helpers for DOCX/PPTX media directories.

## v1.0.0: Stable Contract

Focus: API stability and proven compatibility.

- Freeze the public API.
- Define long-term support policy for Node versions.
- Maintain a broad compatibility fixture corpus.
- Publish a clear compatibility matrix for classic EMF, EMF+, WMF, PNG, JPEG,
  and SVG output.

## Not Planned Unless Users Ask

- Full Microsoft Office document conversion.
- Shelling out to Office, LibreOffice, Inkscape, or ImageMagick.
- Browser-first support. The current package targets Node.js.
