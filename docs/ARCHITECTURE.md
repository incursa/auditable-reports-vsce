# Auditable Reports VS Code architecture

## Outcome

The extension keeps Report Markdown as an ordinary text document and opens a disposable webview preview beside it. It does not register a default custom editor because replacing the text editor would make simple Markdown editing, diffs, merge resolution, automation, and agent-authored changes less direct.

## Runtime flow

```text
saved .report.md
      │ edit, debounce
      ▼
bundled canonical compile_report.py
      │ reads relative data/evidence and figures
      ▼
in-memory artifact.json
      │ postMessage
      ▼
isolated VS Code webview
      ├─ Markdown narrative
      ├─ metrics and semantic tables
      ├─ embedded validated figures
      └─ Chart.js bar, line, pie, and scatter charts
```

The extension never writes a durable `artifact.json` during preview. Temporary compilation output is created under the operating-system temporary directory and removed after each attempt.

## Canonical boundary

`runtime/compiler/compile_report.py` and `report_config.py` are exact copies from the sibling `auditable-reports` repository. `COMPILER-PROVENANCE.json` records the source commit and SHA-256 hash of each file.

Run:

```powershell
npm run compiler:sync
npm run compiler:verify
```

`compiler:sync` is an explicit repository-maintenance action. Ordinary extension builds only verify the pinned copies, so packaging cannot silently acquire a different compiler.

The preview renderer is not the canonical interactive or print renderer. Its purpose is fast editing feedback. Final report bundles continue through the portable Data Analytics renderer, Chart.js print materialization, Paged.js pagination, and PDF validation in `auditable-reports`.

## VS Code surface

- Language ID: `auditable-report`
- Primary extension: `.report.md`
- Conventional compatibility name: `stakeholder-report.md`
- Preview command: `auditableReports.openPreviewToSide`
- Refresh command: `auditableReports.refreshPreview`
- Output channel and diagnostic source: `Auditable Reports`
- Default shortcut: `Ctrl+K V` or `Cmd+K V` when a Report Markdown editor has focus

The extension contributes a Markdown-derived TextMate grammar, language configuration, file icons, and constrained authoring snippets. The standard text editor remains responsible for file writes and edit history.

When the preview command is invoked on ordinary Markdown, the extension delegates to VS Code's built-in
Markdown preview. Files associated with `auditable-report` always reach the canonical compiler so incomplete
or legacy front matter receives a precise compiler diagnostic instead of a generic preflight failure.

## Refresh behavior

Text edits schedule compilation after `auditableReports.preview.debounceMs`. A newer edit aborts an older compilation and stale results are ignored by revision number.

The source is scanned for relative `data`, `evidence`, and figure `path` dependencies. Saving one of those open documents schedules a dependent preview refresh. Arbitrary absolute paths and parent traversal are excluded from dependency tracking and rejected or constrained by the canonical compiler.

## Security model

- Live preview requires a trusted workspace because it starts a Python subprocess.
- `auditableReports.pythonPath` is machine-scoped and listed as a restricted configuration.
- Only the extension's bundled compiler is executed; report content is treated as data.
- The compiler permits only relative sidecars and constrained figure types and sizes.
- The webview Content Security Policy blocks remote content.
- Chart.js and Markdown rendering are bundled with the extension.
- Markdown raw HTML is disabled.
- Report-authored CSS is disabled. The editing surface uses a bundled preview stylesheet; the final edition
  uses shared renderer and Paged.js print CSS derived from safe report configuration.
- Figure HTML is not inserted directly; the webview reconstructs an image and text caption from compiler-validated data.
- The webview receives an artifact only after a successful compile.

## Packaging

The VSIX includes:

- desktop extension host bundle
- preview webview bundle with Chart.js and Markdown rendering
- pinned canonical Python compiler and provenance
- language grammar, configuration, snippets, and file icons
- product icon, banner, preview screenshot, and example report
- license, brand terms, changelog, and third-party package notices

`npm run release:check` verifies compiler hashes, brand asset dimensions and references, type checks, lint, unit and integration tests, browser rendering, and VSIX creation.

## Known gaps and intended evolution

1. Sidecar buffers: preview currently observes saved JSON and image content. A future virtual compilation workspace could mirror dirty sidecar buffers without mutating the project.
2. Exact pagination: the authoring preview shows safe page-break intent but not Paged.js page boxes. An optional paginated inspection mode could use the canonical print build without replacing the fast preview.
3. Navigation: block IDs make source-to-preview scroll sync and click-to-reveal feasible, but source ranges must be added to the compiler result or a parallel source map.
4. Python dependency: a future TypeScript compiler may target Node and the browser only after a shared fixture suite proves deep-equal canonical `artifact.json` output for every document profile, directive, normalization rule, failure category, and evidence-package shape. Until that parity gate exists, Python remains the sole DSL implementation and a web host must not claim compilation support.
5. Build command: final bundle generation can be exposed through a trusted task or command after output destination, locked-file behavior, and progress reporting are specified.

The sibling `auditable-reports` bundle remains the print authority. Its ordinary bundle command forwards
page size, orientation, source/date display, and PDF name to local Paged.js/Chart.js rendering, writes
paginated HTML beside the PDF, validates the resulting pages, and uses lock-safe atomic replacement. The
extension deliberately does not fork those rules into its fast editing preview.
