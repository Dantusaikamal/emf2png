export type EmfToPngErrorCode =
  | "UNSUPPORTED_FORMAT"
  | "UNSUPPORTED_FEATURE"
  | "INVALID_EMF"
  | "WASM_INITIALIZATION_ERROR"
  | "EMF_PARSE_ERROR"
  | "RASTERIZATION_ERROR"
  | "CONVERSION_ERROR";

export class EmfToPngError extends Error {
  readonly code: EmfToPngErrorCode;
  readonly cause?: unknown;

  constructor(code: EmfToPngErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.cause = cause;
  }
}

export class UnsupportedFormatError extends EmfToPngError {
  constructor(msg = "Unsupported format (expected EMF).", cause?: unknown) {
    super("UNSUPPORTED_FORMAT", msg, cause);
  }
}

export class UnsupportedFeatureError extends EmfToPngError {
  readonly feature: string;

  constructor(feature: string, msg?: string, cause?: unknown) {
    super(
      "UNSUPPORTED_FEATURE",
      msg ?? `Unsupported feature: ${feature}.`,
      cause
    );
    this.feature = feature;
  }
}

export class InvalidEmfError extends EmfToPngError {
  constructor(msg = "Invalid or malformed EMF input.", cause?: unknown) {
    super("INVALID_EMF", msg, cause);
  }
}

export class WasmInitializationError extends EmfToPngError {
  constructor(msg = "Failed to initialize the EMF WebAssembly renderer.", cause?: unknown) {
    super("WASM_INITIALIZATION_ERROR", msg, cause);
  }
}

export class EmfParseError extends EmfToPngError {
  constructor(msg = "Failed to parse EMF input.", cause?: unknown) {
    super("EMF_PARSE_ERROR", msg, cause);
  }
}

export class RasterizationError extends EmfToPngError {
  constructor(msg = "Failed to rasterize SVG output.", cause?: unknown) {
    super("RASTERIZATION_ERROR", msg, cause);
  }
}

export class ParseError extends EmfParseError {}

export class ConversionError extends EmfToPngError {
  constructor(msg = "Failed to convert to image.", cause?: unknown) {
    super("CONVERSION_ERROR", msg, cause);
  }
}
