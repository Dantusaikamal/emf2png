declare module "../wasm/*.js" {
  // Keep this minimal—just what you use
  export type EmscriptenModule = {
    HEAPU8: Uint8Array;
    _malloc(n: number): number;
    _free(ptr: number): void;
    getValue(ptr: number, type: string): number;
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
    cwrap?: (...args: any[]) => any;
  };

  // The default export of Emscripten’s MODULARIZE build
  export default function Module(opts: any): Promise<EmscriptenModule>;
}
