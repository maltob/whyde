# Feasibility Report: Hosting Capabilities (POC-A)

## 1. Objective
Verify browser APIs and deployment capabilities on generic static HTTPS servers (such as GitHub Pages or campus servers) without requiring server-side response headers like `Cross-Origin-Opener-Policy` (COOP) and `Cross-Origin-Embedder-Policy` (COEP).

## 2. Capability Matrix Evaluated

| Capability | Generic HTTPS / GitHub Pages | Isolated Host (COOP/COEP) | Required for Baseline? | Strategy / Fallback |
|---|---|---|---|---|
| **Web Workers** | Supported | Supported | Yes | Primary execution environment for all compilers and interpreters. |
| **WebAssembly** | Supported | Supported | Yes | Core execution format for Pyodide, Clang, and JVMs. |
| **IndexedDB** | Supported | Supported | Yes | Virtual filesystem and project persistence. |
| **OPFS (Origin Private File System)** | Supported in modern browsers | Supported | No (Optional) | Fast blob storage for compiler caches when available; IndexedDB is baseline. |
| **SharedArrayBuffer** | **Disabled** (returns `false`) | Supported | **No** | Use asynchronous messaging for stdin prompts (`stdin-request` -> `supplyInput`). |
| **Subpath URL Routing** | Supported | Supported | Yes | Honor relative base URLs (e.g. `import.meta.env.BASE_URL`). Use query/hash payloads. |
| **Offline Caching (Service Worker)** | Supported | Supported | Yes | Pinned static assets and WebAssembly modules. |

## 3. Results & Verdict
- **Verdict**: **PASS**.
- Baseline requirements can be fully satisfied without `SharedArrayBuffer` by adopting event-driven stdin input and worker cancellation.
- Deployable immediately on subpaths (e.g. `https://username.github.io/whyde/`).
