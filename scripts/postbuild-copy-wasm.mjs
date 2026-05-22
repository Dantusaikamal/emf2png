import { mkdir, cp, access } from "node:fs/promises";
import { constants } from "node:fs";

async function exists(p) {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const src = "wasm";
  const dstRoot = "dist/wasm";

  await mkdir(dstRoot, { recursive: true });

  for (const name of ["emf2svg.js", "emf2svg.wasm"]) {
    if (await exists(`${src}/${name}`)) {
      await cp(`${src}/${name}`, `${dstRoot}/${name}`);
    }
  }
}

main().catch((e) => {
  console.error("[postbuild-copy-wasm] " + (e?.message || e));
  process.exit(1);
});
