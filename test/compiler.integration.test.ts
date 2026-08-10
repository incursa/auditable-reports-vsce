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
  assert.deepEqual(
    artifact.manifest.charts.map((chart) => chart.type),
    ["bar", "line", "scatter", "pie"]
  );
  assert.equal(artifact.manifest.tables.length, 1);
  assert.equal(artifact.manifest.cards.length, 4);
});

test("chartless decision brief hides sources without discarding canonical evidence", async () => {
  const artifact = await compileReport(
    resolve("examples", "decision-brief", "report.report.md"),
    {
      compilerPath: resolve("runtime", "compiler", "compile_report.py")
    }
  );

  assert.equal(artifact.reportConfig?.documentType, "decision-brief");
  assert.equal(artifact.reportConfig?.sourceDisplay, "hidden");
  assert.equal(artifact.manifest.charts.length, 0);
  assert.equal(artifact.manifest.sources.length, 1);
  assert.equal(artifact.sources.length, 1);
  assert.ok(artifact.evidence);
  assert.equal(artifact.evidence?.decisions?.length, 1);
});
