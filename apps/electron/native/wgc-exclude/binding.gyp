{
  "targets": [{
    "target_name": "wgc_exclude",
    "sources": ["src/wgc_exclude.cc"],
    "include_dirs": ["<!@(node -p \"require('node-addon-api').include\")"],
    "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
    "conditions": [
      ["OS=='win'", {
        "libraries": ["-luser32.lib", "-ld3d11.lib", "-ldxgi.lib"],
        "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
        "msvs_settings": {
          "VCCLCompilerTool": {
            "AdditionalOptions": ["/std:c++17"]
          }
        }
      }]
    ]
  }]
}
