#include <stdint.h>
#include <stdlib.h>
#include <string>
#include <vector>
#include <cstring>

extern "C" {

uint8_t* heap_alloc(int len) {
  return (uint8_t*)malloc(len);
}

void free_buf(uint8_t* p) {
  if (p) free(p);
}

int convert(uint8_t* inPtr, int inLen, int dpi, int* outPtrPtr, int* outLenPtr) {
  if (!inPtr || inLen <= 0) return 2;

  try {
    // TODO: WMF parsing -> SVG via your lib
    std::string svg = "<svg xmlns='http://www.w3.org/2000/svg' width='800' height='400'>"
                      "<rect width='100%' height='100%' fill='transparent'/>"
                      "<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' "
                      "font-family='Arial' font-size='24' fill='#888'>WMF→SVG stub</text>"
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

}
