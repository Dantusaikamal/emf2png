#!/usr/bin/env bash
set -euo pipefail

mkdir -p wasm

# EMF → SVG
emcc src-cpp/emf2svg.cpp -O3 \
  -s MODULARIZE=1 -s EXPORT_ES6=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_FUNCTIONS='["_convert","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["getValue","setValue"]' \
  -o wasm/emf2svg.js

# WMF → SVG
emcc src-cpp/wmf2svg.cpp -O3 \
  -s MODULARIZE=1 -s EXPORT_ES6=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_FUNCTIONS='["_convert","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["getValue","setValue"]' \
  -o wasm/wmf2svg.js
