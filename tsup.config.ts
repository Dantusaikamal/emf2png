import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  target: "node18",
  clean: true,
  splitting: false,
  sourcemap: false,
  external: [
    "./wasm/emf2svg.js",
    "../wasm/emf2svg.js",
    "./wasm/wmf2svg.js",
    "../wasm/wmf2svg.js",
  ],
});
