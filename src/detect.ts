// naive but practical signatures for quick reject/accept
import type { EmfRect } from "./types.js";

export type VectorKind = "emf" | "wmf";

export interface EmfHeaderInfo {
  bounds: EmfRect;
  frame: EmfRect;
  records: number;
  bytes: number;
}

export function sniffKind(buf: Uint8Array): VectorKind | null {
  // EMF: bytes 40..43 often contain ' EMF' (0x20 45 4D 46), but also check header size
  if (buf.length > 88) {
    const a = buf[40],
      b = buf[41],
      c = buf[42],
      d = buf[43];
    if (a === 0x20 && b === 0x45 && c === 0x4d && d === 0x46) return "emf";
  }
  // WMF placeable header: 0xD7 0xCD 0xC6 0x9A at start
  if (buf.length > 4) {
    if (
      buf[0] === 0xd7 &&
      buf[1] === 0xcd &&
      buf[2] === 0xc6 &&
      buf[3] === 0x9a
    )
      return "wmf";
  }
  return null;
}

function readU32(buf: Uint8Array, off: number): number {
  return (
    buf[off] |
    (buf[off + 1] << 8) |
    (buf[off + 2] << 16) |
    (buf[off + 3] << 24)
  ) >>> 0;
}

// Quick EMF+ detector: finds EMR_GDICOMMENT blocks with "EMF+" signature.
export function isEmfPlus(buf: Uint8Array): boolean {
  // Safety
  if (!buf || buf.length < 88) return false;

  // Basic EMF header sanity: dSignature = ' EMF' at 40..43
  const sig = readU32(buf, 40);
  const SIG_EMF = 0x464d4520; // ' EMF'
  if (sig !== SIG_EMF) return false;

  // EMF records start at 0; first record is header (type=1)
  // Scan records: [iType (4), nSize (4), payload...]
  // EMR_GDICOMMENT = 70; EMF+ starts with ASCII 'EMF+' in the comment payload.
  let off = 0;

  const fileSize = readU32(buf, 48);
  const limit = Math.min(fileSize || buf.length, buf.length);

  while (off + 8 <= limit) {
    const iType = readU32(buf, off);
    const nSize = readU32(buf, off + 4);
    if (nSize < 8 || off + nSize > limit) break;

    if (iType === 70 /* EMR_GDICOMMENT */) {
      // EMR_GDICOMMENT payload is DataSize (4 bytes), then comment bytes.
      const dataSizeOff = off + 8;
      const signatureOff = off + 12;
      const dataSize = dataSizeOff + 4 <= limit ? readU32(buf, dataSizeOff) : 0;
      const dataEnd = signatureOff + dataSize;
      if (
        dataSize >= 4 &&
        dataEnd <= off + nSize &&
        dataEnd <= limit &&
        signatureOff + 4 <= off + nSize &&
        signatureOff + 4 <= limit
      ) {
        if (
          buf[signatureOff] === 0x45 &&
          buf[signatureOff + 1] === 0x4d &&
          buf[signatureOff + 2] === 0x46 &&
          buf[signatureOff + 3] === 0x2b
        ) {
          return true; // "EMF+"
        }
      }
    }
    off += nSize;
  }
  return false;
}

export function readEmfHeader(buf: Uint8Array): EmfHeaderInfo | null {
  if (sniffKind(buf) !== "emf" || buf.length < 88) return null;

  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const bounds = rect(
    view.getInt32(8, true),
    view.getInt32(12, true),
    view.getInt32(16, true),
    view.getInt32(20, true)
  );
  const frame = rect(
    view.getInt32(24, true),
    view.getInt32(28, true),
    view.getInt32(32, true),
    view.getInt32(36, true)
  );

  return {
    bounds,
    frame,
    records: view.getUint32(52, true),
    bytes: view.getUint32(48, true),
  };
}

function rect(left: number, top: number, right: number, bottom: number): EmfRect {
  return {
    left,
    top,
    right,
    bottom,
    width: Math.abs(right - left),
    height: Math.abs(bottom - top),
  };
}
