# Final Acceptance & Verification Checklist

This document tracks the final acceptance checklist defined in Specification Section 19 across all delivered components.

| Requirement | Implementation Reference | Status | Notes |
|---|---|---|---|
| **Python >=3.14 execution without service** | `@ide/runner-python` | **PASS** | Pyodide 314 series running in dedicated Web Worker, verified with real CPython `unittest.suite`. |
| **Java >=11 source compile and execution without service** | `@ide/runner-java`, `pocs/java-oss`, `docs/feasibility/java.md`, `ADR-008` | **PASS** | Milestone 4 resolved: production `@ide/runner-java` workspace package conforming to `@ide/execution-contracts`, supporting Java 11 syntax (`var`, lambdas), multi-file package compilation, CST/syntax diagnostic reporting, and execution without proprietary CheerpJ. |
| **C++ >=17 compile/link/run without service** | `@ide/runner-cpp` | **PASS** | YoWASP Clang/LLD/WASI toolchain manifest, multi-translation-unit linking, and diagnostics. |
| **Interactive stdin, streamed stdout/stderr and Stop** | `@ide/runner-python`, `@ide/runner-java`, `@ide/runner-cpp`, `@ide/execution-contracts` | **PASS** | Event-driven stdin prompts mid-run without requiring `SharedArrayBuffer` / COOP / COEP headers. |
| **Works on ordinary static HTTPS / GitHub Pages subpath** | `apps/web/vite.config.ts` (`base: './'`), `pocs/hosting-capabilities` | **PASS** | Probed and validated on generic static hosts without custom server headers. |
| **Zero required backend, account or authentication for core IDE** | `@ide/integration-contracts` (`LocalOnlyProvider`) | **PASS** | Completely anonymous local editing and execution. |
| **Multi-file/folder projects and reliable autosave/recovery** | `@ide/storage-browser`, `apps/web/src/FileTree.tsx` | **PASS** | IndexedDB with revision conflict detection and debounced autosave. |
| **Static source URL snapshots** | `@ide/sharing` | **PASS** | Deflate + base64url compressed fragment (`#p=v1.<payload>`) with 8 KiB budget enforcement and bomb defenses. |
| **Instructor packages support I/O tests, scoring points, hints and rubrics** | `@ide/assignments` | **PASS** | Complete schema validation, line-ending normalization, and automated local evaluation. |
| **Client-side scores never misrepresented as trusted or official** | `@ide/assignments`, `apps/web/src/Header.tsx` | **PASS** | Mandatory advisory disclaimer: `"Local estimate — not an official Canvas grade"`. |
| **Anonymous local work; identity only from verified LTI** | `apps/web/src/Header.tsx`, `optional-services/lti-gateway` | **PASS** | Persistent `Local Only` badge; identity scoped to authenticated LTI sessions. |
| **Optional gateway provides verified LTI 1.3 and AGS** | `optional-services/lti-gateway` | **PASS** | Decoupled ASP.NET Core service with SSRF/CORS/replay mitigations and AGS passback. |
| **Offline execution after needed assets cached; safe updates** | `apps/web/public/sw.js`, `manifest.webmanifest` | **PASS** | PWA service worker with pre-caching and dynamic toolchain caching. |
| **WCAG 2.2 AA manual and automated testing completed** | `docs/accessibility-audit-wcag22.md` | **PASS** | Accessible landmarks, high contrast (>15:1), keyboard focus visible rings, and polite terminal ARIA announcements. |
| **Threat-model scenarios and browser/host compatibility matrix pass** | `docs/threat-model.md`, `pocs/hosting-capabilities` | **PASS** | Path traversal protection, DoS limits, and memory exhaust caps. |
| **Open-source dependency licensing and redistribution reviewed** | `THIRD_PARTY_NOTICES.md`, `docs/third-party-manifest.json` | **PASS** | 100% open-source permissive/reciprocal dependencies; CheerpJ excluded. |
| **Reproducible build, documented deployment and maintenance guides** | Monorepo root `package.json`, `README.md` | **PASS** | `pnpm -r build` and `pnpm -r test` pass across the entire monorepo. |
