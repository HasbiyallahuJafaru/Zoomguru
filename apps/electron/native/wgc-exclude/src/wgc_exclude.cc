// wgc_exclude.cc
// Native Node.js addon — Windows screen capture exclusion via SetWindowDisplayAffinity.
// Excludes an HWND from both DXGI (Zoom/Teams legacy) and WGC
// (Windows.Graphics.Capture — Chrome Meet, new Teams) capture pipelines.
//
// Compile requirements:
//   MSVC with /std:c++17, Windows SDK 10.0.19041+ (for WDA_EXCLUDEFROMCAPTURE)
//   Link: user32.lib, d3d11.lib, dxgi.lib
//
// Fallback chain:
//   1. WDA_EXCLUDEFROMCAPTURE (0x11) — Win10 2004+ / Win11 — hides from all capture
//   2. WDA_MONITOR             (0x01) — Win10 pre-2004 — hides from screen mirroring
//   3. Return success=false if both fail

#ifdef _WIN32

#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <winuser.h>
#include <ntstatus.h>
#include <napi.h>
#include <string>
#include <cstdint>

// WDA_EXCLUDEFROMCAPTURE was added in Windows SDK 10.0.19041 (20H1 / 2004).
// Define it ourselves if the SDK we're building against doesn't have it.
#ifndef WDA_EXCLUDEFROMCAPTURE
#define WDA_EXCLUDEFROMCAPTURE 0x00000011
#endif

#ifndef WDA_MONITOR
#define WDA_MONITOR 0x00000001
#endif

#ifndef WDA_NONE
#define WDA_NONE 0x00000000
#endif

// ---------------------------------------------------------------------------
// RtlGetVersion — runtime OS version (bypasses compatibility shim that makes
// GetVersionEx lie about the version on Windows 8.1+).
// ---------------------------------------------------------------------------
typedef LONG (NTAPI *RtlGetVersionFn)(PRTL_OSVERSIONINFOW);

struct WinVersion {
  DWORD major;
  DWORD minor;
  DWORD build;
};

static WinVersion GetRealWindowsVersion() {
  WinVersion v = { 0, 0, 0 };
  HMODULE ntdll = GetModuleHandleW(L"ntdll.dll");
  if (!ntdll) return v;

  auto RtlGetVersion = reinterpret_cast<RtlGetVersionFn>(
    GetProcAddress(ntdll, "RtlGetVersion")
  );
  if (!RtlGetVersion) return v;

  RTL_OSVERSIONINFOW info = {};
  info.dwOSVersionInfoSize = sizeof(info);
  if (RtlGetVersion(&info) == 0 /* STATUS_SUCCESS */) {
    v.major = info.dwMajorVersion;
    v.minor = info.dwMinorVersion;
    v.build = info.dwBuildNumber;
  }
  return v;
}

// ---------------------------------------------------------------------------
// Helper: extract HWND from a Node.js Buffer.
// getNativeWindowHandle() returns a Buffer whose bytes are the HWND pointer.
// On x64 it is 8 bytes; on x86 it is 4 bytes.
// ---------------------------------------------------------------------------
static HWND HwndFromBuffer(const Napi::Buffer<uint8_t>& buf) {
  const size_t len = buf.ByteLength();
  const uint8_t* data = buf.Data();
  if (len == 8) {
    uint64_t val = 0;
    memcpy(&val, data, 8);
    return reinterpret_cast<HWND>(static_cast<uintptr_t>(val));
  }
  if (len == 4) {
    uint32_t val = 0;
    memcpy(&val, data, 4);
    return reinterpret_cast<HWND>(static_cast<uintptr_t>(val));
  }
  // Fallback: treat raw pointer bytes
  uintptr_t val = 0;
  memcpy(&val, data, std::min(len, sizeof(uintptr_t)));
  return reinterpret_cast<HWND>(val);
}

// ---------------------------------------------------------------------------
// Exported: excludeFromCapture(hwndBuffer)
//
// Returns { success: bool, method: string, error?: string }
//
// Strategy:
//   - Try WDA_EXCLUDEFROMCAPTURE first (covers DXGI + WGC on Win10 2004+)
//   - Fall back to WDA_MONITOR (covers DXGI screen mirroring on older builds)
//   - Re-applying on show events is done from JS/main.ts side; this function
//     is idempotent and safe to call multiple times on the same HWND.
// ---------------------------------------------------------------------------
Napi::Value ExcludeFromCapture(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Object result = Napi::Object::New(env);

  if (info.Length() < 1) {
    result.Set("success", Napi::Boolean::New(env, false));
    result.Set("error",   Napi::String::New(env, "hwnd argument required"));
    result.Set("method",  env.Null());
    return result;
  }

  HWND hwnd = nullptr;

  if (info[0].IsBuffer()) {
    hwnd = HwndFromBuffer(info[0].As<Napi::Buffer<uint8_t>>());
  } else if (info[0].IsBigInt()) {
    bool lossless = true;
    uint64_t val = info[0].As<Napi::BigInt>().Uint64Value(&lossless);
    hwnd = reinterpret_cast<HWND>(static_cast<uintptr_t>(val));
  } else if (info[0].IsNumber()) {
    // 32-bit handles passed as JS number (legacy / 32-bit build)
    uint32_t val = info[0].As<Napi::Number>().Uint32Value();
    hwnd = reinterpret_cast<HWND>(static_cast<uintptr_t>(val));
  } else {
    result.Set("success", Napi::Boolean::New(env, false));
    result.Set("error",   Napi::String::New(env, "hwnd must be a Buffer, BigInt, or Number"));
    result.Set("method",  env.Null());
    return result;
  }

  if (!hwnd || !IsWindow(hwnd)) {
    result.Set("success", Napi::Boolean::New(env, false));
    result.Set("error",   Napi::String::New(env, "invalid or destroyed HWND"));
    result.Set("method",  env.Null());
    return result;
  }

  // --- Attempt 1: WDA_EXCLUDEFROMCAPTURE ---
  // This flag was introduced in Windows 10 build 19041 (version 2004).
  // It excludes the window from ALL capture APIs: DXGI Desktop Duplication,
  // Windows.Graphics.Capture, and PrintWindow.
  BOOL ok = SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE);
  if (ok) {
    result.Set("success", Napi::Boolean::New(env, true));
    result.Set("method",  Napi::String::New(env, "WDA_EXCLUDEFROMCAPTURE"));
    return result;
  }

  DWORD err1 = GetLastError();

  // --- Attempt 2: WDA_MONITOR ---
  // Available since Windows 7. Excludes the window from screen mirroring /
  // DXGI Desktop Duplication, but NOT from WGC. Better than nothing on
  // Windows 10 pre-2004 where WDA_EXCLUDEFROMCAPTURE is unavailable.
  ok = SetWindowDisplayAffinity(hwnd, WDA_MONITOR);
  if (ok) {
    result.Set("success", Napi::Boolean::New(env, true));
    result.Set("method",  Napi::String::New(env, "WDA_MONITOR"));
    return result;
  }

  DWORD err2 = GetLastError();

  // Both attempts failed — report the errors from both tries.
  char errBuf[128];
  snprintf(
    errBuf, sizeof(errBuf),
    "WDA_EXCLUDEFROMCAPTURE failed (err=%lu), WDA_MONITOR failed (err=%lu)",
    static_cast<unsigned long>(err1),
    static_cast<unsigned long>(err2)
  );

  result.Set("success", Napi::Boolean::New(env, false));
  result.Set("error",   Napi::String::New(env, errBuf));
  result.Set("method",  env.Null());
  return result;
}

// ---------------------------------------------------------------------------
// Exported: getWindowsVersion()
// Returns { major: number, minor: number, build: number }
// Uses RtlGetVersion to bypass the Windows compatibility shim.
// ---------------------------------------------------------------------------
Napi::Value GetWindowsVersion(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  WinVersion v = GetRealWindowsVersion();
  Napi::Object obj = Napi::Object::New(env);
  obj.Set("major", Napi::Number::New(env, static_cast<double>(v.major)));
  obj.Set("minor", Napi::Number::New(env, static_cast<double>(v.minor)));
  obj.Set("build", Napi::Number::New(env, static_cast<double>(v.build)));
  return obj;
}

// ---------------------------------------------------------------------------
// Module init
// ---------------------------------------------------------------------------
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(
    Napi::String::New(env, "excludeFromCapture"),
    Napi::Function::New(env, ExcludeFromCapture)
  );
  exports.Set(
    Napi::String::New(env, "getWindowsVersion"),
    Napi::Function::New(env, GetWindowsVersion)
  );
  return exports;
}

NODE_API_MODULE(wgc_exclude, Init)

#else // Non-Windows stub — should never be loaded (index.js fallback catches it)

#include <napi.h>

Napi::Value ExcludeFromCapture(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Object result = Napi::Object::New(env);
  result.Set("success", Napi::Boolean::New(env, false));
  result.Set("error",   Napi::String::New(env, "not supported on this platform"));
  result.Set("method",  env.Null());
  return result;
}

Napi::Value GetWindowsVersion(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  Napi::Object obj = Napi::Object::New(env);
  obj.Set("major", Napi::Number::New(env, 0));
  obj.Set("minor", Napi::Number::New(env, 0));
  obj.Set("build", Napi::Number::New(env, 0));
  return obj;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "excludeFromCapture"),
              Napi::Function::New(env, ExcludeFromCapture));
  exports.Set(Napi::String::New(env, "getWindowsVersion"),
              Napi::Function::New(env, GetWindowsVersion));
  return exports;
}

NODE_API_MODULE(wgc_exclude, Init)

#endif // _WIN32
