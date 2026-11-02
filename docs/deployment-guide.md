# Browser IDE — Deployment & Operations Guide

This guide describes how to build and deploy the Browser IDE across various static hosting environments and optional enterprise services.

---

## 1. Core Static IDE Deployment (Zero Backend)

The primary build artifact is a 100% static Single Page Application (SPA). It requires no server-side execution runtime, no database, and no server configuration.

### Deployment Targets
- **GitHub Pages** (with repository subpath, e.g. `https://username.github.io/repo-name/`)
- **Campus Intranet Web Servers** (Apache HTTP Server, Nginx, IIS)
- **Cloud Object Storage & CDNs** (AWS S3 + CloudFront, Cloudflare Pages, Netlify, Vercel)

### Building the Static Bundle
```bash
# In repository root:
pnpm install
pnpm --filter @ide/web build
```
The output will be generated in `apps/web/dist/`.

### Serving from Subpaths (e.g., GitHub Pages)
The Vite configuration in `apps/web/vite.config.ts` uses relative paths (`base: './'`). This ensures:
- Script and stylesheet assets load correctly regardless of whether the site is hosted at the root (`/`) or in a subpath (`/whyde/`).
- No URL rewrite rules or history API fallbacks are mandatory on the static server.

### Deploying to GitHub Pages via GitHub Actions
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy Static IDE to GitHub Pages

on:
  push:
    branches: [ main ]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build-and-deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js & pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Install & Build
        run: |
          pnpm install
          pnpm build

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload Artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: 'apps/web/dist'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

---

## 2. Web Server Configuration Examples

### Nginx Static Hosting
```nginx
server {
    listen 443 ssl http2;
    server_name ide.campus.edu;

    root /var/www/browser-ide/dist;
    index index.html;

    # Baseline: no special COOP/COEP headers needed
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Enable compression for WASM and assets
    gzip on;
    gzip_types text/plain text/css application/json application/javascript application/wasm;
}
```

### Apache (`.htaccess`)
```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>
```

---

## 3. Optional Services Deployment

The core static IDE does **not** require any backend services. However, if an institution opts into authenticated Canvas LTI 1.3 launch or centralized trusted grading, deploy the optional microservices independently.

### 3.1 Optional Canvas LTI 1.3 Gateway (`optional-services/lti-gateway`)
- **Runtime**: ASP.NET Core (.NET 9 or .NET 10) on Linux/Windows or Azure App Service / AWS ECS / Google Cloud Run.
- **Environment Variables**:
  - `LtiSecurity__AllowedIssuers__0`: `https://canvas.instructure.com`
  - `LtiSecurity__AllowedOrigins__0`: `https://your-campus.github.io`
  - `LtiSecurity__ClientId`: `Your-Developer-Key-Client-ID`
  - `LtiSecurity__RequireTrustedGrading`: `true`
- **Build Command**:
  ```bash
  dotnet publish optional-services/lti-gateway -c Release -o ./publish/lti-gateway
  ```

### 3.2 Optional Trusted Grader Service (`optional-services/trusted-grader`)
- **Runtime**: Isolated, network-disabled Linux container/worker tier.
- **Environment Variables**:
  - `GraderSecurity__GatewayApiKey`: Strong mutual secret shared with LTI gateway.
  - `GraderSecurity__MaxExecutionTimeSeconds`: `10`
  - `GraderSecurity__MaxMemoryMb`: `256`
- **Build Command**:
  ```bash
  dotnet publish optional-services/trusted-grader -c Release -o ./publish/trusted-grader
  ```

---

## 4. Verification Checklist Post-Deployment

1. **Static Host Check**: Open Developer Tools -> Network tab. Verify that editing, running Python, and compiling C++ creates **zero outgoing network calls for code execution**.
2. **Offline Check**: Load the IDE, disconnect network (or enable Offline in DevTools Application tab), and verify the IDE continues to edit and run cached languages.
3. **Subpath Check**: Verify that icons, styles, and Web Workers load without 404 errors when served under a subdirectory path.
