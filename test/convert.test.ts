import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { convert } from "../src/index"; // <— from src, not dist

function sha256(buf: Buffer) {
  return createHash("sha256").update(buf).digest("hex");
}

describe("emf-to-png", () => {
  it("converts EMF to PNG buffer", async () => {
    const buf = await readFile(
      new URL("./fixtures/test1.emf", import.meta.url)
    );
    const out = await convert(buf, { width: 800 });
    expect(out).toBeInstanceOf(Buffer);
    expect(out.slice(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(sha256(out).length).toBe(64);
  });

  it("falls back gracefully on invalid data", async () => {
    const out = await convert(Buffer.from("not-an-emf"));
    expect(out.slice(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  });
});
