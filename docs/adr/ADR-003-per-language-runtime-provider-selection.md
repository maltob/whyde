# ADR-003: Open-Source Runtime Provider Selection & Licensing Baseline

## Status
Accepted

## Context
Educational and open-source standards require that the core application be distributed under Apache-2.0 or compatible permissive open-source licensing without proprietary runtime lock-in. Previously, some browser Java/C++ runners relied on proprietary engines (e.g. CheerpJ) or unvetted AGPL-3.0 wrappers (TraceCC).

## Decision
1. **Python**: Select **Pyodide 314.x** (CPython 3.14+ in WebAssembly, MPL-2.0). Pin exact audited releases, test interactive stdin, and run in dedicated worker.
2. **C++**: Select **YoWASP Clang/LLD/LLVM** (Apache-2.0 with LLVM exceptions) wrapped in a project-owned TypeScript/WASI runner adapter. Reject AGPL-3.0 wrappers (TraceCC) from the core permissive codebase to protect redistribution.
3. **Java**: Establish an open-source evaluation track:
   - *Track A*: Browser-hosted Eclipse ECJ (EPL-2.0) compiler + BJVM (Rust/WASM JVM).
   - *Track B*: 199xVM (TypeScript compiler + WASM interpreter).
   - *Strict Ban*: **CheerpJ is excluded** due to non-redistributable proprietary licensing terms in institutional and self-hosted environments.
4. **Feasibility Gating**: Any language that fails browser-based standalone static execution without remote services is labeled `experimental` or blocked rather than quietly backed by remote servers.

## Consequences
- Preserves OSS license compliance and legal redistribution rights.
- Eliminates cloud execution backends.
- Enforces transparent feature matrices for Java and C++ capabilities in the browser.
