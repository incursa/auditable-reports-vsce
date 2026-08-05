import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  classifyPreviewTarget,
  compilerPathForExtension,
  diagnosticLine,
  looksLikeReportMarkdown,
  reportDependencies
} from "../src/source";

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

test("routes ordinary Markdown to the built-in preview", () => {
  assert.equal(classifyPreviewTarget("markdown", "notes.md", "# Notes"), "ordinary-markdown");
  assert.equal(
    classifyPreviewTarget("auditable-report", "stakeholder-report.md", "---\npagetitle: Legacy\n---\n"),
    "report"
  );
  assert.equal(classifyPreviewTarget("plaintext", "notes.txt", "Notes"), "unsupported");
});

test("locates the compiler relative to the installed extension", () => {
  const extensionPath = resolve("C:\\Program Files", "München 工具", "incursa.auditable-reports-vsce-0.1.2");
  assert.equal(
    compilerPathForExtension(extensionPath),
    resolve(extensionPath, "runtime", "compiler", "compile_report.py")
  );
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

test("command palette titles do not duplicate their category", () => {
  const manifest = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as {
    contributes: { commands: Array<{ title: string; category?: string }> };
  };
  for (const command of manifest.contributes.commands.filter((item) => item.category === "Auditable Reports")) {
    assert.equal(command.title.startsWith("Auditable Reports:"), false);
  }
});
