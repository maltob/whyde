# Third-Party Notices & Open-Source Software Ledger

This document details third-party components evaluated or included in the Browser IDE project in accordance with open-source licensing compliance policies (Specification Section 21).

## 1. Licensing Policy Summary

- **Core Application**: Target license Apache-2.0.
- **Redistribution Rights**: Every dependency and runtime binary must provide verifiable redistribution rights for institutional and self-hosted environments.
- **Proprietary Exclusion**: Proprietary or commercially restricted browser runtimes (including CheerpJ) are explicitly excluded from the core repository, CI, and static releases.
- **Copyleft Awareness**: AGPL-3.0 and strong copyleft components (such as TraceCC) must not be linked into the permissive core library without explicit legal and architectural isolation.

## 2. Ledger of Evaluated Runtimes

### Pyodide
- **License**: Mozilla Public License 2.0 (MPL-2.0)
- **Role**: Python 3.14+ WebAssembly runtime.
- **Verdict**: Approved for Python runtime. Source code available at https://github.com/pyodide/pyodide.

### YoWASP Clang / LLVM / LLD
- **License**: Apache-2.0 with LLVM Exception
- **Role**: C++17+ Clang compiler and LLD WebAssembly linker.
- **Verdict**: Approved for C++ runtime foundation. Source code available at https://github.com/YoWASP/clang.

### Eclipse ECJ (Eclipse Compiler for Java)
- **License**: Eclipse Public License 2.0 (EPL-2.0)
- **Role**: Java 11+ source compiler.
- **Verdict**: Investigation track A for client-side Java bytecode generation. Source code available at https://github.com/eclipse-jdt/eclipse.jdt.core.

### BJVM
- **License**: MIT
- **Role**: Rust-based JVM compiled to WebAssembly targeting Java SE 17.
- **Verdict**: Investigation track A runtime candidate. Source code available at https://github.com/itsu-dev/BJVM.

### 199xVM
- **License**: MIT
- **Role**: TypeScript Java compiler + WebAssembly interpreter.
- **Verdict**: Investigation track B runtime candidate. Source code available at https://github.com/kawasima/199xVM.

### CheerpJ
- **License**: Proprietary / Commercial restrictions
- **Role**: None.
- **Verdict**: **REJECTED**. The Free Community license excludes autonomous academic self-hosting and general redistribution.
