# Marketplace release runbook

## Prerequisites

- Node.js 22 or newer
- Python 3
- Visual Studio Code 1.110 or newer
- A Visual Studio Marketplace personal access token in `VSCE_PAT` only when publishing

Never commit or pass a Marketplace token as a literal command-line argument.

## Refresh the canonical compiler

Only when the `auditable-reports` compiler intentionally changes:

```powershell
npm run compiler:sync
npm run compiler:verify
```

Review the provenance commit and extension integration tests before committing the synchronized files.

## Verify and package

```powershell
npm ci
npm run release:check
```

This produces `auditable-reports-vsce.vsix`.

## Local install

```powershell
code --install-extension .\auditable-reports-vsce.vsix --force
```

Open `examples\feature-tour\report.report.md`, then run **Auditable Reports: Open Preview to the Side**.

## Publish

```powershell
vsce publish
```

`vsce` reads `VSCE_PAT` from the process environment. Clear the variable after publishing.
