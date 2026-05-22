import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { convert, emfOrWmfToSvg, UnsupportedFormatError } from "../src/index";

async function fixture(name: string) {
  return readFile(new URL(`./fixtures/${name}`, import.meta.url));
}

function expectPng(buf: Buffer) {
  expect(buf).toBeInstanceOf(Buffer);
  expect(buf.slice(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(buf.length).toBeGreaterThan(1000);
}

describe("emf-to-png", () => {
  it("converts EMF bytes to SVG", async () => {
    const buf = await fixture("test1.emf");
    const svg = await emfOrWmfToSvg("emf", new Uint8Array(buf));

    expect(svg).toContain("<svg:svg");
    expect(svg).toContain("<svg:path");
    expect(svg).not.toContain('"xmlns:');
    expect(svg.length).toBeGreaterThan(1000);
  });

  it("converts EMF to a PNG buffer", async () => {
    const buf = await fixture("test1.emf");
    const out = await convert(buf, { width: 800 });

    expectPng(out);
  });

  it("converts a second EMF fixture", async () => {
    const buf = await fixture("test2.emf");
    const out = await convert(buf, { width: 800 });

    expectPng(out);
  });

  it("throws on invalid input by default", async () => {
    await expect(convert(Buffer.from("not-an-emf"))).rejects.toBeInstanceOf(
      UnsupportedFormatError
    );
  });

  it("can return a placeholder PNG when fallback is enabled", async () => {
    const out = await convert(Buffer.from("not-an-emf"), { fallback: true });

    expectPng(out);
  });
});
