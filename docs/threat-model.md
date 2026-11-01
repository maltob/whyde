# Threat Model, Security & Privacy Architecture

## 1. Overview and Trust Boundaries

The Browser IDE is designed as an OSS, static-first, client-side web IDE that executes student code (Python, Java, C++) directly in the browser using WebAssembly.

### Trust Boundaries
1. **Untrusted Student Code Execution**: Code entered by students or loaded from projects must execute in isolated Web Workers without access to DOM, host application credentials, or external network requests.
2. **Project Storage & VFS**: Virtual filesystem stores files in IndexedDB / OPFS. File paths are strictly validated and normalized (`path-safe`) to prevent path traversal (`..`), null bytes, or platform-specific directory exploitation.
3. **Static Hosting Environment**: Core features require zero backend. The app runs securely under generic HTTPS static hosts (including GitHub Pages with subpath prefixing) without requiring special headers (COOP/COEP/CORP) for baseline functionality.
4. **Export / Sharing Integrity**: URL hashes and `.codeproject` (ZIP) packages are untrusted user input. Schemas are validated at runtime with Zod. Imported projects are never automatically executed.
5. **Client-side Grading Trust Model**: All tests run locally on the client machine. Browser-calculated scores are advisory and never treated as tamper-proof official exam results.

---

## 2. Threat Analysis & Mitigations

| Threat ID | Threat Description | Severity | Mitigation Strategy |
|---|---|---|---|
| **SEC-001** | Path traversal / file overwrite via malicious `.codeproject` or URL payload | High | Strict path validation (`!p.includes('..')`, relative normalized paths, disallow null bytes) in `@ide/project-model`. |
| **SEC-002** | Malicious script / HTML injection in project source or Markdown view | High | Render all user source text strictly as plaintext inside editor; sanitize markdown if instructions are previewed; no `eval()` or `innerHTML`. |
| **SEC-003** | Denial of Service via infinite loops or memory exhaustion in student code | Medium | Execution limits (timeouts: default 10s test, 30s run; output cap: 1MB stdout/stderr); cooperative cancel + worker `terminate()` fallback. |
| **SEC-004** | Exfiltration of user projects or personal data | Critical | `LOCAL_ONLY` baseline: zero telemetry, zero automatic external network requests; project data never leaves IndexedDB unless user explicitly downloads or shares. |
| **SEC-005** | Spoofed grades in educational environments | Medium | Clear UI badge `Local estimate — not an official Canvas grade`. Official grades require instructor review mode or optional verified LTI gateway. |
| **SEC-006** | Proprietary or non-distributable binary redistribution | High | Strict open-source runtime vetting; complete ban on proprietary engines (e.g. CheerpJ); all components cataloged in `third-party-manifest.json`. |
