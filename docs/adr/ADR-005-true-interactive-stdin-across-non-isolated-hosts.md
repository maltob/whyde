# ADR-005: Interactive Stdin & Execution Control Across Non-Isolated Hosts

## Status
Accepted

## Context
Standard generic static web hosting (GitHub Pages, basic S3/CloudFront, local intranet static servers) cannot guarantee `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` HTTP headers. Without these headers, `SharedArrayBuffer` and `Atomics.wait` are disabled for security reasons, making synchronous blocking `stdin` prompts difficult across Web Worker boundaries.

## Decision
1. Baseline stdin architecture must not require `SharedArrayBuffer`.
2. Execution engine uses an asynchronous event-driven lifecycle:
   - Worker emits `{ type: 'stdin-request', requestId, prompt }`.
   - Main thread displays stdin input prompt in console / accessible form.
   - When user submits input, main thread invokes `supplyInput(runId, requestId, text)`.
   - For runtimes with cooperative async hooks (like Pyodide's JS promise/async input or message queues), stdin input is fed asynchronously.
   - For WASI/JVM runners without SAB, provide buffered/line-oriented stdin queues and graceful EOF handling.
3. Stop/Interrupt mechanism:
   - Attempt cooperative cancellation via abort signal or runtime interrupt flag.
   - If execution fails to halt within a short grace period (e.g. 500ms), main thread calls `worker.terminate()` and spins up a fresh worker instance.

## Consequences
- Guarantees 100% operation on GitHub Pages and zero-header static servers.
- Preserves full accessibility: allows separate screen-reader-friendly text input prompt.
