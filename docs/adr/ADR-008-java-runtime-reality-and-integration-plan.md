# ADR-008: Java Browser Runtime Reality, Verification Gates & Candidate Integration Plan

## Status
Accepted

## Context
Per Spec Sections 0 (Rule 4), 2.1, 2.4, 21.3, and 21.8:
- Prior prototype test harnesses (`pocs/java-oss/runner.ts`) verified the API contract, state machine transitions, diagnostic reporting shapes, and asynchronous stdin queue interfaces, but **did not execute real binary ECJ or in-browser WASM JVM artifacts**.
- Real Java execution in a browser requires:
  1. An actual in-browser Java compiler (e.g. ECJ compiled to WASM/JS or 199xVM parser/compiler) producing valid Java bytecode classfiles.
  2. A real in-browser JVM (BJVM or 199xVM) executing that bytecode and maintaining object models, heap, stack frames, and native method bridges.
  3. **Interactive Synchronous Stdin without SharedArrayBuffer**: Conventional `Scanner(System.in)` calls block the thread synchronously (`in.read()`). On standard static hosts like GitHub Pages where `crossOriginIsolated` is `false` (no `SharedArrayBuffer` / `Atomics.wait`), a synchronous JVM thread cannot block without freezing the worker event loop—unless the JVM natively supports cooperative coroutines/continuation suspension (yielding when input is needed and resuming when input is pushed), or runs with a dedicated communication bridge.
- We must not falsely claim production readiness for Java 11 before verifying real compiler and bytecode execution.

## Decisions

### 1. Transparent Classification
The Java runtime is explicitly classified as **Experimental Investigation Track** (`JAVA_EXPERIMENTAL_INVESTIGATION`) until POC-C2 passes on real binary assets across Chrome, Edge, Firefox, and Safari.

### 2. Single-Candidate Convergence Policy
We adopt the architectural recommendation:
- Maintain the strict `@ide/execution-contracts` `RuntimeProvider` abstraction.
- Rather than maintaining two permanent parallel JVM implementations in production, evaluate the two primary OSS tracks (**Track A: ECJ + BJVM** vs **Track B: 199xVM**) against the 5 POC-C2 production qualification acceptance tests.
- Once one candidate satisfies the requirements, adopt it as the canonical engine for `@ide/runner-java`.

### 3. POC-C2 Acceptance Test Suite
Before sign-off on the Java production adapter (milestone M4), the candidate must pass the 5 POC-C2 gates:
1. **Real Browser Execution**: Compile and run fresh user-authored Java code entirely within a worker using real compiler/JVM WASM/JS assets, verified with zero network calls during execution.
2. **True Interactive Stdin & Suspension**: Handle multiple sequential `Scanner.nextLine()` calls with delayed user inputs, empty lines, and EOF, verifying execution suspension without UI freeze on non-isolated hosts.
3. **Runtime & Class Library Coverage**: Collections (`List`, `Map`, `Set`), recursion, custom classes across multiple files, exception stack unwinding, and memory limits.
4. **Reliability & Memory Leak Stress**: 100 consecutive compile/run cycles, deliberate syntax errors, user cancellations (`stop()`), and disposal without unbounded heap growth.
5. **Redistribution & License Audit**: Verifiable license notices (EPL-2.0 / MIT / Apache-2.0), clean dependency tree, and zero proprietary assets.

### 4. Integration Priorities for `@ide/runner-java`
- Map real compiler diagnostic lines and columns into standard CodeMirror lint squiggles.
- Stream stdout/stderr into the unified console event bus.
- Manage worker lifecycle, cooperative interrupt, and fallback `worker.terminate()`.
- Support virtual filesystem mounts for multi-file package structures (`src/demo/Main.java`).
- Cache pinned compiler and JVM artifacts via Service Worker for offline operation.
