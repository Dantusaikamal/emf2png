#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/wasm"
rm -rf "$OUT"
mkdir -p "$OUT"

# Everything happens inside the container so you don't need git locally.
docker run --rm \
  -v "$OUT:/out" \
  emscripten/emsdk:latest \
  bash -lc '
    set -e
    # 1) get sources
    mkdir -p /work && cd /work
    git clone --depth=1 https://github.com/kakwa/libemf2svg.git
    cd libemf2svg

    # 2) build the CLI to wasm: /out/emf2svg.{js,wasm}
    # Note: repos sometimes restructure; this compiles the tool + core sources. Adjust globs if needed.
    if [ -f tools/emf2svg.cpp ]; then
      SRC_FILES="tools/emf2svg.cpp"
    else
      # fallback: find likely CLI file
      SRC_FILES="$(grep -Rl --include="*.cpp" -E "(emf2svg|main)" . || true)"
    fi

    # add core src if present
    CORE_SRC="$(find src lib -type f \( -name "*.cpp" -o -name "*.c" \) 2>/dev/null || true)"
    ALL_SRC="$SRC_FILES $CORE_SRC"

    if [ -z "$SRC_FILES" ]; then
      echo "Could not locate emf2svg CLI source. Inspect repo layout." >&2
      exit 2
    fi

    emcc -O3 -s MODULARIZE=1 -s EXPORT_ES6=1 \
      -s ALLOW_MEMORY_GROWTH=1 \
      -s EXIT_RUNTIME=1 \
      -s FORCE_FILESYSTEM=1 \
      -s 'EXPORTED_RUNTIME_METHODS=["getValue","setValue","FS","HEAPU8","HEAP8","cwrap"]' \
      $ALL_SRC \
      -o /out/emf2svg.js

    ls -lh /out
  '

echo "Built: $OUT/emf2svg.js and $OUT/emf2svg.wasm"
