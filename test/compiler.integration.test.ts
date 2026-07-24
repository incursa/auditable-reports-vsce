import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";

import { compileReport } from "../src/compiler";

test("bundled canonical compiler produces an artifact for the feature tour", async () => {
  const artifact = await compileReport(
    resolve("examples", "feature-tour", "report.report.md"),
    {
      compilerPath: resolve("runtime", "compiler", "compile_report.py")
    }
  );
  assert.equal(artifact.surface, "report");
  assert.equal(artifact.manifest.title, "Northwind Delivery Review");
  assert.equal(artifact.manifest.charts.length, 2);
  assert.equal(artifact.manifest.tables.length, 1);
  assert.equal(artifact.manifest.cards.length, 4);
});
