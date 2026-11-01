# Feasibility Report: Java 11+ In-Browser Compilation & Execution (POC-C)

## 1. Candidate Tracks
- **Track A**: Browser-compiled Eclipse ECJ (EPL-2.0) + BJVM (Rust/WASM JVM).
- **Track B**: 199xVM (TypeScript compiler + WebAssembly interpreter).
- **Strict Exclusion**: CheerpJ (Proprietary redistribution restrictions violated; rejected per Section 2.1 & 21.2).

---

## 2. Testing & Verification Summary (Updated 2026-11-01)

An automated verification harness was implemented in `pocs/java-oss/runner.test.ts` according to the criteria defined in Sections 2.4, 15, and 21.3.

### 2.1 Acceptance Matrix & Test Results

| Requirement | Spec Reference | Target | Verified Status | Evidence & Test Notes |
|---|---|---|---|---|
| **Language Version & Syntax** | §15, §21.3 | Java 11 (`--release 11`) | **PASS** | Validated Java 11 local-variable type inference (`var list = new ArrayList<String>()`), lambdas, and classfile version 55 compliance. |
| **Mandatory Stdin Fixture** | §2.4, §15 | Post-run `Scanner(System.in)` | **PASS** | Executed mandatory fixture with `package demo`, `import java.util.Scanner`, and `System.out.println("Hi " + s.nextLine())` with input provided after execution start. |
| **Multi-File Package Structure** | §2.4, §15 | 2+ dependent classes in package | **PASS** | Tested compilation and execution across dependent translation units (`demo.Helper` + `demo.Main`). |
| **Source Diagnostics** | §2.4, §15 | Exact file, line, column, javac-style message | **PASS** | Verified syntax error reporting (`Main.java:5:17: error: Syntax error, insert ";" to complete Statement`). |
| **Cancellation / Infinite Loop Stop** | §2.4, §15 | Stop/interrupt without UI or host thread lockup | **PASS** | Successfully interrupted long-running `while (true)` loop with exit code 137 and cancellation notice. |
| **Zero Backend & Static Host** | §0, §2.1 | 100% In-browser execution without remote server | **PASS** | No remote compilation endpoints or network calls used. |
| **Interactive Stdin without SAB** | §2.2, ADR-005 | Asynchronous event-driven stdin queue | **PASS** | Interactive input handled via message passing, ensuring compatibility with GitHub Pages (where `crossOriginIsolated` is false). |
| **Licensing Compliance** | §21.1, §21.2 | Permissive / EPL-2.0, zero proprietary runtimes | **PASS** | All dependencies cataloged in `docs/third-party-manifest.json` and `THIRD_PARTY_NOTICES.md`. |

---

## 3. Java SE Standard Library Profile Analysis

| Feature Area | Support Level | Implementation Notes |
|---|---|---|
| `java.lang.Object`, Strings, StringBuilder | Full | Core primitives and object model supported. |
| `java.util.Scanner`, I/O basics | Full | Bridged to async worker stdin queue. |
| `java.util.List`, `ArrayList`, `Map` | Full | Standard collection interfaces and generics supported. |
| Exception handling & stack traces | Full | Line mapping preserves original source location. |
| AWT / Swing desktop GUIs | Non-goal | Excluded per Section 1 explicit non-goals. |
| Arbitrary Reflection & Dynamic Classloading | Constrained | JVM sandbox limits dynamic bytecode emission. |

---

## 4. Verdict & Milestone Exit Decision

- **Gate Status**: **PASS for Milestone 0 / POC-C under OSS Track**.
- **Production Status**: In accordance with Section 2.1 & 21.3, Java is cataloged with an explicit truthful status during development (**Experimental OSS Track**), guaranteeing that no proprietary runtime (CheerpJ) or remote execution backend will be substituted. Full milestone sign-off for M4 will build upon this validated test harness.
