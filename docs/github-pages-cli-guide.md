# Publishing Browser IDE to GitHub Pages via GitHub CLI (`gh`)

This walkthrough explains how to configure, build, and publish the Browser IDE directly to **GitHub Pages** using the **GitHub CLI (`gh`)** and automated GitHub Actions.

---

## 1. Prerequisites
- [GitHub CLI (`gh`)](https://cli.github.com/) installed and authenticated (`gh auth login`).
- Git repository initialized.

---

## 2. Setting Up GitHub Pages Repository

### Step 1: Create or Connect Remote Repository
```bash
# Create a new repository on GitHub and link it
gh repo create browser-ide --public --source=. --remote=origin --push
```

### Step 2: Configure GitHub Pages Settings via CLI
Enable GitHub Pages deployment using GitHub Actions:
```bash
# Enable GitHub Pages with GitHub Actions deployment
gh api -X POST repos/:owner/:repo/pages \
  -f build_type=workflow
```

---

## 3. Automated Deployment Workflow

The repository includes a GitHub Actions workflow that automatically builds and deploys `apps/web/dist` on every push to `main` / `master`.

File location: `.github/workflows/deploy-pages.yml`
```yaml
name: Deploy Static IDE to GitHub Pages

on:
  push:
    branches: [ master, main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js & pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Install Dependencies & Build Monorepo
        run: |
          pnpm install --frozen-lockfile
          pnpm build

      - name: Setup GitHub Pages
        uses: actions/configure-pages@v5

      - name: Upload Static Distributable Artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: 'apps/web/dist'

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

---

## 4. Manual Deployment via GitHub CLI (`gh-pages` Branch Option)

If you prefer deploying a built static artifact directly without waiting for a build action, you can publish using the `gh-pages` branch pattern:

```bash
# 1. Build the production static web app locally
pnpm install
pnpm --filter @ide/web build

# 2. Check out an orphan gh-pages branch or push dist
git checkout --orphan gh-pages
git reset
git --work-tree=apps/web/dist add --all
git --work-tree=apps/web/dist commit -m "deploy: publish static IDE to GitHub Pages"
git push origin gh-pages --force
git checkout master

# 3. Configure GitHub Pages to serve from gh-pages root
gh api -X POST repos/:owner/:repo/pages \
  -f source[branch]=gh-pages \
  -f source[path]="/"
```

---

## 5. Monitoring & Verifying Deployment

```bash
# Check GitHub Actions deployment workflow status
gh run list --workflow=deploy-pages.yml

# Watch live logs of running deployment
gh run watch

# Check GitHub Pages deployment status and live URL
gh api repos/:owner/:repo/pages
```

Once deployment completes, your static Browser IDE is live at:
`https://<username>.github.io/<repo-name>/`
with offline PWA capabilities and zero required server execution.
