# ADR-001: Static-First Architecture with Zero Mandatory Backend

## Status
Accepted

## Context
Educational institutions, students, and instructors require a zero-maintenance, highly available programming environment for Python, Java, and C++. Traditional remote code execution setups require costly multi-tenant sandboxed server clusters, vulnerability patching, network connectivity, and recurring cloud expenses. Furthermore, student privacy is compromised when user code and filenames are transferred to central servers.

## Decision
1. The Browser IDE will be built as an entirely static Single Page Application (SPA) / Progressive Web App (PWA).
2. All compilation and code execution for Python >= 3.14, Java >= 11, and C++ >= C++17 will occur locally inside the browser using WebAssembly workers.
3. The baseline application must function on generic HTTPS hosts (such as GitHub Pages or campus static file hosts) without custom server headers (`Cross-Origin-Opener-Policy` or `Cross-Origin-Embedder-Policy`).
4. Any optional services (such as LTI 1.3 Canvas integration or trusted remote grading) are isolated to separate modules and will never be required to run the core IDE.

## Consequences
- **Positive**: Zero backend hosting costs, instant scaling, privacy-preserving by default, fully offline-capable once assets are cached.
- **Negative / Constraints**: Compiler and runtime toolchains must be bundled or lazy-loaded as WebAssembly modules. Runtimes must accommodate browser resource budgets and non-isolated threading limitations.
