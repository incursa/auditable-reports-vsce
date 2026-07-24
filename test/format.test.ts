import assert from "node:assert/strict";
import test from "node:test";

import { formatReportValue } from "../src/format";

test("formats constrained report values consistently", () => {
  assert.equal(formatReportValue(1200, "currency"), "$1,200");
  assert.equal(formatReportValue(0.625, "percent"), "62.5%");
  assert.equal(formatReportValue(7, "number", true), "+7");
  assert.equal(formatReportValue(null, "number"), "—");
});

test("preserves non-numeric text without coercion", () => {
  assert.equal(formatReportValue("At risk", "text"), "At risk");
  assert.equal(formatReportValue("2026-08-08", "date"), "Aug 8, 2026");
});
