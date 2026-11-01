# Feasibility Report: C++17+ In-Browser Toolchain (POC-D)

## 1. Candidate
- **YoWASP Clang/LLD/LLVM** (Apache-2.0 with LLVM Exception).

## 2. Evaluation Results

| Requirement | Target | Result | Notes |
|---|---|---|---|
| **C++ Standard** | `__cplusplus >= 201703L` | **PASS** | Clang 18 supports `-std=c++17` and `-std=c++20`. |
| **Standard Libraries** | `<iostream>`, `<vector>`, `<string>`, `<optional>` | **PASS** | Bundled libc++ / wasi-sysroot headers and archive libraries. |
| **Multi-file Compilation & Link** | 2+ translation units + LLD linker | **PASS** | Compile `.cpp` to `.o` with `clang.wasm`, link with `lld.wasm` to produce runnable WASM. |
| **Interactive Stdin** | `std::cin` | **PASS** | WASI `fd_read` mapped to async/event stdin bridge. |
| **Zero Backend** | 100% Client-side compilation | **PASS** | Both compiler and linker execute in Web Workers. |
| **Licensing** | Permissive redistribution | **PASS** | Apache-2.0 with LLVM exception; avoids copyleft traps of TraceCC (AGPL). |

## 3. Verdict
- **Approved** for M3 production adapter.
