// src/types/emscripten.d.ts
export interface EmscriptenModule {
  HEAPU8: Uint8Array;
  _malloc(n: number): number;
  _free(ptr: number): void;
  getValue(ptr: number, type: "i32" | "i8" | "double" | string): number;
  setValue?(ptr: number, v: number, type: string): void;

  _convert?(
    ptr: number,
    len: number,
    dpi: number,
    outPtrPtr: number,
    outLenPtr: number
  ): number;

  _main?(argc?: number, argvPtr?: number): number;
  FS?: any;
  cwrap?(...args: any[]): any;
}
