# Browser IDE — Complete Codex Implementation Specification

**Version:** 1.1 (OSS runtime review and license-safe baseline)  
**Date:** 2026-11-01  
**Status:** OSS-first architecture; Java and C++ execution gates remain unproven; no proprietary runtime in mandatory build  
**Audience:** Codex/AI software agents, maintainers, reviewers, campus IT, faculty  
**Working project name:** Browser IDE (name/branding configurable)  
**License target:** Apache-2.0 for original project code unless a dependency review necessitates a different license; third-party components retain their own licenses. No proprietary runtime is allowed in the core build.

---

## 0. Non-negotiable requirements and agent instructions

Build a browser IDE for **Python >= 3.14**, **Java >= 11**, and **C++ >= C++17**. Students can create multi-file and folder-based projects; edit, compile/run, interact with stdin/stdout, stop execution, inspect compiler errors, autosave, import/export ZIP files, share snapshot URLs, and work through locally graded exercises with hints, points and rubrics. Every core capability MUST function on a **static HTTPS host without any custom application backend**. Supported deployment targets include GitHub Pages and ordinary campus static web servers. The client MUST NOT silently fall back to running student code on a remote service.

Optional capabilities: LTI 1.3 launch, Canvas assignment selection/deep linking, identity, grade passback using Assignment and Grade Services (AGS), optional separate trusted grading infrastructure. These MAY use backend services; their absence MUST NOT break the IDE or any local core feature. Anonymous offline projects are the norm. Personal identity comes only from a verified optional LTI launch; do not manufacture identity from a text field and treat it as verified.

**Accessibility target:** WCAG **2.2 AA** (this satisfies the WCAG 2 requirement more concretely); browser/IDE keyboard access and assistive technology support are mandatory.

### Instructions for autonomous coding agents

1. Follow the milestones in order. Create an ADR before changing a fundamental architectural decision.
2. Do **not** claim Java/C++ support until independently compiling and executing a fresh student-written program entirely in the browser has been proven on the target static-host matrix.
3. Do not quietly weaken Java 11, Python 3.14, or C++17 minimums because a selected compiler is old. Change the provider, not the requirement; mark a gate blocked if necessary.
4. Do not fake results or use hard-coded examples as an execution engine.
5. Keep a documented `LOCAL_ONLY` release build that contains no LTI or grading API dependency and can be served from any HTTPS static origin.
6. Implement user-visible progressive enhancement: unavailable features show clear explanations and fallbacks, not silent failure.
7. Always write tests and update docs with each milestone; collect browser-matrix evidence.
8. Never transmit student source, local filenames, projects, or execution output off the device without an explicit, informed submission/sync action.
9. Never expose LTI access tokens, service private keys, grading secrets, hidden server-side tests, or authenticated user identifiers in URL fragments.
10. Runtime errors, resets, crashes, imports, or offline transitions must not silently lose edits.
11. Deliver complete functional vertical slices, not a polished facade over nonfunctional runners.
12. No CheerpJ, CheerpX or other proprietary runtime in the mandatory build or bundled assets. No code or packaged executable without verified redistribution rights.
13. Keep third-party license and source-offer compliance automatable, and flag GPL/AGPL/copyleft issues for review rather than treating any publicly hosted repository as permissively licensed.

## 1. Deliverables and success criteria

Primary deliverables:
- Static SPA/PWA-style IDE; no backend in the core deployment.
- Real isolated, fully in-browser execution backends for Python 3.14+, Java 11+, C++17+.
- Project manager, filesystem, console, diagnostics, run/stop, editor settings.
- Instructor assignment creator, tests, hints, rubric, local score report.
- Portable versioned project and assignment schema; ZIP import/export; compressed URL fragment shares; file submissions.
- Optional LTI gateway design and implementation in a separate service/project at a later milestone.
- Optional independently isolated grader, never part of the core gateway.
- Accessibility checks, security threat model, CI tests and reproducible static build.

Done means a student can load the static website, create or import a project, compile/run each supported language using code they authored, interact with the program, save, reopen while offline (after caching), share an immutable URL snapshot where suitably small, and download a reviewable package—all while network inspection shows **no code execution API or submission API calls**. Java and C++ completion are **gated** on working real toolchain builds, not an assumption that any named open-source project meets all requirements.

### Explicit non-goals of initial release

- Linux container/shell emulation; unrestricted OS command execution; arbitrary shell package managers.
- Arbitrary native networking, external processes, system privileges, local disk access beyond user-authorized import/export.
- Complex GUI desktop applications, Java Swing desktop hosting as a core student workflow, graphical C++ applications.
- Unlimited Python packages, arbitrary Maven/Gradle modules, arbitrary CMake projects.
- Plagiarism detection, exam lockdown, proctoring, or trusted grading in anonymous mode.
- Real-time multi-user collaborative editing or accounts.
- Guaranteeing secret test content within a completely client-side bundle.
- Claiming browser-side code execution is an OS-grade sandbox for malicious programs.

## 2. Evidence, component feasibility and mandatory prototypes

### 2.1 OSS-only runtime selection (updated 2026-11-01)

| Language | Minimum | Primary OSS candidate | Alternate / investigation | Gate |
|---|---|---|---|---|
| Python | 3.14 | **Pyodide 314.0.7** (MPL-2.0), pin exact assets | Newer tested stable 314.x | Verify version, interactive stdin, isolation, multi-file, offline |
| C++ | C++17 | **YoWASP LLVM/Clang/LLD** toolchain assets (Apache-2.0 with LLVM exceptions and dependencies), wrapped by project-owned TS/WASI adapter | **TraceCC** 0.1.1 (AGPL-3.0-only, requires licensing decision), **cppwasm** (check exact source license and bundled dependencies), **browsercc** (research maturity and notices) | Compile, link and execute real C++17+ multi-file programs with interactive input on generic static hosting |
| Java | Java 11 | **Java POC track A:** browser-compiled **Eclipse ECJ** (EPL-2.0) + **BJVM** (Rust/WASM, Java SE 17 JVMS-oriented); verify BJVM license and APIs before adoption | **199xVM** (Rust WASM interpreter + TypeScript source compiler, check actual Java 11 language/library coverage and license); **TeaVM** (Apache-2.0 AOT fallback, not a JVM); **Bytecoder** (Apache-2.0 AOT, not a drop-in JVM); **DoppioJVM** (legacy Java 8, disqualified as Java 11 solution) | Browser-source compile to classfiles, Java 11+ bytecode/classes, usable JDK APIs, stdin, repeatable offline execution |

**Do not present BJVM, 199xVM, ECJ-in-browser, or TeaVM as already verified production Java solutions.** OSS candidates are investigation tracks. Java code must compile and run in the user's browser with no remote execution or hidden server. The same web app may offer a documented "Java experimental" mode during development, but a release claiming all three mandatory languages must pass the Java gate. If a complete Java 11+ solution fails, halt the all-language release rather than replace it with proprietary CheerpJ or a cloud executor.

Pyodide 314.0.0 upgraded to Python 3.14.2, and 314.0.7 is a published stable 314-series release. Pin an audited release at implementation time; include licenses for Python standard libraries, compiled packages, and WebAssembly distribution assets. Check runtime `sys.version_info` dynamically.

**CheerpJ exclusion:** CheerpJ's free Community terms do not include general self-hosting/redistribution; academic institutional deployment should not be assumed license-free. It is not OSS and violates the project's core requirements. An OPTIONAL third-party adapter, provided separately by licensees, may be considered outside the open-source core, but never in CI required tests, static artifacts, or offline bundles.

**Version checks are runtime assertions:** record real `java.version` or classfile/source level and JVM compliance, `python --version` equivalent, `clang --version`, and `__cplusplus >= 201703L`; store SHA-256 digests and license files for every distributed compiler binary. Open-source *license of the wrapper* does not establish license of its bundled sysroot, standard libraries or binary assets.

### 2.2 POC-A: browser and hosting capabilities

Before major UI implementation, create `pocs/hosting-capabilities/` and deploy to:
- GitHub Pages with a repository base path (`/repo-name/`).
- Standard HTTPS server with no custom COOP/COEP/CORP response headers.
- Campus-like path-prefixed static host.
- Optional isolated host with COOP/COEP headers, as an enhancement **only**.

Test whether `crossOriginIsolated` and `SharedArrayBuffer` are available. Baseline MUST work without requiring custom isolation headers, especially on GitHub Pages. A `SharedArrayBuffer`-based synchronous stdin/interrupt mechanism is an optional optimization, **not** a baseline assumption. If a specific language runtime cannot support true interactive stdin without such headers, document the incompatibility and investigate message-based asynchronous worker input or a verified isolation service-worker approach; do not promise full compatibility until tested. Do not depend on service-worker header rewriting to repair security headers on an arbitrary host without cross-browser tests.

Test module worker loading, WASM compilation, `instantiateStreaming` fallback, service worker scope, OPFS support, IDB, storage quota, browser navigation, fragment URL lengths, and Canvas embedding/third-party storage restrictions. Create a machine-readable support matrix and a diagnostic page.

### 2.3 POC-B: Python 3.14

Deliver a minimal Python console with `print()`, `input()` after execution starts, file `import`, thrown error tracebacks, injected sample stdin, explicit stop, offline restart, and library allowlist. Do not rely on overriding built-in `input()` in a way that breaks standard semantics without documenting it. Confirm behaviors in Chrome, Edge, Firefox and Safari; if live blocking input is impossible on a target, fix the runtime integration or make it a tracked blocking gap.

### 2.4 POC-C: Java source compilation

Run source such as:

```java
package demo;
import java.util.Scanner;
public final class Main {
  public static void main(String[] args) {
    Scanner s = new Scanner(System.in);
    System.out.println("Hi " + s.nextLine());
  }
}
```

Demonstrate compilation **inside the browser** from `.java` to valid bytecode, execution inside a browser JVM, real interactive input, `javac`-like source file/line/column errors, packaging multiple `.java` files, Java 11 compatibility (`--release 11` or equivalent), stop/reset, and offline use. Record resource usage and licensing. A Java bytecode runner without a source compiler is **not a pass**. A source compiler requiring a remote build endpoint is **not a pass**. Evaluate ECJ as the first compiler candidate, but prove that ECJ itself runs in the browser independently of the chosen OSS JVM and verify EPL-2.0 compliance; document differences from `javac`. Version targeting Java 11 is minimum; Java 17/21 profiles may be options when verified.

### 2.5 POC-D: C++17 compilation

Compile two translation units, including `<iostream>`, `<vector>`, `<algorithm>`, `<string>`, `<memory>`, and a C++17 structured binding or `std::optional`; link; read interactive `std::cin`; emit stdout and stderr; diagnose invalid syntax; enforce limits; restart compiler/runner; run offline and on GitHub Pages without special headers. Verify `__cplusplus >= 201703L`. Note that `clang` compiled **to** WASM (compiler itself) and Clang emitting WASM **for** the program are separate parts of the toolchain; both require bundled headers, libc++, libc/wasi sysroot, linker and runtime. Do not choose an incomplete compiler demo as the shipping pipeline.

### 2.6 Decision gate

Every POC produces `docs/feasibility/<language>.md` with artifact URLs, licenses, versions, SHA-256 checksums, static-host proof, browser matrix, test logs, cold/warm download/launch timings, approximate memory, known unsupported features, and pass/fail. An unresolved gate blocks labeling that runtime production-ready. The rest of the IDE may be delivered with a truthful per-language `experimental` status during development, but final public feature claims require every mandatory gate to pass.

## 3. System architecture

```text
                        STATIC HTTPS ORIGIN
+------------------------------------------------------------------+
| SPA shell: navigation, explorer, editor, diagnostics, console     |
| assignment builder, test results, portable share/export UI       |
+---------------------------+--------------------------------------+
| Versioned project model / virtual filesystem / autosave          |
| IndexedDB metadata + file content; OPFS optional large-blob tier |
+---------------------------+--------------------------------------+
| Runtime orchestrator: capability probes, lifecycle, workers, IPC |
+-------------------+-------------------+--------------------------+
| Python worker     | Java worker       | C++ compile + run workers|
| Pyodide 3.14+     | compiler + JVM    | Clang/WASI toolchain      |
+-------------------+-------------------+--------------------------+
| Test runner: isolated attempts + local advisory scoring          |
+---------------------------+--------------------------------------+
| Integration abstraction: LocalOnlyProvider (always present)      |
| [OPTIONAL authenticated LTI gateway] [OPTIONAL trusted grader]    |
+------------------------------------------------------------------+
```

Dependencies must flow inward: UI -> application services -> domain/interfaces. Platform adapters implement domain interfaces. `packages/core`, project formats, local test framework and browser runners must never import the LTI package. Optional integrations are runtime-selected and tree-shakeable/deployable separately. Use strict TypeScript; avoid runtime dependence on a traditional Node server (Node may be used for development/build tooling only).

### Suggested stack
- React + TypeScript + Vite; explicit base URL support and hash routing (URL project fragments must not collide with router fragments).
- CodeMirror 6 for editing, syntax highlighting, lint markers, keybindings and accessible editing; Monaco only after accessibility and bundle-size evaluation.
- Simple semantic-HTML console first, with optional xterm.js only if needed; offer a screen-reader-friendly text log and separate input prompt.
- IndexedDB metadata and content; optionally OPFS for larger projects if supported; abstraction and migrations mandatory.
- Dedicated runtime workers; Python/Java/C++ toolchain assets lazy-load only on selected language.
- Standard Web Crypto, CompressionStream or bundled tested compression library, with stable format and URL-safe base64url.
- Workbox or explicit versioned service worker; offline shell and compiler manifests pinned.
- Vitest, Playwright, axe-core, type checking, ESLint; browser compatibility test automation.
- Optional gateway: separate ASP.NET Core service deployable on Windows or Linux, including serverless-compatible adapter where the host supports it. Do not require it for static build.

## 4. Repository and build products

```text
browser-ide/
  apps/web/
    src/{app,editor,explorer,terminal,diagnostics,settings,
         assignments,sharing,reviewer,accessibility}/
    public/{icons,manifest.webmanifest}/
  packages/
    core/
    project-model/
    storage-browser/
    execution-contracts/
    runner-python/
    runner-java/
    runner-cpp/
    testing-local/
    assignments/
    sharing/
    integration-contracts/
    integration-local/
  optional-services/
    lti-gateway/     # ASP.NET Core, deploy separately
    trusted-grader/  # sandboxed service, deploy separately
  pocs/{hosting-capabilities,python,java,cpp}/
  tests/{unit,integration,e2e,accessibility,security,compatibility}/
  scripts/{runtime-fetch,licenses,hashes,build-static}/
  docs/{architecture,adr,feasibility,operations,authoring,privacy}/
  .github/workflows/
```

Build targets:
- `npm run build:static` -> immutable static distributable; never references a required custom API.
- `npm run build:static -- --base=/repo-name/` or equivalent Vite `base` configuration for GitHub Pages.
- Optional self-hosting distribution with vendored compatible and licensed runtime assets.
- `npm run test:all`, `npm run test:e2e`, `npm run test:a11y`, `npm run test:offline`, `npm run test:static-host`.
- Manifest of build/runtime dependencies, licenses, integrity digests and downloadable asset sizes.

All asset paths must honor `import.meta.env.BASE_URL` (or equivalent). No root-relative hardcoding that breaks subpath deploys. Avoid history-mode SPA routing without a configured static host rewrite; use ordinary query/path entrypoints and a dedicated hash payload parser that coexists with navigation state.

## 5. Domain model and API contracts

Use versioned schema validation (Zod/JSON Schema) at all untrusted boundaries. Errors should be discriminated union results, not generic thrown strings. The following interfaces are conceptual and may be refined in ADRs:

```ts
type LanguageId = 'python' | 'java' | 'cpp';
type RuntimeStatus = 'not-installed' | 'loading' | 'ready' | 'running'
  | 'stopping' | 'failed' | 'unsupported';

type ProjectFile = { path: string; encoding: 'utf-8'; content: string };
type Project = {
  schemaVersion: 1;
  id: string; name: string; language: LanguageId;
  entrypoint: string; files: ProjectFile[];
  toolchain: { runtimeId: string; requestedVersion: string };
  assignmentRef?: { id: string; version: number; digest: string };
  createdAt: string; updatedAt: string;
};

type ExecutionSettings = {
  maxRunTimeMs: number; maxOutputBytes: number; maxFiles: number;
  maxProjectBytes: number; requestedMemoryMb?: number;
};
type RuntimeEvent =
  | { type: 'status'; status: RuntimeStatus }
  | { type: 'stdout' | 'stderr'; text: string }
  | { type: 'stdin-request'; requestId: string; prompt?: string }
  | { type: 'diagnostic'; file?: string; line?: number;
      column?: number; severity: 'error' | 'warning' | 'info'; message: string }
  | { type: 'complete'; exitCode: number | null; durationMs: number;
      reason: 'success' | 'compile-error' | 'exception' | 'timeout' |
              'cancelled' | 'resource-limit' | 'worker-crash' };

type RunRequest = { runId: string; project: Project; stdin?: string;
  settings: ExecutionSettings; mode: 'normal' | 'test' };
interface RuntimeProvider {
  id: string; language: LanguageId;
  probe(): Promise<{ available: boolean; reason?: string; versions: string[] }>;
  prepare(onProgress: (done: number, total?: number) => void): Promise<void>;
  run(request: RunRequest, onEvent: (event: RuntimeEvent) => void): Promise<void>;
  supplyInput(runId: string, requestId: string, text: string): Promise<void>;
  stop(runId: string): Promise<void>;
  dispose(): Promise<void>;
}
```

The `run` Promise signals termination, while events stream stdout/stderr asynchronously. Stop must be idempotent. Every run has a generation/run ID; stale events from terminated workers are ignored. Runtime-specific compiler options must come from a verified allowlist, not arbitrary shell commands. Version mismatch is a user-visible error with a useful resolution.

Storage contracts:

```ts
interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  get(id: string): Promise<Project | null>;
  save(project: Project, expectedRevision?: number): Promise<number>;
  delete(id: string): Promise<void>;
  export(id: string): Promise<Blob>;
  import(blob: Blob): Promise<{ project: Project; warnings: string[] }>;
}
interface IntegrationProvider {
  discover(): Promise<IntegrationCapabilities>;
  currentContext(): Promise<VerifiedLtiContext | null>;
  submit?(submission: SubmissionPackage): Promise<SubmissionReceipt>;
}
```

Implement `LocalOnlyProvider` for all builds; it returns all remote capabilities false and produces actionable export/share instructions rather than unsupported network requests. Integration discovery may time out, fail, be blocked by third-party cookies, or be omitted entirely; the IDE stays fully usable.

## 6. UX and information architecture

### 6.1 Landing / workspace

Header: project name, language/runtime version, local/connected/offline indicator, Save status, Run, Stop, Share/Export. Main desktop layout: left explorer, middle tabbed editor, bottom panel with Console, Problems, Tests, and optional right-hand Assignment/Instructions. Resizable panels and persisted preferences. Explicit `New Project`, `Open Project`, `Import ZIP`, `Open from URL`, `Assignment Builder` (in instructor entry). Never gate workspace on sign-in.

Responsive: desktop multi-pane; tablet one pane with tabs and accessible panels; small screens can review/edit but show a clear warning where advanced workspace or heavy compiler performance is constrained. Honor reduced motion, zoom/reflow, OS high contrast, keyboard shortcuts that do not hijack browser assistive-tech commands. Ensure touch targets WCAG 2.2 AA.

### 6.2 Workflows

**Student:** Open IDE -> choose language -> create folder/files -> run -> respond to `stdin` request -> view output and compile errors -> autosave -> test -> optionally inspect hints -> Share snapshot or Download package -> paste URL/upload file into Canvas. Explicitly state that copying a link is *not* proof of having submitted in Canvas.

**Instructor:** Choose Create Assignment -> language/runtime profile -> instructions and starter project -> test cases with points and sample input/output -> hints and rubric -> configure attempt policy, feedback visibility and max points -> preview student mode -> publish versioned assignment as URL or download -> use Canvas standard Website URL/File Upload assignment. Review submissions by opening snapshot link or importing package. Instructor can manually enter grades in Canvas without any custom service.

**Optional Canvas:** Verified LTI launch -> load the appropriate assignment content through a validated resource reference -> student works locally -> submit source to gateway only after confirmation -> gateway validates/replays policy -> optionally trusted grader -> grade posted to AGS -> receipt displayed. A failed grade submission does not delete local work.

### 6.3 Editor

- Syntax highlighting for all 3 languages, brace matching, indentation, line numbers, error squiggles, format-on-demand where a suitable local formatter exists.
- Tabs, keyboard file navigation, rename/move/add/delete file or folder, undo/redo, find/replace, optional split editor later.
- Language-appropriate starter templates: Hello World; stdin echo; simple functions; Java packages; C++ multiple files.
- Path-safe virtual file tree; project setting for entrypoint; Java package mapping; C++ compile inputs; Python import path.
- Autosave status: `Saved locally`, `Saving`, `Unable to save`, `Storage almost full`; recovery and export when quota is low.
- Never allow importing external ZIP contents to execute automatically: require explicit Run action.

### 6.4 Console and diagnostics

Console must support real input requested after program starts (not only an up-front input field), streaming stdout/stderr distinction, clear/reset, scrollback limits, text copy, line wrapping, keyboard focus, stop, and time/exit status. Provide a screen-reader-usable separate input field and a text log that does not continuously overwhelm live announcements. Build an interactive stdin state machine with pending prompt, request ID, EOF and cancellation. If a runtime cannot block for live stdin without cross-origin isolation, do not pretend prefilled stdin is equivalent; this is a POC blocking issue.

Diagnostics link to file, line and column where available. Distinguish compile error, runtime exception, test mismatch, timed-out run, user cancel and worker crash. Display a friendly explanation and expandable raw detail.

### 6.5 Privacy and capability UX

Persistent badge for `Local only` vs `Canvas connected`. A privacy/details dialog describes what stays on device and exactly what is sent when submitting. Gateway unavailability must never display an auth modal by default. Clear control to wipe local projects; export-before-delete option. Opt-in diagnostic export redacts source and identifiers by default.

## 7. Virtual filesystem and persistence

- IndexedDB stores projects and revision metadata; optional OPFS stores large projects / transient compiler artifacts when supported. Do not require OPFS on first load.
- Per-project virtual root; paths must use normalized `/`, forbid `..`, absolute paths, null bytes, reserved metadata names, symlinks and duplicates differing only by platform case rules where interoperability is affected.
- Store content as UTF-8 with predictable line endings; preserve ZIP file binaries only when explicitly supported by the project schema. Initial v1 source package supports UTF-8 text; other assets may be stored as validated typed blobs in package v2.
- Autosave debounce target 500–1000 ms, plus save on lifecycle boundary if possible; never rely on unload event as sole protection.
- Use transactions, revision numbers, journaling/recovery to prevent cross-tab lost updates; prompt on competing tab edits. Include migration tests for every schema change.
- Quota management: estimate storage, show space available where API permits, evict **only runtime cache** rather than student projects, offer export and clear cache.
- Runtime WASM and compiler artifacts are fetched from immutable versioned assets; service-worker caches are safely updated without erasing user data.
- Offline mode only promises runtimes that have been downloaded and validated; show explicit `Install for offline use` per language with asset size.

## 8. Execution lifecycle, input and limits

State machine: `idle -> preparing -> compiling? -> running -> waiting-for-input? -> completed/failed/cancelled` with `stopping` transition. One active run per project by default; switching projects never leaks output into another project. Separate compile and execution workers when feasible for C++ and Java; terminate and replace workers if cooperative stop fails. Every run uses a clean filesystem snapshot of the project and isolated ephemeral output state.

Defaults (configurable and to be benchmarked): 10 s code execution limit for local tests; 30 s normal run; 1 MiB stdout + 1 MiB stderr cap; 100 UTF-8 files; 5 MiB uncompressed project; 8 KiB URL target; 32 MiB compressed ZIP import cap; explicit process-wide allocation budget tuned per device. These are **policy defaults**, not guaranteed hard browser-level RAM limits. Worker memory caps may not be enforceable; terminate/restart on observable resource failure. Warn before heavy toolchain loads. Never claim OS-grade process isolation.

Network and runtime globals: deny student code intentional application credential access by executing on a separate, origin-constrained sandbox as appropriate. A worker on the same origin can still fetch same-origin assets and perhaps APIs; therefore do **not** rely on worker isolation alone to protect optional LTI session cookies or credential-bearing endpoints. Prefer isolated origin and CSP for untrusted execution; the application must remain statically deployable, so support a separate public runtime origin or other browser sandbox strategy that can be deployed statically. Gateway must use CSRF/session verification and never assume a client-side origin restriction alone protects it. Document any unavoidable browser-runtime capability and disallow high-trust assessment if the sandbox is insufficient. WASM is not automatically secure against host-function abuse.

## 9. URL sharing and file format

### 9.1 Versioned project payload

Canonical JSON schema (minimum):

```json
{
  "schemaVersion": 1,
  "kind": "browser-ide-project",
  "language": "python",
  "runtime": {"id": "python-pyodide", "minimum": "3.14"},
  "name": "Greeting",
  "entrypoint": "src/main.py",
  "files": [{"path": "src/main.py", "encoding": "utf-8", "content": "print('Hello')\n"}],
  "assignmentRef": {"id": "intro-greeting", "version": 1, "digest": "sha256:..."}
}
```

Exclude local UUID, recent-history data, names, grades, tokens and user identifiers from a portable payload unless explicitly needed and user-approved. Canonicalize field ordering for reproducible checksum. Treat imported JSON/ZIP as untrusted; validate schema and decompression size before any project installation.

### 9.2 URL format

Canonical: `https://host/path/?view=project#p=v1.<base64url(compressed-canonical-json)>`. Use deterministic compression, a max decompressed size and a SHA-256 checksum inside envelope. Do not accidentally include a full origin URL inside compressed payload. The viewer must load the payload, validate it, display a preview, and import as a **new** local project only with user action. Opening a link must not silently overwrite existing work or autoexecute code. The hash is convenient transport, **not encryption or access control**. Sharing a URL makes its contents readable to anyone who has it.

Cap full URL length to a conservative configurable 8 KiB initially; if exceeded, present download package and instructions. Actual limits depend on browser, sharing medium and Canvas; build a Canvas verification suite to test fragment preservation end-to-end. Tests must submit URL in Canvas, retrieve stored URL, open from SpeedGrader and validate source content. Canvas URL-submission screenshot capture must not be relied on to preserve hash payload or dynamic view. Document fallback to File Upload if hashes are stripped or rejected.

### 9.3 File packaging

Preferred extension `.codeproject` (ZIP container) plus ordinary `.zip` import/export. Suggested layout:

```text
project.codeproject
  manifest.json
  src/main.py
  assignment/assignment.json       # when relevant/public
  results/local-feedback.json      # advisory only; opt-in
  integrity/sha256.json
```

Portable package validates path, size, duplicate names, ZIP bombs, encoding and checksums. Preserve real source tree paths. Never execute project code when previewing. Source hashes support integrity, **not verified authorship**. Option to export a plain ZIP compatible with typical IDEs; if user imports ordinary ZIP, show language/entrypoint selection.

## 10. Assignment and grading domain

### 10.1 Instructor assignment package

```json
{
  "schemaVersion": 1,
  "kind": "browser-ide-assignment",
  "id": "intro-greeting",
  "version": 1,
  "title": "Greeting Program",
  "language": "python",
  "minimumRuntime": "3.14",
  "maxPoints": 10,
  "instructionsMarkdown": "Read a name and print a greeting.",
  "starterProject": {"ref": "starter.codeproject"},
  "tests": [
    {"id": "t1", "type": "stdin-stdout", "stdin": "Ava\n",
     "expectedStdout": "Hello Ava\n", "points": 6,
     "normalization": "line-endings", "visibility": "public"}
  ],
  "rubric": [{"id": "r1", "title": "Readability", "points": 4,
             "description": "Clear naming and structure", "scoring": "manual"}],
  "hints": [{"id": "h1", "text": "Use input() to read a name."}],
  "attemptPolicy": {"allowResubmission": true},
  "feedbackPolicy": {"showTests": true, "showExpectedOutput": true}
}
```

Assignment source must be version-locked to a specific digest so revision does not retroactively alter a previously distributed exercise. Required grading modes: exact output, normalized line endings/trailing whitespace, provided stdin, exit status, timeout. Optional regex tests and static analysis only after rules are constrained to avoid catastrophic patterns or unsafe evaluation. Tests run in freshly reset workers, no shared state between cases. Distinguish auto-test score from manually assessable rubric points. Show a clear `Local estimate — not an official Canvas grade` label. In fully client-side mode, all tests and local score results are inspectable and tamperable; do not refer to these as secure hidden tests.

### 10.2 Review mode

Import a submission snapshot/project file, inspect files side-by-side with assignment, run public tests locally on instructor machine, annotate rubric manually, export feedback JSON/PDF in a later milestone, copy score into Canvas manually if no gateway. Review mode never trusts a claimed score or author from package metadata; it recalculates local tests and clearly marks unverified results.

### 10.3 Trusted grading architecture (optional)

Separate worker tier with queue/isolated jobs, hardened OS-level sandbox such as disposable containers/VMs with network disabled, CPU/wall/memory/pid limits, read-only toolchain, ephemeral filesystem, no credentials, no access to gateway secrets, logged run IDs and signed/reviewable result records. The gateway communicates with worker using restricted authenticated channel. No compilation/execution ever inside the LTI gateway process. Provide manual instructor review mode for uncertain results. Remote grading is **explicit opt-in** and transmits source only on submission; present privacy notice.

## 11. Optional Canvas LTI 1.3 integration

### 11.1 Boundary

The core static IDE SHALL work without the gateway. LTI requires a secure serverless or traditional service because OIDC response processing, replay controls, service authentication, private key storage and AGS grade requests require a trusted principal. LTI is not implemented by trusting a JWT parsed in browser JS or a score sent directly from the student client. Optional ASP.NET Core gateway runs on Windows or Linux; provide cloud/serverless deployment guidance without making a particular provider mandatory.

### 11.2 Launch flow

1. Admin registers developer key/configuration JSON in Canvas, configures login initiation URI, redirect/launch URI(s), public JWKS endpoint, placements and AGS scopes.
2. Canvas initiates OIDC launch to gateway with platform identifier, login hint, target link URI, LTI message hint.
3. Gateway generates and stores one-time state/nonce bound to the flow; redirects to trusted LMS authorization endpoint.
4. Canvas POSTs `id_token` to gateway redirect endpoint. Gateway checks signature/JWKS, allowed issuer, audience/client ID/authorized party, deployment ID, nonce/state one-time consumption, issued/expiry time, allowed message types, context/resource and platform mapping. Reject replay and mismatches.
5. Gateway issues short-lived HttpOnly Secure session bound to verified launch context; never put the raw LTI ID token or AGS tokens in localStorage, URL hash, or worker-accessible project data. Consider Canvas iframe third-party-cookie restrictions, SameSite and storage partitioning; provide new-window fallback and tested iframe flows.
6. Gateway serves a minimal redirect/response to static IDE carrying only a short-lived authorization handshake; frontend obtains constrained launch context. Do not leak personally identifiable values into logs or URL.
7. Student works locally; gateway receives source only on intentional submission; verifies authorization and submission binding to launched assignment/line item.

### 11.3 AGS and deep linking

Use standard LTI AGS OAuth2 client-credentials private-key JWT authorization and least-privilege scope(s). Score posting uses the line item score URL supplied/authorized in verified LTI context, never arbitrary user-provided URL (SSRF defense). `userId` must come from verified LTI subject (not project metadata). Map scoreGiven, scoreMaximum, gradingProgress, activityProgress, timestamp; idempotency and retry with deduplication. Source submission attachment/URL exposure in SpeedGrader is **Canvas-specific extension** and must be separately tested. Deep Linking 2.0 allows instructor selection of specific versioned assignment resource. Build it after basic launch and AGS work. Test multiple Canvas domains/deployments, role-based restrictions, teacher and student flows, account-level and course-level installation.

Scopes (configure minimum necessary, not all by default):
- `https://purl.imsglobal.org/spec/lti-ags/scope/score` for grade posting.
- `https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly` to read line items if needed.
- `https://purl.imsglobal.org/spec/lti-ags/scope/lineitem` only if creating/updating line items.

No official grade may be posted from an unverified browser-calculated number without a deliberate policy; recommend trusted grading or instructor-validated results for summative grades. If institution enables advisory completion-credit based on client claim, explicitly describe spoofing risk and require administrative opt-in.

### 11.4 Suggested gateway endpoints (draft)

```text
GET  /.well-known/jwks.json
GET  /lti/config.json
GET|POST /lti/login
POST /lti/launch
GET  /api/session/context
POST /api/assignments/{resourceId}/submissions
GET  /api/submissions/{submissionId}/status
POST /api/lti/deep-link/response      # authenticated instructor flow
```

Endpoint implementations must have request size caps, CSRF defenses, constrained CORS, content-type validation, authz, rate limits, request IDs, timeouts and redacted audit logs. Use durable replay/nonce storage with TTL; optional gateway cannot safely use only volatile per-browser localStorage for replay protection. Do not let CORS or a client-asserted mode replace authorization. No mandatory roster sync, student DB, or permanent profile. Preserve only minimal needed submission receipt and compliance records per deployment policy.

### 11.5 User-visible states

- `Local — No Canvas connection` -> copy URL / download.
- `LTI session validated` -> assignment ID and optional submit.
- `Canvas connection expired` -> all local editing continues, resubmission requires fresh verified launch.
- `Submission pending/accepted/grade posted/rejected` -> durable readable receipt and retry instructions.

## 12. Threat model, security and privacy

Assets: student source, local projects, instructor test banks, LTI tokens, session, grades, runtime integrity, browser origin. Adversaries: malicious URL/ZIP senders, students modifying local score, compromised CDN/runtime package, untrusted student code, malicious project content, CSRF/XSS, replay, grade forging. Core mitigations:

- No HTML eval from project text; sanitize Markdown/HTML; editor text always inert. Reject dangerous URL protocols and navigation injection.
- CSP and Trusted Types where supported; isolate untrusted compiler runtime; restrict frame embedding to configured trusted LMS origins for LTI page, while standalone static preview can be configured for more permissive embedding.
- Runtime WASM/JS bundled from reviewed pinned sources, checksums and SBOM; avoid loading compilers from third-party CDN at runtime in fully self-hosted mode.
- Decompression bounds, path traversal checks, malformed JSON rejection, Unicode path normalization; never extract ZIP into arbitrary filesystem.
- Worker termination and output caps; note inability to guarantee hard memory cap inside browser.
- No code autoexec on import/share open.
- No secrets in browser code: gateway private keys and credentials never built into static bundle.
- Public URL fragment project content must be treated as public-to-anyone-with-link; exclude PII and tokens.
- Redact logs; no analytics in LOCAL_ONLY build; offline feature no external calls beyond initial app/runtime asset fetching.
- Secure gateway replay and authz; restrict AGS destinations to platform-provided verified line item URLs; defend against SSRF and spoofed deployment IDs.
- Trusted grader in separate OS-level isolation; browser public tests are never authoritative.
- Test compromised cross-tab state, hidden file injection, XSS payloads in source, CSP bypass, malicious compression, malformed worker messages and fake results.

**Privacy language:** "Projects are stored on this device by default. Sharing a link or submitting through Canvas sends or reveals the selected project content. Test scores calculated entirely in your browser are not verified grades." Ensure this appears in help and submission confirmation.

## 13. Accessibility — WCAG 2.2 AA

Implement accessible names/roles, semantic landmarks, headings, keyboard-only operations, visible focus, skip navigation, 200% zoom and 400% reflow where practical, adjustable editor font/line height, contrast compliance, non-color-only code diagnostics, accessible error summary, screen reader-readable file explorer, reorder/move without drag requirement, alternative console text log, accessible stdin prompt, and controlled live announcements that do not spam on every output character. Respect prefers-reduced-motion; avoid keyboard traps in terminal/editor; ensure shortcuts are remappable/disableable and screen reader mode works.

Tests: axe automated audits, manual keyboard checks, NVDA + Edge/Chrome, VoiceOver + Safari, Windows high contrast, 200/400% zoom, touch tablet, WCAG 2.2 AA audit sheet with failures blocked before release. Nonessential aesthetics may be deferred; keyboard/a11y functionality may not.

## 14. Performance and operational quality

Measure, do not promise a universal performance target. Initial engineering budgets:
- Shell interactive in <= 2 s on a representative modern managed Windows desktop over warm cache (runtime assets excluded).
- No editor main-thread blocking during compilation; measure typing responsiveness under load.
- Python trivial warm-run target < 0.5 s where feasible; record actual results.
- Runtime assets separately cached and versioned, not in initial SPA JS bundle.
- Autosave completes <= 1 s from edit when storage healthy.
- Stop gives immediate UI feedback; worker forcibly reset after tested timeout if cooperative cancellation fails.
- Document cold download MB, peak RAM and compile/run latency (p50/p95) across Windows Chrome/Edge, macOS Safari, Firefox, tablet browsers.
- Collect only user-initiated exported diagnostics, no background telemetry in local mode.

## 15. Testing and acceptance matrix

### Automated tests

**Unit:** model serialization, canonical hashing, path validation, ZIP-bomb limits, schema migration, URL encode/decode, assignment scoring/normalization, role/capability mapping, run state machine, stale output filtering.

**Integration:** each runtime receives project snapshot, compiles/runs, streams errors, stdin request arrives mid-run, stop and worker cleanup, multi-file imports, corrupted runtime artifact, offline, quota full, restart.

**E2E:** create/edit/autosave/reload/share/import/export, instructor authoring, student test and submission copy, URL within/over cap fallback, local mode when gateway absent/blocked, accessibility keyboard flow.

**Security:** XSS in code filename/assignment title/Markdown, ZIP path traversal, decompression bomb, malformed hash, huge stdout, infinite loop, resource exhaustion, unsolicited cross-worker messages, executable import blocked, fake grade rejected, CSRF/replay/SSRF in gateway.

**LTI contract:** issuer/audience/nonce/state/deployment verification, role restriction, AGS scope and line item mapping, expired session behavior, idempotent grade posting, Canvas iframe and new-window paths, separate platforms and resource IDs.

### Mandatory language fixture suite

Python: version >=3.14; `print`, post-run `input`, recursion, class, import own module, exceptions, file reads/writes in sandbox, 2+ source files, infinite loop interrupt.

Java: version >=11; public `Main`, package, Scanner post-run input, 2+ source files with dependent class, generics/collections, exception trace, invalid source diagnostic location, Java 11 `var` local declaration, infinite loop interrupt.

C++: `__cplusplus>=201703L`, structured binding, `optional`, `vector`, sort, two `.cpp` files + header, interactive `cin`, compiler warnings/errors with location, thrown exception/output, infinite loop interrupt.

### Static-host matrix

| Environment | Required result |
|---|---|
| GitHub Pages at `/repo/`, no special headers | Full core functionality incl. three runners, interactive stdin, offline after cache |
| Campus generic HTTPS static host | Same full core |
| Chrome and Edge current | Pass |
| Firefox current | Pass |
| Safari current on macOS | Pass |
| iPad Safari | IDE editing/storage and supported runner availability validated; clearly document any hardware-specific resource constraints |
| Offline airplane mode after runtime install | Edit, compile/run, tests, export without any server |
| Canvas URL assignment | Exact fragment survives UI -> stored submission -> SpeedGrader open, otherwise fallback explicitly offered |
| No gateway configured / connection failed | No breaking changes in core IDE |

If any required browser or host fails, record it as a release blocker or explicitly narrow supported target in a revised, user-approved ADR; do not silently redefine the requirement.

## 16. Implementation milestones, tasks, exit gates

### M0 — Repository, security baseline and feasibility (FIRST)

- Initialize monorepo, strict TS, basic app, CI, license scanner and SBOM; static build GitHub Pages base path.
- Write POC-A/B/C/D, capability matrix, threat model and ADRs.
- Inventory and approve licenses for Pyodide/CPython, all Java JVM/compiler candidates, LLVM/LLD and all bundled WASI sysroot and C++ standard-library files; reject CheerpJ from the core.
- Establish actual Java and C++ implementation choices based on source execution and host compatibility.
- **Exit:** documented evidence/prototypes for all three language paths; none deceptively labeled ready; core architecture remains viable on generic HTTPS static hosts.

### M1 — Static shell and robust project system

- SPA editor, explorer, CodeMirror, persistent projects with schema/migrations, keyboard UX, settings, autosave, import ZIP, local mode badge.
- **Exit:** reload/crash recovery, path validation, no server dependence, project content never sent externally.

### M2 — Python 3.14 production runtime

- Pyodide worker, output streaming, interactive input, stop/worker reset, tests, error links, offline caching, package allowlist.
- **Exit:** Python fixture matrix and static-host suite pass; console genuinely interactive.

### M3 — C++17+ compiler/runtime

- Bundle verified compiler/linker/sysroot/STL, multi-file build, stdin/stdout, warnings/errors, stop, caching, worker isolation.
- **Exit:** C++ fixture matrix and generic static-host suite pass; no remote execution.

### M4 — Java 11+ compiler/runtime

- Bundle compatible source compiler and browser JVM, compile multiple classes/packages, stdin, diagnostics, stop, licensing.
- **Exit:** Java fixture matrix and static-host suite pass; no remote compilation.

### M5 — Portable links and submissions

- Canonical schemas, URL compressed snapshots, QR optional, import preview, export `.codeproject` + ZIP, Canvas submission help.
- **Exit:** cross-browser round-trip tests, malicious package tests, size fallback, Canvas fragment verification + file fallback.

### M6 — Instructor assignment builder and local grading

- Assignment model, tester fixtures, hints, rubrics, public tests, preview, review mode and local score report.
- **Exit:** end-to-end offline instructor distribution -> student attempt -> manual review; scores accurately labeled untrusted.

### M7 — Offline, accessibility and release hardening

- SW download manager, cache update tests, full WCAG 2.2 AA checks, browser matrix, license notices, security and performance review.
- **Exit:** production static release for general HTTPS hosting, all three languages proved and no server necessary.

### M8 — Optional LTI 1.3 gateway

- ASP.NET Core gateway, OIDC, public JWKS, LTI validation, secure session, Canvas developer-key deployment guide, AGS, optional deep linking, resilience and auditing.
- **Exit:** authenticated Canvas launch/grade post works; gateway removal leaves M7 release fully functional.

### M9 — Optional trusted grading

- Separate sandboxed grader, immutable submission receipt, hidden server-only tests, rubric/policy verification, AGS posting only from authorized results.
- **Exit:** student spoofed local score cannot alter official grade; secure isolation demonstrated with adversarial tests.

## 17. Work tickets suitable for Codex

- `IDE-000` Repo/CI/ADR/security baseline
- `IDE-001` Static host and SharedArrayBuffer capability POC
- `IDE-002` Python 3.14 interactive runtime feasibility + tests
- `IDE-003` Java 11+ source compiler + JVM browser feasibility + license audit
- `IDE-004` C++17+ Clang/WASI browser compilation feasibility + license audit
- `IDE-005` Core project model, schema, serialization and validation
- `IDE-006` IndexedDB project repository and autosave/recovery
- `IDE-007` Workspace shell, CodeMirror and file explorer
- `IDE-008` Console stdin/stdout event system and worker lifecycle
- `IDE-009` Python production adapter
- `IDE-010` C++ production adapter
- `IDE-011` Java production adapter
- `IDE-012` Offline asset manager and cache-upgrade strategy
- `IDE-013` URL compressed sharing / integrity / import preview
- `IDE-014` ZIP and `.codeproject` import/export
- `IDE-015` Instructor assignment editor and versioning
- `IDE-016` Local test-runner and scoring/rubric view
- `IDE-017` Instructor submission review mode
- `IDE-018` WCAG 2.2 AA acceptance and keyboard flows
- `IDE-019` Cross-browser/static-host E2E and security regression
- `IDE-020` Production deploy/docs and source license report
- `IDE-021` Optional LTI gateway OIDC/JWKS/launch
- `IDE-022` Optional LTI AGS grade passback and deep linking
- `IDE-023` Optional isolated grader and trust policy

For every ticket require: goal, implementation, schema/interface changes, tests, manual reproduction instructions, screenshot/console evidence where relevant, known limitations, docs update, and passing CI. Do not begin `IDE-009`/`010`/`011` until matching feasibility evidence passes; all runners must share contracts.

## 18. Mandatory design ADRs

`ADR-001 static-first and zero required backend`; `ADR-002 UI framework and editor`; `ADR-003 per-language runtime provider selection`; `ADR-004 browser host isolation strategy`; `ADR-005 true interactive stdin across non-isolated hosts`; `ADR-006 local persistence and migration`; `ADR-007 URL payload and ZIP packaging`; `ADR-008 client-side grading trust statement`; `ADR-009 LTI gateway trust boundary`; `ADR-010 licensing and compiler artifact distribution`; `ADR-011 offline asset lifecycle`; `ADR-012 accessibility interaction patterns`.

## 19. Final acceptance checklist

- [ ] Real Python >=3.14 execution without service.
- [ ] Real Java >=11 **source compile and execution** without service.
- [ ] Real C++ >=17 compile/link/run without service.
- [ ] All three support genuine interactive stdin, streamed stdout/stderr and Stop.
- [ ] Works on ordinary static HTTPS and GitHub Pages subpath without custom server headers.
- [ ] No required backend, account or authentication for core IDE.
- [ ] Multi-file/folder projects and ZIP import/export; reliable autosave/recovery.
- [ ] Static source URL snapshots and portable `.codeproject` packages.
- [ ] Instructor packages support I/O tests, scoring points, hints and rubrics.
- [ ] Client-side scores never misrepresented as trusted or official.
- [ ] Anonymous local work; identity only from verified LTI.
- [ ] Optional gateway provides verified LTI 1.3 and AGS, without source code upload except intentional submission.
- [ ] Offline execution after needed assets cached; safe updates.
- [ ] WCAG 2.2 AA manual and automated testing completed.
- [ ] Threat-model scenarios and browser/host compatibility matrix pass.
- [ ] Open-source dependency licensing and redistribution reviewed.
- [ ] Reproducible build, documented deployment and maintenance guides delivered.

## 20. References for maintainers

1. Pyodide changelog, release 314.0.0 and Python 3.14.2: https://github.com/pyodide/pyodide/blob/main/docs/project/changelog.md
2. CheerpJ licensing (excluded from OSS core): https://cheerpj.com/docs/licensing
3. 1EdTech LTI 1.3/Advantage architecture: https://www.1edtech.org/standards/lti
4. Canvas LTI and AGS developer documentation: https://developerdocs.instructure.com/services/canvas/external-tools/lti/file.assignment_tools
5. Canvas external tool registration: https://developerdocs.instructure.com/services/canvas/external-tools/lti/file.tools_intro
6. Canvas URL assignment submissions: https://community.instructure.com/t5/Student-Guide/How-do-I-enter-a-URL-as-an-assignment-submission/ta-p/286
7. W3C WCAG 2.2: https://www.w3.org/TR/wcag/
8. YoWASP LLVM/Clang/LLD: https://github.com/YoWASP/clang

**Implementation kickoff prompt for Codex:** "Read this specification in full. Begin with M0/IDE-000–004 and implement the complete feasibility probes, deployable tests, and ADRs. Do not substitute a server-side execution API, old language versions or fake execution. Show evidence that Java source compilation, C++17 compilation and Python 3.14 execution truly run in-browser on generic static hosting. Once the feasibility gates pass, proceed through milestone tickets in dependency order. Keep LOCAL_ONLY build fully independent from LTI services." 


---

## 21. OSS runtime review and integration decision record (v1.1; supersedes earlier runtime recommendations)

### 21.1 Licensing policy and artifacts

- Application source: propose Apache-2.0, pending counsel/reviewer check on upstream integrations and copied code. Preserve copyright notices and SPDX identifiers.
- Favor **dependency consumption** via normal package imports or distinct bundled artifacts over copying third-party implementation files into our own source tree. No license is automatically "inherited" merely because the application loads a library, but license obligations still apply.
- Build an automated `third-party-manifest.json` and `THIRD_PARTY_NOTICES.md` with package, version, source repository, SPDX license, bundled binary source, hashes, authors, notice obligations, source offer and audit date.
- MPL-2.0 (Pyodide) and EPL-2.0 (ECJ) require compliance for covered modifications/distributions; GPL Classpath Exception and other licenses on Java class libraries must be analyzed at the specific artifact level.
- TraceCC's **AGPL-3.0-only** source makes it a potentially awkward fit for an Apache-2.0 project. Prefer a project-owned permissively licensed compiler adapter around license-approved upstream LLVM assets unless legal review affirmatively accepts TraceCC's integration and corresponding-source obligations. Do not relabel its code Apache-2.0.
- For `cppwasm`, inspect actual repo LICENSE, transitive dependencies, headers and artifacts before adoption. Feature claims (exceptions disabled, filesystem and threads unsupported) must be validated by our tests, not inferred from marketing descriptions.
- Do not equate source availability to an OSI-approved license. If a candidate's complete license set cannot be verified, it is **blocked**, not "probably free".
- Keep compile-time build tools distinct from shipping browser assets. A project can use an OSS tool offline in CI to produce static runtime artifacts, but **each student's source must be compiled entirely inside their own browser at runtime**.

### 21.2 Candidate comparison and verdicts

| Project | Published licensing | Contribution | Limitations / status | Verdict |
|---|---|---|---|---|
| Pyodide 314.x | MPL-2.0 core; bundled component licenses vary | CPython 3.14 runtime in WASM | Some native packages unsupported; `ssl` APIs restricted; interactive stdin needs probe | **Select for Python POC and production upon acceptance** |
| YoWASP Clang/LLVM | Apache-2.0, with LLVM-specific exceptions/component notices | Clang/LLD compiled to browser-executable WASM | Needs verified C++ stdlib, sysroot, WASI host and interactive stdin | **Preferred C++ component foundation** |
| TraceCC 0.1.1 | AGPL-3.0-only wrapper; LLVM assets under separate license | Ready-to-integrate in-browser Clang compiler wrapper | Pre-release API; AGPL obligations; no program executor bundled | **Research/reference or licensed integration**, not default |
| cppwasm | Verify actual repo license and binaries | Embeddable C++20 editor/compiler | Documents exceptions, threading and file I/O restrictions | **Secondary C++ feasibility candidate** |
| Eclipse ECJ/JDT Core | EPL-2.0 | Java 11+ source compiler and diagnostics | Java bytecode tool must itself be hosted inside browser; compiler alone cannot run programs | **Preferred Java compiler POC candidate** |
| BJVM | Check exact artifact license before including | Rust/WASM JVM based on Java SE 17 specification | Class-library breadth and execution compatibility unproven | **Java runtime POC A** |
| 199xVM | Check actual artifact license before including | WASM JVM + JS/TS Java source compiler prototype | Authors explicitly do not claim full JLS/JVMS compatibility | **Java full-stack POC B** |
| TeaVM | Apache-2.0 | Java classfiles to JS/WASM AOT | Limited standard API and dynamic classloading/reflection; compiled bytecode input | **Fallback / comparative study**, not drop-in Java JVM |
| Bytecoder | Apache-2.0 | Bytecode to JS/WASM | AOT, class-library/API limitations; not proven full student JVM | **Fallback / comparative study** |
| DoppioJVM | Inspect license and OpenJDK notices | JS JVM with filesystem/stdin concepts | Old Java 8 research runtime, Java 11 requirement fails | **Reject** |
| CheerpJ | Proprietary Community/Commercial | Very capable browser JVM | Free tier restricts self-hosting and redistribution | **Reject from mandatory/core distribution** |
| GraalVM Espresso | GPLv2 implementation; dependencies vary | JVM interpreter on GraalVM | Host JVM required, not a deployable browser JVM | **Reject as baseline** |

### 21.3 Java POC tracks: mandatory decision protocol

Implement **independent** static-host demos under `pocs/java-oss/`:

**Track A — ECJ + BJVM.** Determine a documented source-compile route to execute ECJ in browser, potentially by porting its required runtime libraries, but *do not assume BJVM can run ECJ just because ECJ is Java bytecode*. Independently verify classfile loading, runtime class-library methods, multi-class packages, `Scanner`, `StringBuilder`, collections, Java 11 syntax and exceptions. Test both the ECJ compiler's execution and the student's compiled program.

**Track B — 199xVM.** Test its native in-browser TypeScript Java compiler and WASM VM; check license first. Create an explicit Java 11 language feature suite (local-variable `var`, standard generics, lambda expressions, try-with-resources, package imports, class initialization and exceptions). Record unsupported syntax and standard-library methods. Never silently transpile Java-like pseudocode.

**Track C — alternate compiler/runtime.** Evaluate TeaVM or Bytecoder on real Java 11 source compiled by ECJ or another OSS browser compiler; recognize AOT compilation and JVM runtime are functionally different. Consider a project-owned narrow JVM only if its long-term maintenance cost is acceptable and formally documented. Do not start a JVM rewrite as an unreviewed automatic fallback.

**Java acceptance gates:**
1. Build all Java toolchain assets from source or retrieve license-approved reproducible binaries, and record SHA-256 hashes.
2. Serve static on GitHub Pages under a non-root path, no special headers, in Chrome/Edge/Firefox/Safari.
3. Fresh Java 11-source compilation entirely client side, no hidden compilation POST, no remote worker, and no code-execution API.
4. Run multi-file packages, collections, class constructors, inheritance/interfaces, generics, lambdas, `Scanner(System.in)`, `System.out` and `System.err` with input supplied **after** execution starts.
5. Show correct source locations for compile errors and runtime exceptions, and safely stop an infinite loop without losing the project.
6. Reopen offline after full asset caching and rerun from a fresh saved project.
7. Measure runtime memory, cold startup, warm startup, artifact download footprint and failures on school-classroom devices.
8. Document the actual implemented Java 11 API surface; "supports Java 11" must distinguish **language syntax**, **classfile version**, and **Java SE class library**.
9. If no POC passes, record `JAVA_BLOCKED_OSS_RUNTIME`, stop Java GA claims, and provide engineering choices to the project owner; do not weaken OSS/static/local constraints.

### 21.4 C++ integration pipeline and proof

Core architecture:

`source files → virtual filesystem → browser-hosted Clang frontend + LLVM → WASM objects → browser-hosted LLD → WASI module → isolated WASI host worker → output/input events`

Make a dedicated `@ide/runtime-cpp` adapter using a versioned `ToolchainManifest` listing `clang.wasm`, `lld.wasm`, required standard headers, libc++/libstdc++ (selected profile), libc/WASI sysroot, linker flags, emitted module limits, and notices. Verify compile/link/runtime **separately**. Do not claim full standard library support until the fixture matrix passes.

Additional fixtures: `<fstream>` within a permitted virtual filesystem, `std::exception` and `throw/catch` where compiler profile supports it, recursion, vectors/maps, multiple translation units and linker errors, C++17 filesystem APIs (if implemented), and `std::cin` input after run. Unsupported C++ features must appear as clear documented constraints. Provide a fallback **pre-supplied stdin mode** only as an explicit reduced-capability option, never falsely advertise it as equivalent to interactive stdin.

Resource limits should be modeled as budget enforcement plus worker termination, not absolute security guarantees. Never run untrusted compiled WASM inside the privileged app origin if it can access application-level APIs or credentials.

### 21.5 Release configuration and offline behavior

- `LOCAL_ONLY=true` build has zero authenticated API calls, no proprietary runtime, no external third-party CDN requirement after assets are installed, and no remote compilation.
- All required artifacts are served from a deployment-configurable relative base URL; use content-hashed immutable toolchain files and atomic service-worker cache upgrades.
- Publish **feature manifests** derived from measured acceptance tests: `languageVersion`, `compilerVersion`, `stdLibProfile`, `stdinMode`, `supportsMultipleFiles`, `supportsExceptions`, `supportsLocalFiles`, `requiresCrossOriginIsolation`, `offlineReady`, `licenseApproved`, and `experimental`.
- Permit static-host installations with optional thin runtime profiles (e.g., only Python cached); do not claim offline availability for Java/C++ until that specific runtime is cached and verified.
- Require browser-worker protocol version negotiation and clean errors when the app or compiler assets are from incompatible cache generations.

### 21.6 New work tickets (execute before original M0 and M3/M4 signoff)

- **OSS-001** Generate a complete dependency SBOM and license decision ledger; exclude CheerpJ and all unlicensed binaries.
- **OSS-002** Prove Pyodide 314.0.7 execution, stdin/interrupt, relative-path static hosting and offline cache.
- **OSS-003** Implement bare YoWASP compiler/linker/WASI proof with two C++17 translation units, standard headers and live input.
- **OSS-004** Compare TraceCC's implementation features without copying AGPL source into the permissive core; document whether an alternate permissive integration is feasible.
- **OSS-005** Compile and execute Java 11 source with ECJ + BJVM (two distinct browser toolchains must work); publish conformance matrix.
- **OSS-006** Independently compile and execute Java source with 199xVM, including JLS/JVMS coverage and license assessment.
- **OSS-007** Assess TeaVM and Bytecoder as alternatives with measurable standard Java compatibility and build complexity.
- **OSS-008** Write ADR accepting one Java runtime or marking the release blocked; no unsupported "Java 11" marketing.
- **OSS-009** Static-host/cross-browser automated smoke suite for each runtime plus network recording proving source stays local.
- **OSS-010** Automated third-party notices + artifact checksums + source/build provenance in CI.

### 21.7 Primary upstream source links

- Pyodide release notes: https://github.com/pyodide/pyodide/blob/main/docs/project/changelog.md
- Pyodide GitHub releases: https://github.com/pyodide/pyodide/releases
- YoWASP Clang: https://github.com/YoWASP/clang
- TraceCC: https://github.com/tracecodeapp/tracecc
- cppwasm: https://github.com/DVWang2001/cppwasm
- Eclipse JDT ECJ: https://github.com/eclipse-jdt/eclipse.jdt.core
- BJVM: https://github.com/itsu-dev/BJVM
- 199xVM: https://github.com/kawasima/199xVM
- TeaVM: https://github.com/konsoletyper/teavm
- Bytecoder: https://github.com/mirkosertic/Bytecoder
- DoppioJVM: https://github.com/plasma-umass/doppio
- CheerpJ restrictions: https://cheerpj.com/docs/licensing

### 21.8 Updated Codex kickoff instruction

> Read this entire specification including section 21, which overrides conflicting earlier runtime recommendations. Start with OSS-001 through OSS-010 and the M0 proof-of-concept harnesses. Do not use CheerpJ or any nonredistributable runtime. Produce real, reproducible, entirely browser-executed Python 3.14, Java 11, and C++17+ demonstrations on GitHub Pages with no custom server headers. Document source and binary licenses and third-party notices. If Java compatibility cannot be established, report the precise failing gates and halt its release rather than substitute proprietary or remote execution. Only then develop the production IDE in the M1–M9 order.
