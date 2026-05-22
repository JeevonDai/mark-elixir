# VS Code Extension Publish Guide (Mark Elixir)

A minimal, secure guide to packaging and publishing the **Markdown MindMap (`mark-elixir`)** extension using the pre-configured workflow.

---

## 🚨 Security Pre-requisite

To prevent your Personal Access Token (PAT) from being leaked, always ensure the token file and environment secrets are excluded from both Git and the packaged extension.

1. **`.gitignore`** prevents files from being pushed to Git:
   ```ignore
   .vsce-token
   .ovsx-token
   .env
   ```
2. **`.vscodeignore`** prevents files from being bundled into the packaged `.vsix` file:
   ```ignore
   .vsce-token
   .ovsx-token
   .env
   pnpm-lock.yaml
   *.vsix
   ```

Store your tokens in local, ignored files named `.vsce-token` (for VS Code Marketplace) and `.ovsx-token` (for Open VSX) in the root directory.

---

## 🚀 The Release Workflow

Follow these exact steps to publish a new version:

### 1. Update Version & Changelog
- Update `"version"` in [`package.json`](package.json) (e.g., `1.0.1`).
- Document the new version's release notes in [`CHANGELOG.md`](CHANGELOG.md).
- Run dependency setup:
  ```bash
  pnpm install
  ```

### 2. Package and Build
Compile and bundle the extension locally for verification:
```bash
pnpm run build
```
*This command runs type checking (`tsc`), linting (`eslint`), packages the assets with `esbuild`, and verifies that the output `.vsix` is clean.*

### 3. Direct Publish to VS Code Marketplace
Publish the extension using the saved VSCE token:

```bash
export VSCE_PAT=$(cat .vsce-token)
pnpm run publish-ext
```

### 4. Direct Publish to Open VSX Registry
Publish the packaged `.vsix` file to the Open VSX Registry using `ovsx` and your saved Open VSX token:

```bash
# Get the version from package.json
VERSION=$(node -p "require('./package.json').version")

# Publish using ovsx
npx ovsx publish mark-elixir-$VERSION.vsix -p $(cat .ovsx-token)
```

---

## 🔗 Useful Links
- **VS Code Marketplace**: [MindElixir.mark-elixir](https://marketplace.visualstudio.com/items?itemName=MindElixir.mark-elixir)
- **Publisher Dashboard (VS Code)**: [Marketplace Publisher Hub](https://marketplace.visualstudio.com/manage/publishers/MindElixir/extensions/mark-elixir/hub)
- **Open VSX Registry**: [Open VSX Home](https://open-vsx.org/)
- **Publisher Namespace (Open VSX)**: [Open VSX Publisher Hub](https://open-vsx.org/manage)

