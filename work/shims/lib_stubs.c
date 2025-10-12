#include <stddef.h>
#include <stdint.h>

#if defined(__GNUC__) || defined(__clang__)
  #define WEAK __attribute__((weak))
  #define USED __attribute__((used))
#else
  #define WEAK
  #define USED
#endif

/* --- print utils needs this; harmless no-op --- */
WEAK const char* U_emr_names(int code) { (void)code; return ""; }

/* --- make these variadic to swallow arity diffs across versions --- */
WEAK int DIB_to_RGBA(const unsigned char* dib, int dib_size,
                     unsigned char** out_rgba, int* w, int* h, ...) {
  (void)dib; (void)dib_size;
  if (out_rgba) *out_rgba = NULL;
  if (w) *w = 0;
  if (h) *h = 0;
  return 0;
}

WEAK int image_library_writer(void* ctx,
                              const unsigned char* data, int len, ...) {
  (void)ctx; (void)data; (void)len;
  return 0;
}

WEAK int U_pmf_onerec_draw(const unsigned char* p, int len,
                           char** svg, size_t* svg_len, ...) {
  (void)p; (void)len; (void)svg; (void)svg_len;
  return 0;
}

WEAK int U_pmf_onerec_print(const unsigned char* p, int len,
                            char** out, size_t* out_len, ...) {
  (void)p; (void)len; (void)out; (void)out_len;
  return 0;
}

/* --- both names show up in different units --- */
WEAK int get_real_color_count(const unsigned char* rgba) {
  (void)rgba; return 0;
}

/* The one your linker error complains about. Mark USED so it cannot be gc’d. */
USED WEAK int get_real_color_icount(int a, int b, int c, int d) {
  (void)a; (void)b; (void)c; (void)d; return 0;
}

/* optional no-op */
WEAK void freeEmfImageLibrary(void* p) { (void)p; }
