# Browser IDE

A static, in-browser Single Page Application (SPA) / Progressive Web App (PWA) development environment for **Python (>= 3.14)**, **Java (>= 11)**, and **C++ (>= C++17)** with **zero required backend servers**.

All student code compilation and execution occurs client-side in the browser using WebAssembly and Web Workers.

---

## Key Features

- **Zero Required Backend**: Runs on any generic HTTPS host (e.g. GitHub Pages or static web servers) with no custom server headers (`COOP`/`COEP`) needed.
- **Privacy by Default**: Student code, file names, and projects remain on the user's device in IndexedDB.
- **Genuine Interactive Stdin**: Supports interactive input (`input()`, `Scanner(System.in)`, `std::cin`) requested after program execution begins without requiring `SharedArrayBuffer`.
- **Multi-File & Folder Support**: Create, rename, edit, and organize multi-file projects.
- **Autosave & Conflict Recovery**: Debounced 500ms automatic persistence with revision tracking.
- **Portable Compressed Snapshots**: Share immutable project URLs using `#p=v1.<base64url>` within conservative 8 KiB browser URL budgets.
- **Local Grading & Assignments**: Instructor authoring format with automated I/O tests, rubrics, and local score reporting.
- **WCAG 2.2 Level AA Accessible**: Keyboard navigation, visible focus indicators, high contrast, screen reader landmarks, and polite announcements.
- **Optional Enterprise Integrations**: Optional separate ASP.NET Core microservices for Canvas LTI 1.3 launch, Assignment and Grade Services (AGS), and sandboxed Trusted Grading.

---

## Quickstart

### Prerequisites
- Node.js >= 20
- pnpm >= 9
- (Optional, for LTI/Trusted Grader services only): .NET SDK >= 9.0 or 10.0

### Installation & Development
```bash
# Clone the repository
git clone https://github.com/example/browser-ide.git
cd browser-ide

# Install workspace dependencies
pnpm install

# Build all packages and applications
pnpm build

# Run all unit and integration test suites
pnpm test

# Start the web IDE locally in development mode
pnpm --filter @ide/web dev
```

---

## Monorepo Layout

```text
browser-ide/
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
├── pocs/
│   ├── hosting-capabilities/    # POC-A: Zero-header static host capability probe
│   └── java-oss/                # POC-C: Java 11+ in-browser test harness & gating
├── tests/                       # Real university course code tests (Berkeley, Princeton, Stanford)
└── docs/                        # ADRs, threat model, a11y audit, SBOM, and deployment guide
```

---

## Documentation Links

- **Deployment Guide**: [`docs/deployment-guide.md`](docs/deployment-guide.md)
- **Threat Model & Security Policy**: [`docs/threat-model.md`](docs/threat-model.md)
- **WCAG 2.2 AA Accessibility Audit**: [`docs/accessibility-audit-wcag22.md`](docs/accessibility-audit-wcag22.md)
- **Architectural Decision Records**:
  - [ADR-001: Static-first and zero required backend](docs/adr/ADR-001-static-first-and-zero-required-backend.md)
  - [ADR-003: Runtime provider selection & OSS baseline](docs/adr/ADR-003-per-language-runtime-provider-selection.md)
  - [ADR-005: Interactive stdin across non-isolated hosts](docs/adr/ADR-005-true-interactive-stdin-across-non-isolated-hosts.md)
  - [ADR-008: Java runtime reality and qualification plan](docs/adr/ADR-008-java-runtime-reality-and-integration-plan.md)
- **Third-Party Notices & SBOM**: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and [`docs/third-party-manifest.json`](docs/third-party-manifest.json)
- **Final Acceptance Checklist**: [`docs/final-acceptance-report.md`](docs/final-acceptance-report.md)

---

## License

Licensed under the Apache License 2.0. Third-party components retain their respective open-source licenses (see `THIRD_PARTY_NOTICES.md`). Proprietary runtimes (e.g., CheerpJ) are strictly excluded.
