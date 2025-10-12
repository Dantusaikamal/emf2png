// /work/wrapper_emf.c
#include <stdint.h>
#include <stdlib.h>
#include "emf2svg.h"
#include "fontconfig/fontconfig.h"  // shim

int convert(const uint8_t* in, int len, int dpi, uint8_t** out, int* out_len) {
  (void)dpi;

  FcInit();                      /* harmless no-op in shim */

  char*  svg = NULL;
  size_t L   = 0;

  /* Most compatible: pass NULL options */
  int rc = emf2svg((char*)in, (size_t)len, &svg, &L, NULL);

  FcFini();

  if (rc != 0 || !svg || L == 0) return rc != 0 ? rc : 99;

  *out     = (uint8_t*)svg;      /* lib mallocs; caller frees */
  *out_len = (int)L;
  return 0;
}
