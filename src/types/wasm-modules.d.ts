import type { EmscriptenModule } from "./emscripten";

declare module "../wasm/emf2svg.js" {
  const factory: (opts?: any) => Promise<EmscriptenModule>;
  export default factory;
}
declare module "../wasm/wmf2svg.js" {
  const factory: (opts?: any) => Promise<EmscriptenModule>;
  export default factory;
}
