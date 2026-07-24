# Changelog

## 0.1.2

- Fixed the installed-extension compiler path on Windows so the bundled Python compiler is resolved beneath the extension directory.
- Extended the extension-host test to open and successfully compile the feature-tour preview.

## 0.1.1

- Routed ordinary Markdown files to VS Code's built-in preview instead of showing a Report Markdown error.
- Allowed incomplete or legacy report files to reach the canonical compiler for precise diagnostics.
- Documented the boundary between the bundled editing-preview styles and canonical Paged.js print styles.

## 0.1.0

- Added a Report Markdown language for `*.report.md` and conventional `stakeholder-report.md` files.
- Added a live side-by-side preview that recompiles after source edits.
- Bundled the canonical Auditable Reports Python compiler with commit and SHA-256 provenance.
- Added source-line diagnostics and an Auditable Reports output channel.
- Rendered Markdown, code blocks, metrics, semantic tables, embedded figures, and Chart.js bar and pie charts.
- Honored document profile, orientation, source-display, and print-intent metadata.
- Added snippets for the standard constrained building blocks.
- Required Workspace Trust for local compiler execution and blocked remote webview resources.
- Added deterministic product branding, a feature-tour report, browser preview verification, and VSIX packaging.
