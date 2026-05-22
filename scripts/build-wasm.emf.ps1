$ErrorActionPreference = "Stop"

# --- Paths
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$Out  = Join-Path $Root "wasm"
$Tmp  = Join-Path $Root ".work-emf"
$BuildScriptPath = Join-Path $Tmp "build_emf.sh"

# --- Ensure Docker is running
try { docker version | Out-Null } catch {
  Write-Error "Docker is not running. Start Docker Desktop (Linux containers) and try again."
  exit 1
}

# --- Prepare folders
if (Test-Path $Out) { Remove-Item $Out -Recurse -Force }
if (Test-Path $Tmp) { Remove-Item $Tmp -Recurse -Force }
New-Item -ItemType Directory -Path $Out | Out-Null
New-Item -ItemType Directory -Path $Tmp | Out-Null

# --- Bash content (pure LF)
$Bash = @'
set -euo pipefail

# top of the script (after set -euo pipefail)
EMF_WASM_DEBUG=${EMF_WASM_DEBUG:-0}



echo "==[BUILD]=============================================="
date
uname -a
echo "========================================================"

# Verbose shell and emcc diagnostics
set -x

# Workspace inside container
mkdir -p /work && cd /work

# Toolchain versions (for logs)
emcc -v || true
echo "----- node -----"; node --version || true
echo "----- wasm-ld -----"; wasm-ld --version || true
echo "----- llvm-objdump -----"; (command -v llvm-objdump && llvm-objdump --version) || echo "llvm-objdump not present"
echo "----- llvm-nm -----"; (command -v llvm-nm && llvm-nm --version) || echo "llvm-nm not present (symbol check will be skipped)"

# 1) Clone libemf2svg
echo "[INFO] Cloning libemf2svg..."
git clone --depth=1 https://github.com/kakwa/libemf2svg.git
cd libemf2svg

# 2) Shims (fontconfig + UTF + wrapper)
mkdir -p /work/shims /work/shims/fontconfig

# 2a) fontconfig shim (header-only)
cat > /work/shims/fontconfig/fontconfig.h <<'H'
#ifndef FONTCONFIG_SHIM_H
#define FONTCONFIG_SHIM_H

#ifdef __cplusplus
extern "C" {
#endif

/* minimal typedefs */
typedef int           FcBool;
typedef unsigned char FcChar8;
typedef int           FcResult;

typedef struct _FcPattern   { int dummy; } FcPattern;
typedef struct _FcObjectSet { int dummy; } FcObjectSet;
typedef struct _FcConfig    { int dummy; } FcConfig;
typedef struct _FcFontSet   { int nfont; FcPattern** fonts; } FcFontSet;

/* constants (on separate lines to keep preprocessor happy) */
#ifndef FcTrue
#define FcTrue 1
#endif

#ifndef FcFalse
#define FcFalse 0
#endif

#ifndef FcResultMatch
#define FcResultMatch 0
#endif

#ifndef FC_FAMILY
#define FC_FAMILY "family"
#endif

#ifndef FC_STYLE
#define FC_STYLE "style"
#endif

#ifndef FC_SLANT
#define FC_SLANT "slant"
#endif

#ifndef FC_WEIGHT
#define FC_WEIGHT "weight"
#endif

#ifndef FC_FILE
#define FC_FILE "file"
#endif

#ifndef FC_SLANT_ROMAN
#define FC_SLANT_ROMAN 0
#endif

#ifndef FC_SLANT_ITALIC
#define FC_SLANT_ITALIC 100
#endif

#ifndef FC_WEIGHT_THIN
#define FC_WEIGHT_THIN 0
#endif

#ifndef FC_WEIGHT_EXTRALIGHT
#define FC_WEIGHT_EXTRALIGHT 40
#endif

#ifndef FC_WEIGHT_LIGHT
#define FC_WEIGHT_LIGHT 50
#endif

#ifndef FC_WEIGHT_BOOK
#define FC_WEIGHT_BOOK 75
#endif

#ifndef FC_WEIGHT_MEDIUM
#define FC_WEIGHT_MEDIUM 100
#endif

#ifndef FC_WEIGHT_DEMIBOLD
#define FC_WEIGHT_DEMIBOLD 180
#endif

#ifndef FC_WEIGHT_BOLD
#define FC_WEIGHT_BOLD 200
#endif

#ifndef FC_WEIGHT_HEAVY
#define FC_WEIGHT_HEAVY 215
#endif

#ifndef FC_WEIGHT_BLACK
#define FC_WEIGHT_BLACK 210
#endif

#ifndef FcMatchPattern
#define FcMatchPattern 0
#endif

/* no-op implementations used by libemf2svg in our build */
static inline FcBool     FcInit(void) { return FcTrue; }
static inline void       FcFini(void) {}

static inline FcPattern* FcPatternCreate(void){ static FcPattern p; return &p; }
static inline void       FcPatternDestroy(FcPattern* p){ (void)p; }

static inline FcBool     FcConfigSubstitute(FcConfig* c, FcPattern* p, int k){ (void)c; (void)p; (void)k; return FcTrue; }
static inline FcBool     FcDefaultSubstitute(FcPattern* p){ (void)p; return FcTrue; }

static inline FcPattern* FcNameParse(const FcChar8* name){ (void)name; static FcPattern p; return &p; }

static inline FcBool     FcPatternAddString(FcPattern* p, const char* o, const FcChar8* s){ (void)p; (void)o; (void)s; return FcTrue; }
static inline FcBool     FcPatternAddInteger(FcPattern* p, const char* o, int v){ (void)p; (void)o; (void)v; return FcTrue; }

static inline FcResult   FcPatternGetString(const FcPattern* p, const char* o, int idx, FcChar8** s){
  (void)p; (void)o; (void)idx; if (s) *s = (FcChar8*)""; return FcResultMatch;
}
static inline FcResult   FcPatternGetInteger(const FcPattern* p, const char* o, int idx, int* v){
  (void)p; (void)o; (void)idx; if (v) *v = 0; return FcResultMatch;
}

static inline FcPattern* FcFontMatch(FcConfig* c, FcPattern* p, FcResult* r){
  (void)c; (void)p; if (r) *r = FcResultMatch; static FcPattern m; return &m;
}

static inline FcObjectSet* FcObjectSetBuild(const char* n, ...){ (void)n; static FcObjectSet os; return &os; }
static inline void         FcObjectSetDestroy(FcObjectSet* os){ (void)os; }

static inline FcFontSet*   FcFontSetCreate(void){ static FcFontSet fs; fs.nfont = 0; fs.fonts = 0; return &fs; }
static inline FcBool       FcFontSetAdd(FcFontSet* fs, FcPattern* p){ (void)p; if (fs) fs->nfont += 0; return FcTrue; }
static inline FcPattern*   FcPatternFilter(FcPattern* p, FcObjectSet* os){ (void)os; return p; }

static inline FcFontSet*   FcFontSetList(FcConfig* c, void* sets, int nsets, FcPattern* p, FcObjectSet* os){
  (void)c; (void)sets; (void)nsets; (void)p; (void)os; static FcFontSet fs; fs.nfont = 0; fs.fonts = 0; return &fs;
}
static inline void         FcFontSetDestroy(FcFontSet* fs){ (void)fs; }

#ifdef __cplusplus
}
#endif

#endif /* FONTCONFIG_SHIM_H */
H

# 2b) UTF shim kept for older experiments; the current build uses vendored libuemf UTF sources.
cat > /work/shims/utf_shim.c <<'C'
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
static int utf16le_to_utf8_core(const uint16_t* in, size_t in_len, char** out, size_t* out_len){
  if(!in||!out||!out_len) return 1; size_t cap=in_len*3+1; char* buf=(char*)malloc(cap); if(!buf) return 2;
  size_t o=0,i=0; while(i<in_len){ uint16_t w=in[i++]; uint32_t cp;
    if(w>=0xD800&&w<=0xDBFF&&i<in_len){ uint16_t w2=in[i++]; cp=(w2>=0xDC00&&w2<=0xDFFF)?(0x10000+(((w-0xD800)<<10)|(w2-0xDC00))):0xFFFD; }
    else if(w>=0xDC00&&w<=0xDFFF) cp=0xFFFD; else cp=w;
    if(cp<0x80) buf[o++]=(char)cp;
    else if(cp<0x800){ buf[o++]=(char)(0xC0|(cp>>6)); buf[o++]=(char)(0x80|(cp&0x3F)); }
    else if(cp<0x10000){ buf[o++]=(char)(0xE0|(cp>>12)); buf[o++]=(char)(0x80|((cp>>6)&0x3F)); buf[o++]=(char)(0x80|(cp&0x3F)); }
    else { buf[o++]=(char)(0xF0|(cp>>18)); buf[o++]=(char)(0x80|((cp>>12)&0x3F)); buf[o++]=(char)(0x80|((cp>>6)&0x3F)); buf[o++]=(char)(0x80|(cp&0x3F)); }
  } buf[o]=0; *out=buf; *out_len=o; return 0;
}
static int utf8_to_utf32le_core(const char* in,size_t in_len,uint32_t** out,size_t* out_len){
  if(!in||!out||!out_len) return 1; uint32_t* buf=(uint32_t*)malloc((in_len+1)*sizeof(uint32_t)); if(!buf) return 2;
  size_t i=0,o=0; while(i<in_len){ unsigned char c=(unsigned char)in[i++]; uint32_t cp=0xFFFD;
    if(c<0x80) cp=c; else if((c>>5)==0x6 && i<in_len){ unsigned char c2=(unsigned char)in[i++]; cp=((c&0x1F)<<6)|(c2&0x3F); }
    else if((c>>4)==0xE && i+1<in_len){ unsigned char c2=(unsigned char)in[i++], c3=(unsigned char)in[i++]; cp=((c&0x0F)<<12)|((c2&0x3F)<<6)|(c3&0x3F); }
    else if((c>>3)==0x1E && i+2<in_len){ unsigned char c2=(unsigned char)in[i++], c3=(unsigned char)in[i++], c4=(unsigned char)in[i++]; cp=((c&0x07)<<18)|((c2&0x3F)<<12)|((c3&0x3F)<<6)|(c4&0x3F); }
    buf[o++]=cp;
  } *out=buf; *out_len=o; return 0;
}
static int utf16le_to_utf32le_core(const uint16_t* in,size_t in_len,uint32_t** out,size_t* out_len){
  if(!in||!out||!out_len) return 1; uint32_t* buf=(uint32_t*)malloc((in_len+1)*sizeof(uint32_t)); if(!buf) return 2;
  size_t i=0,o=0; while(i<in_len){ uint16_t w=in[i++]; uint32_t cp;
    if(w>=0xD800&&w<=0xDBFF&&i<in_len){ uint16_t w2=in[i++]; cp=(w2>=0xDC00&&w2<=0xDFFF)?(0x10000+(((w-0xD800)<<10)|(w2-0xDC00))):0xFFFD; }
    else if(w>=0xDC00&&w<=0xDFFF) cp=0xFFFD; else cp=w; buf[o++]=cp;
  } *out=buf; *out_len=o; return 0;
}
static int utf32le_to_utf8_core(const uint32_t* in,size_t in_len,char** out,size_t* out_len){
  if(!in||!out||!out_len) return 1; char* buf=(char*)malloc(in_len*4+1); if(!buf) return 2;
  size_t o=0; for(size_t i=0;i<in_len;i++){ uint32_t cp=in[i];
    if(cp<0x80) buf[o++]=(char)cp;
    else if(cp<0x800){ buf[o++]=0xC0|(cp>>6); buf[o++]=0x80|(cp&0x3F); }
    else if(cp<0x10000){ buf[o++]=0xE0|(cp>>12); buf[o++]=0x80|((cp>>6)&0x3F); buf[o++]=0x80|(cp&0x3F); }
    else { buf[o++]=0xF0|(cp>>18); buf[o++]=0x80|((cp>>12)&0x3F); buf[o++]=0x80|((cp>>6)&0x3F); buf[o++]=0x80|(cp&0x3F); }
  } buf[o]=0; *out=buf; *out_len=o; return 0;
}
int U_Utf16leToUtf8(const uint16_t* in,int in_len,char** out){ size_t L=0; return utf16le_to_utf8_core(in,(size_t)in_len,out,&L); }
int U_Utf8ToUtf32le(const char* in,int in_len,uint32_t** out){ size_t L=0; return utf8_to_utf32le_core(in,(size_t)in_len,out,&L); }
int U_Utf16leToUtf32le(const uint16_t* in,int in_len,uint32_t** out){ size_t L=0; return utf16le_to_utf32le_core(in,(size_t)in_len,out,&L); }
int U_Utf32leToUtf8(const uint32_t* in,int in_len,char** out){ size_t L=0; return utf32le_to_utf8_core(in,(size_t)in_len,out,&L); }
size_t wchar16len(const uint16_t* s){ size_t i=0; if(!s) return 0; while(s[i]!=0) i++; return i; }
C

# 2c) link-time stubs incl. icount; plus a forced reference so GC can't drop it
cat > /work/shims/lib_stubs.c <<'C'
#include <stddef.h>
#include <stdint.h>
#include <stdlib.h>
#if defined(__GNUC__) || defined(__clang__)
#define WEAK __attribute__((weak))
#define USED __attribute__((used))
#else
#define WEAK
#define USED
#endif
WEAK const char* U_emr_names(int code) { (void)code; return ""; }
WEAK int DIB_to_RGBA(const unsigned char* dib, int dib_size,
                     unsigned char** out_rgba, int* w, int* h,
                     int p6, int p7, int p8, int p9) {
  (void)dib; (void)dib_size; (void)p6; (void)p7; (void)p8; (void)p9;
  if (out_rgba) *out_rgba = NULL; if (w) *w = 0; if (h) *h = 0; return 0;
}
WEAK int image_library_writer(void* ctx,
                              const unsigned char* data, int len,
                              int p4, int p5, int p6) {
  (void)ctx; (void)data; (void)len; (void)p4; (void)p5; (void)p6; return 0;
}
WEAK int U_pmf_onerec_draw(const unsigned char* p, int len,
                           char** svg, size_t* svg_len,
                           int p5, int p6) {
  (void)p; (void)len; (void)svg; (void)svg_len; (void)p5; (void)p6; return 0;
}
WEAK int U_pmf_onerec_print(const unsigned char* p, int len,
                            char** out, size_t* out_len,
                            int p5, int p6) {
  (void)p; (void)len; (void)out; (void)out_len; (void)p5; (void)p6; return 0;
}
WEAK int get_real_color_count(const unsigned char* rgba) { (void)rgba; return 0; }
USED WEAK int get_real_color_icount(int a, int b, int c, int d) {
  (void)a; (void)b; (void)c; (void)d; return 0;
}
WEAK void freeEmfImageLibrary(void* p) { if (p) free(p); }

C

# 2c.1) Force a reference to the symbol so it cannot be dropped even if weak
cat > /work/shims/lib_force_ref.c <<'C'
#ifdef __cplusplus
extern "C" {
#endif
int get_real_color_icount(int, int, int, int);
#ifdef __cplusplus
}
#endif
__attribute__((used)) static int (*volatile __force_ref_icount)(int,int,int,int) = get_real_color_icount;
C

# (Optional) Try to print the symbol table if tools exist (non-fatal)
emcc /work/shims/lib_stubs.c -c -o /work/shims/lib_stubs.o || exit 1
if command -v llvm-nm >/dev/null 2>&1; then
  echo "----- llvm-nm on lib_stubs.o (expect get_real_color_icount) -----"
  llvm-nm -g /work/shims/lib_stubs.o || true
else
  echo "[WARN] llvm-nm not available; skipping nm symbol check"
fi

# 2d) minimal wrapper exporting `convert`
cat > /work/wrapper_emf.c <<'C'
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "emf2svg.h"
#include "fontconfig/fontconfig.h"
int convert(const uint8_t* in, int len, int dpi, uint8_t** out, int* out_len) {
  (void)dpi;
  FcInit();
  char*  svg = NULL; size_t L = 0;
  generatorOptions opt; memset(&opt, 0, sizeof(opt));
  opt.verbose=0; opt.emfplus=0; opt.nameSpace="svg"; opt.svgDelimiter=1; opt.imgWidth=0; opt.imgHeight=0;
  int rc = emf2svg((char*)in, (size_t)len, &svg, &L, &opt);
  FcFini();
  if (rc != 1 || !svg || L == 0) return rc == 1 ? 99 : 1;
  *out=(uint8_t*)svg; *out_len=(int)L; return 0;
}
C

# 2e) CLI shim
cat > /work/cli_main.c <<'C'
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>

/* Unconditional prototype so C builds see it too */
#ifdef __cplusplus
extern "C" {
#endif
int convert(const uint8_t* in, int len, int dpi, uint8_t** outPtr, int* outLen);
#ifdef __cplusplus
}
#endif

static uint8_t* read_all(const char* path, int* len) {
  FILE* f = fopen(path, "rb");
  if (!f) return NULL;
  if (fseek(f, 0, SEEK_END) != 0) { fclose(f); return NULL; }
  long sz = ftell(f);
  if (sz < 0) { fclose(f); return NULL; }
  if (fseek(f, 0, SEEK_SET) != 0) { fclose(f); return NULL; }
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
    if (strcmp(argv[i], "--dpi") == 0) dpi = atoi(argv[i+1]);
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
C

# 3) Gather sources (newline list)
FILES_TXT=/work/files.list
: > "$FILES_TXT"
find src -type f -name "*.c" \
  ! -path "src/conv/*" \
  ! -iname "pmf*.c" \
  ! -iname "wmf*.c" \
  -print >> "$FILES_TXT"
find src -type f -name "*.cpp" \
  ! -path "src/conv/*" \
  ! -iname "pmf*.cpp" \
  ! -iname "wmf*.cpp" \
  -print >> "$FILES_TXT"
# Ensure print unit is present
if ! grep -q '^src/lib/emf2svg_print.c$' "$FILES_TXT"; then
  if [ -f src/lib/emf2svg_print.c ]; then echo 'src/lib/emf2svg_print.c' >> "$FILES_TXT"; fi
fi

# Prepend the wrapper and the same core sources libemf2svg uses in CMake.
ALL_TXT=/work/allfiles.list
{
  echo /work/wrapper_emf.c
  echo src/lib/pmf2svg.c
  echo src/lib/pmf2svg_print.c
  echo vendor/libuemf/uemf_utf.c
  echo vendor/libuemf/uemf_endian.c
  echo vendor/libuemf/uemf.c
  echo vendor/libuemf/upmf.c
  cat "$FILES_TXT"
} > "$ALL_TXT"

echo "---- allfiles.list ----"; cat /work/allfiles.list; echo "------------------------"

# 4) Prime emscripten ports
echo 'int __dummy(void){return 0;}' >/tmp/empty.c
emcc -O3 -c /tmp/empty.c -o /tmp/empty.o -sUSE_ZLIB=1 -sUSE_FREETYPE=1 -sUSE_LIBPNG=1 >/dev/null 2>&1 || true

# --- visibility for debugging
echo "Source file count:"; wc -l "$ALL_TXT" || true
echo "First few files:";   head -n 20 "$ALL_TXT" || true
echo "Last few files:";    tail -n 20 "$ALL_TXT" || true

# Guard
CNT="$(wc -l "$ALL_TXT" | awk '{print $1}')"; [ -z "$CNT" ] && CNT=0
if [ "$CNT" -lt 3 ]; then echo "ERROR: Source list unexpectedly small ($CNT). Aborting." 1>&2; exit 3; fi

# 5) Detect header dir and compile/link without xargs (ensure -I precede sources)
INC_DIRS=""
for d in inc include src src/lib ; do
  if [ -f "$d/emf2svg.h" ]; then
    INC_DIRS="$INC_DIRS -I/work/libemf2svg/$d"
  fi
done
# Always include our shims too
INC_DIRS="$INC_DIRS -I/work/libemf2svg/vendor/libuemf -I/work/libemf2svg/vendor/libuemf/include -I/work/shims -I/work/shims/fontconfig -I/work/libemf2svg -I/work"

# Build a single list of sources so options come first
SRCS="$(tr '\n' ' ' < /work/allfiles.list)"

emcc -O2 -g0 \
  -s MODULARIZE=1 -s EXPORT_ES6=1 \
  -s ENVIRONMENT=node -s FORCE_FILESYSTEM=1 \
  -s ALLOW_MEMORY_GROWTH=1 -s INITIAL_MEMORY=256MB -s STACK_SIZE=2MB \
  -s ASSERTIONS=1 -s SAFE_HEAP=0 \
  -s INVOKE_RUN=0 -s EXIT_RUNTIME=1 \
  -s EXPORTED_FUNCTIONS='["_malloc","_free","_convert"]' \
  -s EXPORTED_RUNTIME_METHODS='["getValue","setValue","FS","HEAPU8","HEAP8","HEAP32","cwrap","ccall"]' \
  -s USE_ZLIB=1 -s USE_FREETYPE=1 -s USE_LIBPNG=1 \
  -Wl,--fatal-warnings \
  $INC_DIRS \
  $SRCS \
  -o /out/emf2svg.js


if [ "$EMF_WASM_DEBUG" = "1" ] && [ -f /out/emf2svg.wasm ]; then
  /emsdk/upstream/bin/wasm-opt --safe-heap /out/emf2svg.wasm -o /out/emf2svg.wasm -g || echo "[WARN] wasm-opt not available"
fi


echo "----- OUT DIR -----"; ls -lh /out
echo "==================== BUILD DONE ========================"
'@

# --- Write LF bash to disk
$BashLF = $Bash -replace "`r`n", "`n"
[System.IO.File]::WriteAllText($BuildScriptPath, $BashLF, (New-Object System.Text.UTF8Encoding($false)))

# --- Run container
docker run --rm `
  -v "${Out}:/out" `
  -v "${BuildScriptPath}:/build.sh:ro" `
  emscripten/emsdk:latest `
  bash -lc "bash /build.sh"

# --- Verify outputs
$js   = Join-Path $Out "emf2svg.js"
$wasm = Join-Path $Out "emf2svg.wasm"
if (!(Test-Path $js) -or !(Test-Path $wasm)) {
  Write-Error "Build did not produce wasm/emf2svg.js/.wasm"
  exit 1
}
if ((Get-Item $js).Length -eq 0 -or (Get-Item $wasm).Length -eq 0) {
  Write-Error "Output files are zero-length."
  exit 1
}
Write-Host "Built: $js and $wasm"
