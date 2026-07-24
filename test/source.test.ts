import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";

import { diagnosticLine, looksLikeReportMarkdown, reportDependencies } from "../src/source";

const report = `---
description: Test
generated-at: 2026-07-24T12:00:00-06:00
status: fixture
data: report.data.json
---
# Test

## Executive Summary

Hello.

::: figure
id: state
path: images/state.svg
alt: State
:::
`;

test("recognizes constrained Report Markdown front matter", () => {
  assert.equal(looksLikeReportMarkdown(report), true);
  assert.equal(looksLikeReportMarkdown("# Ordinary Markdown"), false);
});

test("discovers relative sidecars and figure dependencies", () => {
  const documentPath = resolve("examples", "feature-tour", "report.report.md");
  assert.deepEqual(
    reportDependencies(documentPath, report),
    [
      resolve("examples", "feature-tour", "report.data.json"),
      resolve("examples", "feature-tour", "images", "state.svg")
    ]
  );
});

test("maps compiler line numbers to zero-based editor lines", () => {
  assert.equal(diagnosticLine("line 17: expected 'key: value'"), 16);
  assert.equal(diagnosticLine("unstructured error"), undefined);
});
