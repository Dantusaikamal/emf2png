import { readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const targets = [
  "dist",
  "wasm/emf2svg.wasm",
  "wasm/emf2svg.js",
];

await Promise.all(
  targets.map((target) => rm(resolve(root, target), { recursive: true, force: true }))
);

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (entry.name.startsWith(".work-")) {
    await rm(resolve(root, entry.name), { recursive: true, force: true });
  }
}
