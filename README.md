# Browser IDE (WhyDE)

A fast, static, client-side web IDE and Progressive Web App (PWA) supporting **Python (>= 3.14)**, **C++ (>= C++17)**, and **Java (>= 11)** with **zero required backend servers**.

Designed specifically for computer science education, course lab assignments, interactive textbook embeds, and exams:
- All compilation and execution runs 100% inside the student's browser via WebAssembly (Clang/WASI & Pyodide) and an in-memory Java runtime.
- Works offline, loads from any generic static HTTPS host (such as GitHub Pages or AWS S3), and requires no server-side execution containers or custom isolation headers (`COOP`/`COEP`).

---

## Guide for Instructors & Faculty

WhyDE allows instructors to author code templates, embed interactive programming environments into course pages, and configure student environments simply using **URL parameters** and **URL snapshots**.

### 1. Instant Environment Configuration (URL Hashes)

Instructors can configure the environment via URL hash parameters (e.g. `https://your-pages-url/#lang=python&blank=true&hideNewProject=true`):

| URL Parameter | Options | Description | Use Case |
| :--- | :--- | :--- | :--- |
| `lang` | `python`, `cpp`, `java` | Selects default project language on launch. | Pre-selecting language for an assignment. |
| `blank` | `true`, `1`, `false` | When `true`, opens a clean empty file instead of hello-world starter code. | Homework and scratchpad exercises. |
| `hideNewProject` | `true`, `1`, `false` | Hides the "+ New Project" button in the navigation bar. | Restricting students to the single active lab. |
| `highlight` | `on`, `off`, `0` | Controls syntax color highlighting in the editor. When `off`, syntax coloring is disabled and the toolbar color button is hidden. | Exam and quiz mode. |
| `codeSuggest` | `1`, `0` | Controls standard library & keyword code autocomplete suggestions. When `0`, autocomplete is disabled and the suggest button is hidden. | Exam mode or testing raw syntax recall. |
| `file` | path (e.g. `src/main.cpp`) | Opens and focuses a specific file within the workspace on load. | Directing student focus to a specific starter file. |

#### Example Instructor Links
* **Python Exam Mode** (No autocomplete, no syntax highlighting, no project switching):  
  `https://your-site.edu/#lang=python&highlight=off&codeSuggest=0&hideNewProject=true`
* **C++ Data Structures Lab Starter**:  
  `https://your-site.edu/#lang=cpp&file=src/main.cpp`
* **Java Blank Scratchpad**:  
  `https://your-site.edu/#lang=java&blank=true`

---

### 2. Sharing Starter Projects & Multi-File Assignments

Instructors can design complete multi-file project starters (including headers, test inputs, and starter files) and distribute them via **Portable Compressed Snapshots**:

1. Open WhyDE and create your assignment files and folder hierarchy in the File Explorer.
2. Click **Share** (or Export) to generate a portable URL fragment (`#p=v1.<base64url>`).
3. Distribute this URL to students via your syllabus, LMS, or assignment page.
4. When a student opens the link:
   - A safe preview modal displays the assignment name and file structure.
   - When the student clicks **Import**, a local copy is cloned into their browser's IndexedDB. Their modifications are private and never overwrite your original template.

---

### 3. Embedding in Canvas, Blackboard, Moodle, or Course Websites

Because WhyDE does **not** rely on `Cross-Origin-Opener-Policy` (COOP) or `Cross-Origin-Embedder-Policy` (COEP) headers, it can be embedded directly in an `<iframe>` within any LMS or textbook:

```html
<iframe
  src="https://your-username.github.io/whyde/#lang=python&hideNewProject=true"
  width="100%"
  height="700px"
  style="border: 1px solid #ccc; border-radius: 8px;"
  allow="clipboard-read; clipboard-write">
</iframe>
```
*(Note: `allow="clipboard-read; clipboard-write"` enables standard code copy/pasting in the browser editor).*

---

### 4. Language Features & Capabilities

* **Python 3.14 (Pyodide WASM)**:
  * Full Python standard library support.
  * Real-time interactive standard input (`input()`) via terminal.
  * Built-in turtle graphics and matplotlib plotting tab.
* **C++ (C++17/C++20 via Clang WASM & WASI)**:
  * Standard C++ runtime with `iostream`, `vector`, `string`, `cmath`, and STL containers.
  * Non-blocking compilation yielding to UI at 60fps.
  * Multi-file project support (`.h`, `.cpp`) with virtual file system mounts.
* **Java (Java 11+ compatible in-browser runtime)**:
  * Classes, user methods, recursion, and switch statements.
  * Autoboxing and primitive/reference casting.
  * Exception handling (`try-catch-finally`).
  * In-memory Virtual File I/O (`java.io.File`, `Scanner(File)`).

---

## Developer Quickstart

### Prerequisites
- Node.js >= 20
- pnpm >= 9
- (Optional, for LTI / enterprise grader services): .NET SDK >= 9.0 or 10.0

### Local Development
```bash
# Clone the repository
git clone https://github.com/example/whyde.git
cd whyde

# Install workspace dependencies
pnpm install

# Build all packages and applications
pnpm build

# Run all unit and integration test suites
pnpm test

# Start the web IDE locally
pnpm --filter @ide/web dev
```

### GitHub Actions CI & Pages Deployment

The repository includes a unified GitHub Actions workflow ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)):
- Automatically runs tests, type checks, and linter across all packages on push and pull requests.
- Builds production bundles and packages a standalone distributable `release-web.zip`.
- Automatically deploys the static application to **GitHub Pages** on every push to `master`/`main`.

To enable GitHub Pages in your fork or repository:
1. Go to **Settings > Pages** in your GitHub repository.
2. Under **Build and deployment > Source**, select **GitHub Actions**.

---

## Monorepo Layout

```text
whyde/
├── apps/
│   └── web/                     # React + Vite static SPA frontend & PWA Service Worker
├── packages/
│   ├── execution-contracts/     # RuntimeProvider interfaces & lifecycle contracts
│   ├── project-model/           # Zod schema validation & path traversal defenses
│   ├── storage-browser/         # IndexedDB project repository & debounced autosave
│   ├── runner-python/           # Python 3.14 Pyodide worker runtime adapter
│   ├── runner-cpp/              # C++17+ Clang/LLD/WASI compiler & toolchain manifest
│   ├── sharing/                 # Compressed URL snapshots & 8 KiB budget budgeting
│   ├── assignments/             # Instructor assignment models, grading & rubric reports
│   └── integration-contracts/   # LocalOnlyProvider & optional LTI contracts
├── optional-services/
│   ├── lti-gateway/             # Optional standalone ASP.NET Core Canvas LTI 1.3 gateway
│   └── trusted-grader/          # Optional isolated sandboxed grading service
└── docs/                        # Architectural decision records, threat model, a11y audit
```

---

## Documentation Links

- **Deployment Guide**: [`docs/deployment-guide.md`](docs/deployment-guide.md)
- **Threat Model & Security Policy**: [`docs/threat-model.md`](docs/threat-model.md)
- **WCAG 2.2 AA Accessibility Audit**: [`docs/accessibility-audit-wcag22.md`](docs/accessibility-audit-wcag22.md)
- **Architectural Decision Records (ADRs)**: [`docs/adr/`](docs/adr/)
- **Third-Party Notices**: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)

---

## License

Licensed under the Apache License 2.0. Third-party components retain their respective open-source licenses (see `THIRD_PARTY_NOTICES.md`).
