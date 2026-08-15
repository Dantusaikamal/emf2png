import type { VectorKind } from "./detect.js";

export type OutputFormat = "png" | "jpeg";
export type RasterFit = "width" | "height" | "contain";

export interface ConvertOptions {
  width?: number; // default: from EMF bbox
  height?: number; // default: preserve aspect
  background?: string; // CSS color, default transparent
  dpi?: number; // 96 by default
  antialias?: boolean; // currently always on in resvg; kept for API
  format?: OutputFormat; // default png
  quality?: number; // JPEG quality, 1-100, default 90
  fit?: RasterFit; // when both width and height are set, default contain
  fallback?: boolean; // return a placeholder PNG instead of throwing on failure
  logger?: (msg: string) => void;
}

export interface EmfRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface InspectResult {
  kind: VectorKind | null;
  bytes: number;
  supported: boolean;
  emfPlus: boolean;
  reason?: string;
  width?: number;
  height?: number;
  bounds?: EmfRect;
  frame?: EmfRect;
  records?: number;
}
