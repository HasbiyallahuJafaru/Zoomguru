## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- Before editing any file, query the graph to confirm all import/export contracts and IPC channel wiring
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

God nodes (highest connectivity — changes here ripple everywhere):
- createWindow() — main.ts, owns window lifecycle and screen protection
- applyScreenShareExclusion() — called before show(), must stay before ready-to-show
- streamScreenshot() / streamAnswer() — Overlay.tsx, core AI request functions
- apiFetch() — shared auth-aware fetch wrapper
- getDeviceFingerprint() — fingerprint.ts, device ID source of truth
