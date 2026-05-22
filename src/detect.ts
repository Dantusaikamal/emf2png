// naive but practical signatures for quick reject/accept
export type VectorKind = "emf" | "wmf";

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

// Quick EMF+ detector: finds EMR_GDICOMMENT blocks with "EMF+" signature
export function isEmfPlus(buf: Uint8Array): boolean {
  // Safety
  if (!buf || buf.length < 88) return false;

  // Basic EMF header sanity: dSignature = ' EMF' at 40..43
  const sig =
    (buf[40] | (buf[41] << 8) | (buf[42] << 16) | (buf[43] << 24)) >>> 0;
  const SIG_EMF = 0x464d4520; // ' EMF'
  if (sig !== SIG_EMF) return false;

  // EMF records start at 0; first record is header (type=1)
  // Scan records: [iType (4), nSize (4), payload...]
  // EMR_GDICOMMENT = 70; EMF+ starts with ASCII 'EMF+' in the comment payload.
  let off = 0;

  const fileSize =
    (buf[48] | (buf[49] << 8) | (buf[50] << 16) | (buf[51] << 24)) >>> 0;
  const limit = Math.min(fileSize || buf.length, buf.length);

  while (off + 8 <= limit) {
    const iType =
      buf[off] |
      (buf[off + 1] << 8) |
      (buf[off + 2] << 16) |
      (buf[off + 3] << 24);
    const nSize =
      buf[off + 4] |
      (buf[off + 5] << 8) |
      (buf[off + 6] << 16) |
      (buf[off + 7] << 24);
    if (nSize < 8 || off + nSize > limit) break;

    if (iType === 70 /* EMR_GDICOMMENT */) {
      // The comment payload starts at off+8; look for "EMF+"
      const payloadOff = off + 8;
      if (payloadOff + 4 <= limit) {
        if (
          buf[payloadOff] === 0x45 &&
          buf[payloadOff + 1] === 0x4d &&
          buf[payloadOff + 2] === 0x46 &&
          buf[payloadOff + 3] === 0x2b
        ) {
          return true; // "EMF+"
        }
      }
    }
    off += nSize;
  }
  return false;
}
