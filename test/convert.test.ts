import { describe, it, expect } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  convert,
  convertFile,
  ConversionError,
  emfOrWmfToSvg,
  inspect,
  UnsupportedFeatureError,
  UnsupportedFormatError,
} from "../src/index";

async function fixture(name: string) {
  return readFile(new URL(`./fixtures/${name}`, import.meta.url));
}

function fixturePath(name: string) {
  return fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
}

function expectPng(buf: Buffer) {
  expect(buf).toBeInstanceOf(Buffer);
  expect(buf.slice(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(buf.length).toBeGreaterThan(1000);
}

function expectJpeg(buf: Buffer) {
  expect(buf).toBeInstanceOf(Buffer);
  expect(buf.slice(0, 2).toString("hex")).toBe("ffd8");
  expect(buf.length).toBeGreaterThan(1000);
}

function makeMinimalEmfPlus(): Buffer {
  const headerSize = 88;
  const commentSize = 20;
  const totalSize = headerSize + commentSize;
  const buf = Buffer.alloc(totalSize);

  buf.writeUInt32LE(1, 0); // EMR_HEADER
  buf.writeUInt32LE(headerSize, 4);
  buf.write(" EMF", 40, "ascii");
  buf.writeUInt32LE(totalSize, 48);
  buf.writeUInt32LE(2, 52);

  buf.writeUInt32LE(70, headerSize); // EMR_GDICOMMENT
  buf.writeUInt32LE(commentSize, headerSize + 4);
  buf.writeUInt32LE(4, headerSize + 8); // DataSize precedes comment bytes.
  buf.write("EMF+", headerSize + 12, "ascii");

  return buf;
}

describe("emf-to-png", () => {
  it("inspects EMF metadata without converting", async () => {
    const buf = await fixture("test1.emf");
    const info = inspect(buf);

    expect(info.kind).toBe("emf");
    expect(info.supported).toBe(true);
    expect(info.emfPlus).toBe(false);
    expect(info.bytes).toBe(buf.length);
    expect(info.width).toBeGreaterThan(0);
    expect(info.height).toBeGreaterThan(0);
    expect(info.records).toBeGreaterThan(0);
  });

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

  it("converts EMF to a JPEG buffer", async () => {
    const buf = await fixture("test1.emf");
    const out = await convert(buf, {
      format: "jpeg",
      width: 800,
      quality: 80,
    });

    expectJpeg(out);
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

  it("respects JPEG format and quality for fallback output", async () => {
    const out = await convert(Buffer.from("not-an-emf"), {
      fallback: true,
      format: "jpeg",
      quality: 70,
      background: "#ffffff",
    });

    expectJpeg(out);
  });

  it("detects EMF+ records at the EMR_GDICOMMENT payload signature offset", () => {
    const info = inspect(makeMinimalEmfPlus());

    expect(info.kind).toBe("emf");
    expect(info.emfPlus).toBe(true);
    expect(info.supported).toBe(false);
    expect(info.reason).toContain("EMF+");
  });

  it("infers JPEG output from convertFile output extension", async () => {
    const dir = await mkdtemp(join(tmpdir(), "emf-to-png-"));
    try {
      const outPath = join(dir, "diagram.jpg");
      const writtenPath = await convertFile(fixturePath("test1.emf"), outPath);
      const out = await readFile(writtenPath);

      expect(writtenPath).toBe(outPath);
      expectJpeg(out);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 15000);

  it("rejects invalid numeric conversion options before fallback handling", async () => {
    const buf = await fixture("test1.emf");

    await expect(
      convert(buf, { width: -100, fallback: true })
    ).rejects.toBeInstanceOf(ConversionError);
    await expect(convert(buf, { height: 0 })).rejects.toBeInstanceOf(
      ConversionError
    );
    await expect(convert(buf, { dpi: Number.NaN })).rejects.toBeInstanceOf(
      ConversionError
    );
  });

  it("throws a typed unsupported feature error for WMF", async () => {
    const wmf = Buffer.from([0xd7, 0xcd, 0xc6, 0x9a, 0x00]);

    await expect(convert(wmf)).rejects.toBeInstanceOf(UnsupportedFeatureError);
    expect(inspect(wmf)).toMatchObject({
      kind: "wmf",
      supported: false,
      reason: "WMF support is not built yet.",
    });
  });
});
