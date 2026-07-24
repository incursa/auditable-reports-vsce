import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const directory = resolve(root, "runtime", "compiler");
const provenance = JSON.parse(await readFile(resolve(directory, "COMPILER-PROVENANCE.json"), "utf8"));

if (!Array.isArray(provenance.files) || provenance.files.length !== 2) {
  throw new Error("Compiler provenance must describe compile_report.py and report_config.py.");
}
for (const entry of provenance.files) {
  const bytes = await readFile(resolve(directory, entry.file));
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== entry.sha256) {
    throw new Error(`${entry.file} differs from its recorded canonical compiler hash.`);
  }
}
if (!provenance.files.some((entry) => entry.file === "compile_report.py")) {
  throw new Error("Compiler provenance is missing compile_report.py.");
}
if (!provenance.files.some((entry) => entry.file === "report_config.py")) {
  throw new Error("Compiler provenance is missing report_config.py.");
}
console.log(`Canonical compiler verified at ${String(provenance.sourceCommit).slice(0, 12)}.`);
