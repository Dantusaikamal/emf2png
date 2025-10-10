// cli_main.c
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif
// This symbol must be provided by your wrapper (or the library):
// int convert(uint8_t* in, int len, int dpi, uint8_t** outPtr, int* outLen);
int convert(uint8_t* in, int len, int dpi, uint8_t** outPtr, int* outLen);
#ifdef __cplusplus
}
#endif

static uint8_t* read_all(const char* path, int* len) {
  FILE* f = fopen(path, "rb");
  if (!f) return NULL;
  fseek(f, 0, SEEK_END);
  long sz = ftell(f);
  if (sz < 0) { fclose(f); return NULL; }
  fseek(f, 0, SEEK_SET);
  uint8_t* buf = (uint8_t*)malloc((size_t)sz);
  if (!buf) { fclose(f); return NULL; }
  if (fread(buf, 1, (size_t)sz, f) != (size_t)sz) { free(buf); fclose(f); return NULL; }
  fclose(f);
  *len = (int)sz;
  return buf;
}

int main(int argc, char** argv) {
  if (argc < 3) {
    fprintf(stderr, "usage: <in.emf|wmf> <out.svg> [--dpi N]\n");
    return 2;
  }
  const char* inPath = argv[1];
  const char* outPath = argv[2];
  int dpi = 96;
  for (int i = 3; i + 1 < argc; ++i) {
    if ((strcmp(argv[i], "--dpi") == 0)) dpi = atoi(argv[i+1]);
  }
  int inLen = 0;
  uint8_t* inBuf = read_all(inPath, &inLen);
  if (!inBuf) { fprintf(stderr, "read failed\n"); return 3; }

  uint8_t* outBuf = NULL;
  int outLen = 0;
  int rc = convert(inBuf, inLen, dpi, &outBuf, &outLen);
  free(inBuf);
  if (rc != 0 || !outBuf || outLen <= 0) { fprintf(stderr, "convert failed (%d)\n", rc); return 4; }

  FILE* fo = fopen(outPath, "wb");
  if (!fo) { free(outBuf); fprintf(stderr, "write open failed\n"); return 5; }
  fwrite(outBuf, 1, (size_t)outLen, fo);
  fclose(fo);
  free(outBuf);
  return 0;
}
