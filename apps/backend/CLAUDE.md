## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- Before editing any file, query the graph to confirm all import/export contracts, guard chains, and DB query shapes
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

God nodes (highest connectivity — changes here ripple everywhere):
- getDB() — database/db.ts, every service imports this; never rename or move
- AuthController / AuthService — auth hub, login/register/device binding
- AdminController / AdminService — admin stats, separate x-admin-key auth
- CvService — CV parsing and profile injection into AI prompts
- PaystackService — payment webhook processing
- SessionController — session start/end lifecycle
