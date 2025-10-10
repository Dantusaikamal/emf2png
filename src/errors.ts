export class UnsupportedFormatError extends Error {
  code = "UNSUPPORTED_FORMAT";
  constructor(msg = "Unsupported format (expected EMF or WMF).") {
    super(msg);
  }
}

export class ParseError extends Error {
  code = "PARSE_ERROR";
  constructor(msg = "Failed to parse EMF/WMF input.") {
    super(msg);
  }
}

export class ConversionError extends Error {
  code = "CONVERSION_ERROR";
  constructor(msg = "Failed to convert to image.") {
    super(msg);
  }
}
