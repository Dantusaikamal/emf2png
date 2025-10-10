#include <stdint.h>
#include <stdlib.h>
#include <string>
#include <vector>
#include <cstring>

// If you integrate a library, include its headers here.
// #include "libemf2svg.hpp" // example

extern "C" {

// Emscripten will export these; JS side calls them.
uint8_t* heap_alloc(int len) {
  return (uint8_t*)malloc(len);
}

void free_buf(uint8_t* p) {
  if (p) free(p);
}

/**
 * Convert EMF bytes to SVG UTF-8.
 * inPtr/inLen: input EMF buffer on WASM heap
 * dpi: target DPI (96 default)
 * outPtrPtr/outLenPtr: set to newly-allocated UTF-8 SVG buffer (on heap) and its length
 * Return 0 on success, non-zero on failure.
 */
int convert(uint8_t* inPtr, int inLen, int dpi, int* outPtrPtr, int* outLenPtr) {
  if (!inPtr || inLen <= 0) return 2;

  try {
    // TODO: parse EMF -> build SVG string using your lib.
    // Placeholder minimal SVG (replace with real output)
    std::string svg = "<svg xmlns='http://www.w3.org/2000/svg' width='800' height='400'>"
                      "<rect width='100%' height='100%' fill='transparent'/>"
                      "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' "
                      "font-family='Arial' font-size='24' fill='#888'>EMF→SVG stub</text>"
                      "</svg>";

    int len = (int)svg.size();
    uint8_t* out = (uint8_t*)malloc(len);
    if (!out) return 3;
    memcpy(out, svg.data(), len);
    *outPtrPtr = (int)(intptr_t)out;
    *outLenPtr = len;
    return 0;
  } catch (...) {
    return 1;
  }
}

} // extern "C"
