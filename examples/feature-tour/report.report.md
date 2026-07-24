---
document-type: report
description: A synthetic delivery review that exercises the standard Report Markdown building blocks.
generated-at: 2026-07-24T12:00:00-06:00
status: fixture
data: report.data.json
print-orientation: portrait
page-size: Letter
source-display: visible
date-display: date-only
pdf-name: northwind-delivery-review.pdf
---

# Northwind Delivery Review

## Executive Summary

<!-- source: portfolio_snapshot -->

Delivery remains recoverable, but the field enablement and migration workstreams need immediate attention. The current synthetic forecast is **$150,000 over plan**, with two of six workstreams marked at risk.

::: metrics
id: headline_metrics
dataset: headline
source: portfolio_snapshot
metric: approved_budget | Approved budget | currency | Current approved portfolio budget.
metric: forecast_variance | Forecast variance | currency | Forecast less approved budget. | signed
metric: at_risk | At-risk workstreams | number | Workstreams requiring active recovery.
metric: completion | Overall completion | percent | Weighted delivery progress.
:::

## Where attention is needed

The variance is concentrated in two workstreams. The chart intentionally stays simple: one prepared series, bounded categories, and a semantic data source.

::: chart
id: variance_by_workstream
type: bar
title: Forecast variance by workstream
subtitle: Positive values are over approved budget
dataset: workstreams
source: portfolio_snapshot
category: workstream
value: variance
category-label: Workstream
value-label: Forecast less budget
format: currency
keep-together: true
:::

## Workstream detail

::: table
id: workstream_snapshot_table
title: Current workstream snapshot
subtitle: Synthetic values prepared for extension testing
dataset: workstreams
source: portfolio_snapshot
column: workstream | Workstream | text | item
column: owner | Owner | text | owner
column: status | Status | text | status
column: completion | Completion | percent
column: variance | Variance | currency | amount | movement
column: next_gate | Next gate | date | date
sort: variance | desc
:::

## Print workflow

The editable file compiles to the canonical artifact before either preview or print rendering. The extension uses the same boundary and never treats its webview as durable output.

```powershell
py scripts/build_report_bundle.py `
  --input .\report.report.md `
  --output-dir .\output
```

::: figure
id: report_pipeline
path: report-pipeline.svg
alt: A four-step flow from Report Markdown through artifact JSON and preview to paginated PDF.
caption: The preview is immediate; the Paged.js PDF remains the print authority.
source: pipeline_illustration
keep-together: true
:::

## Budget composition

::: chart
id: budget_by_area
type: pie
title: Approved budget by delivery area
dataset: delivery_areas
source: portfolio_snapshot
category: area
value: budget
category-label: Delivery area
value-label: Approved budget
format: currency
:::

## Assumptions

This is synthetic test material. It is designed to exercise prose, metrics, Chart.js visuals, semantic tables, a code block, an embedded SVG figure, sources, and safe print configuration without presenting any real operational claim.
