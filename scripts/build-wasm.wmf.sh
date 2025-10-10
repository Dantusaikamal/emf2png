#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/wasm"
WORK="$ROOT/.work-wmf"
rm -rf "$WORK"
mkdir -p "$WORK" "$OUT"

# 1) Fetch a WMF→SVG tool implementation.
# libwmf itself is larger/autotools-y; easier path is to pull a small OSS wmf2svg (there are a few).
# One common approach is to vendor the minimal CLI (wmf2svg) that relies on libwmf parsing sources.
git clone --depth=1 https://github.com/wvware/libwmf.git "$WORK/libwmf"

docker run --rm -v "$WORK:/src" -v "$OUT:/out" emscripten/emsdk:latest bash -lc '
  set -e
  cd /src/libwmf

  # This project is autotools-based and expects X11/fontconfig.
  # For a WASM build of the CLI only, compile the parser + svg device backend and the wmf2svg tool.
  # You may need to disable backends that require native deps and keep only SVG device.

  # Example (high-level): pick only the svg device + core parser and the wmf2svg tool sources.
  # Adjust paths according to upstream layout.
  # If build fails due to missing headers, add them to the include path or vendor minimal files.

  INCLUDES="-I./include -I./src -I."
  SOURCES="$(git ls-files | grep -E \"(tools/wmf2svg\\.c$|src/.*\\.c$|src/.*\\.cpp$|libwmf/.*\\.c$)\" || true)"
  if [ -z \"$SOURCES\" ]; then
    echo 'Could not glob wmf2svg sources; please inspect repo layout'; exit 1
  fi

  emcc -O3 -s MODULARIZE=1 -s EXPORT_ES6=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXIT_RUNTIME=1 \
    -s FORCE_FILESYSTEM=1 \
    -s EXPORTED_RUNTIME_METHODS=\"[\\\"getValue\\\",\\\"setValue\\\",\\\"FS\\\"]\" \
    $INCLUDES $SOURCES \
    -o /out/wmf2svg.js
'

echo "Built: $OUT/wmf2svg.js & $OUT/wmf2svg.wasm"
