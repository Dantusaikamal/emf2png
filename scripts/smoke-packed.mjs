import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixturePath = resolve(root, "test/fixtures/test1.emf");
const tempDir = await mkdtemp(join(tmpdir(), "emf-to-png-pack-"));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npmExecOptions = { shell: process.platform === "win32" };
let tarballPath;

try {
  const packOutput = execFileSync(npm, ["pack", "--silent"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    ...npmExecOptions,
  });
  const filename = packOutput.trim().split(/\r?\n/).at(-1);
  if (!filename) {
    throw new Error("npm pack did not report a tarball filename.");
  }
  tarballPath = resolve(root, filename);

  await writeFile(
    join(tempDir, "package.json"),
    JSON.stringify({ type: "module", private: true }, null, 2)
  );
  execFileSync(npm, ["install", tarballPath], {
    cwd: tempDir,
    stdio: "inherit",
    ...npmExecOptions,
  });

  await writeFile(
    join(tempDir, "smoke.mjs"),
    `
import { readFile } from "node:fs/promises";
import { convert, inspect } from "emf-to-png";

const input = await readFile(process.argv[2]);
const info = inspect(input);
if (info.kind !== "emf") {
  throw new Error(\`Expected packed package to inspect EMF, got \${info.kind}\`);
}

const png = await convert(input, { width: 200 });
if (Buffer.from(png).subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
  throw new Error("Packed package did not produce PNG output");
}
`
  );

  execFileSync("node", ["smoke.mjs", fixturePath], {
    cwd: tempDir,
    stdio: "inherit",
  });
  console.log(`Packed install smoke test passed for ${basename(tarballPath)}.`);
} finally {
  await rm(tempDir, { recursive: true, force: true });
  if (tarballPath) {
    await rm(tarballPath, { force: true });
  }
}
