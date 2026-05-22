import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const ps1 = "scripts/build-wasm.emf.ps1";
const candidates =
  process.platform === "win32" ? ["powershell", "pwsh"] : ["pwsh", "powershell"];

let last;
for (const shell of candidates) {
  const result = spawnSync(shell, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1], {
    stdio: "inherit",
    shell: false,
  });

  if (result.error?.code === "ENOENT") {
    last = result.error;
    continue;
  }

  process.exit(result.status ?? 1);
}

if (!existsSync(ps1)) {
  console.error(`Missing ${ps1}`);
} else {
  console.error(
    "Could not find PowerShell. Install PowerShell/pwsh or run scripts/build-wasm.emf.ps1 manually on Windows."
  );
}
if (last) console.error(last.message);
process.exit(1);
