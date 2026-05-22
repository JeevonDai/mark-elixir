# VS Code Extension Quickstart & Release Guide

Welcome to the **Markdown MindMap (`mark-elixir`)** extension developer guide. This document outlines the setup, local development, testing, and the production release/publishing workflow.

---

## 🛠 Setup & Local Development

1. **Install Dependencies**:
   ```bash
   pnpm install
   ```

2. **Run in Development Mode**:
   - Press `F5` in VS Code to open a new **Extension Development Host** window with the extension loaded.
   - Edit the source code in `src/`.
   - The watch scripts (`pnpm run watch:tsc` and `pnpm run watch:esbuild`) will automatically recompile your TypeScript changes in real-time.
   - Reload the Extension Development Host window (`Cmd+R` on Mac or `Ctrl+R` on Windows) to see changes.

3. **Run Tests**:
   - Install the [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner).
   - Run tests through the Testing view in the sidebar or via the debug panel.

---

## 🚨 Security Pre-requisite

To prevent Personal Access Tokens (PATs) from being leaked, always ensure the token files are excluded from Git and the packaged extension:
- `.gitignore` and `.vscodeignore` are pre-configured to exclude `.vsce-token`, `.ovsx-token`, and `.env`.
- Store your publishing tokens in the root directory in local, untracked files named `.vsce-token` (for VS Code Marketplace) and `.ovsx-token` (for Open VSX).

---

## 🚀 Version Release & Publish Workflow

Follow these exact steps to release a new version of the extension:

### Step 1: Bump Version & Update Changelog
1. In [`package.json`](file:///Users/darksouls/projects/mindmap-plugin/mark-elixir/package.json), update the `"version"` field (e.g., `"1.1.0"`).
2. In [`CHANGELOG.md`](file:///Users/darksouls/projects/mindmap-plugin/mark-elixir/CHANGELOG.md), add a new section for the release with the date and key changes:
   ```markdown
   ## [1.1.0] - 2026-05-22
   - Key feature details here...
   ```

### Step 2: Build and Package
Compile and bundle the extension locally to verify there are no TypeScript, Linting, or Esbuild errors, and to generate the `.vsix` file:
```bash
pnpm run build
```
*This command runs type checking, linting, production bundling, and generates a local `mark-elixir-<version>.vsix` package.*

### Step 3: Publish to VS Code Marketplace
Publish the extension using your saved VSCE token:
```bash
export VSCE_PAT=$(cat .vsce-token)
pnpm run publish-ext
```

### Step 4: Publish to Open VSX Registry
Publish the packaged `.vsix` file to the Open VSX Registry using `ovsx`. 
> [!TIP]
> **Use `pnpm dlx` instead of `npx`** to run `ovsx`. This avoids potential cache directory permission issues (`EACCES` errors) on the local machine:

```bash
# Get the version from package.json
VERSION=$(node -p "require('./package.json').version")

# Publish using ovsx via pnpm dlx
pnpm dlx ovsx publish mark-elixir-$VERSION.vsix -p $(cat .ovsx-token)
```

### Step 5: Git Commit, Tag, and Push
Keep your version history clean and aligned with the marketplace:
```bash
# Stage and commit version changes
git add package.json CHANGELOG.md
git commit -m "chore: bump version to $VERSION"

# Create a git tag for the release
git tag v$VERSION

# Push master and tags to remote
git push origin master --tags
```

---

## 🔗 Useful Links
- **VS Code Marketplace**: [MindElixir.mark-elixir](https://marketplace.visualstudio.com/items?itemName=MindElixir.mark-elixir)
- **Publisher Dashboard (VS Code)**: [Marketplace Publisher Hub](https://marketplace.visualstudio.com/manage/publishers/MindElixir/extensions/mark-elixir/hub)
- **Open VSX Registry**: [Open VSX Home](https://open-vsx.org/)
- **Publisher Namespace (Open VSX)**: [Open VSX Publisher Hub](https://open-vsx.org/manage)
