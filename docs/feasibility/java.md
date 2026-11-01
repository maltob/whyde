# Feasibility Report: Java 11+ In-Browser Compilation & Execution (POC-C & POC-C2)

## 1. Candidate Tracks Under Investigation
- **Track A**: Browser-compiled Eclipse ECJ (EPL-2.0) + BJVM (Rust/WASM JVM, MIT).
- **Track B**: 199xVM (TypeScript compiler + WebAssembly interpreter, MIT).
- **Strict Exclusion**: CheerpJ (Proprietary redistribution restrictions violated; rejected per Section 2.1 & 21.2).

---

## 2. Distinction: Contract Simulation vs Real In-Browser Engine

> [!IMPORTANT]
> The initial test suite in `pocs/java-oss/runner.test.ts` validated the **execution contracts, state machine transitions, event streams, and error reporting schema**, but it used simulated execution fixtures.
>
> In accordance with **Codex Specification Sections 0 (Rule 4), 2.1, 2.4, and 21.3**, the project **does not claim production Java 11 readiness** based solely on contract simulation. Java remains formally classified as **`JAVA_EXPERIMENTAL_INVESTIGATION`** until real compiled WASM/JVM artifacts pass the POC-C2 qualification gates.

---

## 3. The Core Challenge: Interactive `Scanner(System.in)` Without `SharedArrayBuffer`

On generic static hosts like GitHub Pages, the browser environment does **not** provide `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers. Consequently:
- `SharedArrayBuffer` is disabled.
- Synchronous blocking primitives (`Atomics.wait()`) cannot be used to suspend worker threads waiting on input.
- Standard Java `Scanner.nextLine()` or `System.in.read()` expects synchronous blocking.

### Suspension Mechanisms Required for a Real In-Browser JVM:
To support interactive stdin without freezing the browser or Web Worker message loop, the selected OSS engine must provide one of the following:
1. **Cooperative JVM Suspension / Continuation**: The JVM interpreter yields its execution tick when an I/O read is blocked, returning control to the worker event loop, and resumes execution when a `supplyInput` message arrives.
2. **Asyncify / Fiber Transformation**: WASM-level continuation unwinding (e.g. Binaryen Asyncify) that pauses the WASM stack and rewinds upon input resolution.
3. **Pre-supplied Stdin Fallback**: Documented reduced-capability mode if true asynchronous pause is unavailable for specific complex patterns.

---

## 4. POC-C2: Production Integration Qualification Plan

Before either candidate is incorporated into the production IDE (`@ide/runner-java`), it must pass the following 5 acceptance gates on a real static deployment across Chrome, Edge, Firefox, and Safari:

| Gate | Acceptance Criteria | Target Metric |
|---|---|---|
| **1. Actual Browser Execution** | Compile fresh user-authored `.java` code to bytecode and execute in-browser using real WASM/JS artifacts with network inspection confirming zero remote compilation/execution calls. | 100% Client-side |
| **2. True Interactive Stdin** | Request multiple sequential inputs via `Scanner.nextLine()`, including blank lines, delayed responses (>5s pause), and EOF handling without freezing worker message dispatch. | Full interactive input |
| **3. Runtime Compatibility** | Verify Java collections (`ArrayList`, `HashMap`), custom classes across packages, recursive calls, exception stack traces, and local `var`. | Pass spec fixture matrix |
| **4. Reliability & Stress** | Run 100 consecutive compile/run cycles, deliberate compile failures, user cancellations (`stop()`), and project reloads; measure memory to ensure no unbounded leaks. | Zero worker leaks |
| **5. Redistribution & Licenses** | Complete audit of compiler assets, JVM WASM binaries, JDK class library licenses (EPL-2.0 / MIT / Apache-2.0 / GPL Classpath Exception compliance), and third-party notices. | Fully compliant OSS |

---

## 5. Architectural Strategy & Convergence

- **Maintain Strict LanguageRuntime Interface**: Both Track A and Track B adhere to `@ide/execution-contracts`.
- **Single-Engine Adoption**: As soon as either **ECJ + BJVM** or **199xVM** passes the 5 POC-C2 gates, we will immediately converge on that candidate for `@ide/runner-java` rather than maintaining redundant parallel JVM engines.
- **Production Integration Priorities**:
  1. Map compiler diagnostic line/column offsets directly into CodeMirror lint markers.
  2. Stream stdout and stderr into the unified IDE terminal.
  3. Manage worker lifecycle, cooperative interrupt, and fallback `worker.terminate()`.
  4. Virtual filesystem mount for multi-file package layouts (`src/demo/Main.java`).
  5. Cache immutable compiler and JVM WASM artifacts via Service Worker for offline execution.
