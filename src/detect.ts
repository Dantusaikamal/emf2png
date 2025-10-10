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
