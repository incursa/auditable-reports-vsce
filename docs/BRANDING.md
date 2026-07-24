# Auditable Reports branding

The Auditable Reports mark combines a document page, a bounded bar chart, and an evidence check. The page represents the canonical artifact boundary; the chart represents compact report visuals; the check represents provenance and validation.

## Asset inventory

| Asset | Size or format | Intended use |
| --- | --- | --- |
| `images/icon.png` | 256×256 PNG | Marketplace icon |
| `images/icon-128.png` | 128×128 PNG | High-density product surfaces |
| `images/icon-64.png` | 64×64 PNG | Documentation and extension surfaces |
| `images/icon-32.png` | 32×32 PNG | Compact UI |
| `images/icon-16.png` | 16×16 PNG | Minimum-size legibility check |
| `images/auditable-reports-icon.svg` | SVG | Editable icon master |
| `images/auditable-reports-readme-banner.*` | 960×220 SVG and PNG | README and release banner |
| `images/auditable-reports-wordmark-vscode.svg` | SVG | Product wordmark |
| `resources/auditable-reports.svg` | theme-aware SVG | Activity and UI mark |
| `resources/report-file-*.svg` | light and dark SVG | Report Markdown file icon |
| `images/report-preview.png` | 1440×1200 PNG | Current preview screenshot |
| `artifacts/brand/auditable-reports-brand-sheet.*` | 1200×720 SVG and PNG | System reference |

## Palette

| Role | Value |
| --- | --- |
| Incursa Indigo | `#4459C6` |
| Report Ink | `#263248` |
| Evidence Teal | `#25A59A` |
| Print Gold | `#E4A448` |

## Rebuild and verify

```powershell
npm run brand:build
npm run brand:verify
```

The PNG files are deterministic browser renders of tracked SVG masters. The verification step checks image dimensions, Marketplace and README references, and the theme-aware monochrome mark.
