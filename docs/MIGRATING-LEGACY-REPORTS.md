# Migrating an HTML/CSS report

Legacy Markdown that embeds `<div>`, `<table>`, `<style>`, or report-specific CSS is not valid
Report Markdown. Migrate the editable source once; do not keep patching generated HTML.

## 1. Add canonical front matter

```yaml
---
description: One-sentence scope.
document-type: decision-brief
generated-at: 2026-07-24T12:00:00-06:00
status: partial
evidence: evidence-package.json
print-orientation: portrait
page-size: Letter
source-display: hidden
date-display: date-only
pdf-name: stakeholder-report.pdf
---
```

Use exactly one relative `data` or `evidence` sidecar. A decision brief begins with
`## Executive Summary`, followed immediately by `## Immediate Direction`.

## 2. Replace presentation markup with report blocks

| Legacy construct | Report Markdown replacement |
| --- | --- |
| Masthead `<div>` and report date | Title plus front matter |
| Callout `<div>` | `## Immediate Direction` Markdown section |
| HTML table and `<colgroup>` | `::: table` with semantic column roles |
| `<img>` or Markdown image | `::: figure` |
| Chart script or canvas | Bounded `::: chart` block |
| `.page-break` rule | `break-before: page` on a supported block |
| `.avoid-break` rule | `keep-together: true` on a supported block |

Keep long database identifiers as canonical text. If a stakeholder table contains long
underscore-delimited identifiers, the migration step may add zero-width break opportunities
to the display dataset while preserving the unmodified value in the evidence collection.

## 3. Move CSS choices into safe semantics

Do not reference the old CSS file. Use:

- `document-type`, `page-size`, and `print-orientation` for the page profile
- `source-display` and `date-display` for edition policy
- table `kind` and column roles such as `item`, `narrative`, and `decision`
- `break-before` and `keep-together` for constrained pagination intent

The VS Code preview owns editing styles. The shared report renderer owns interactive styles,
and Paged.js owns final print CSS, page dimensions, running content, and page numbers.

## 4. Preserve evidence separately

For a decision brief, keep complete conflicts, decisions, recommendations, assumptions,
sources, and provenance in `evidence-package.json`. The Markdown selects the stakeholder
edition. Hiding sources or omitting a chart never removes evidence from the canonical package.

## 5. Rebuild from one command

Keep `rebuild-report.ps1` beside the editable files and write generated files under `output`.
Validate the artifact, paginated HTML, PDF dimensions, table widths, source policy, and dates
before removing the old CSS and hand-authored HTML.
