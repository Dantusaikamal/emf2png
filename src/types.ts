export interface ConvertOptions {
  width?: number; // default: from EMF/WMF bbox or ~800px
  height?: number; // default: preserve aspect
  background?: string; // CSS color, default transparent
  dpi?: number; // 96 by default
  antialias?: boolean; // currently always on in resvg; kept for API
  format?: "png" | "jpeg"; // default png
  logger?: (msg: string) => void;
}
