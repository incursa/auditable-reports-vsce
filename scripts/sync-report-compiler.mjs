import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { basename, dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceRoot = resolve(root, "..", "auditable-reports");
const sourceDirectory = resolve(sourceRoot, "skill", "create-auditable-reports", "scripts");
const targetDirectory = resolve(root, "runtime", "compiler");
const files = ["compile_report.py", "report_config.py"];

await mkdir(targetDirectory, { recursive: true });
const entries = [];
for (const file of files) {
  const source = resolve(sourceDirectory, file);
  const target = resolve(targetDirectory, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
  const bytes = await import("node:fs/promises").then(({ readFile }) => readFile(target));
  entries.push({
    file: basename(target),
    sha256: createHash("sha256").update(bytes).digest("hex")
  });
}

let sourceCommit = "unknown";
try {
  sourceCommit = execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
} catch {
  // A source archive may not include Git metadata.
}

await writeFile(
  resolve(targetDirectory, "COMPILER-PROVENANCE.json"),
  `${JSON.stringify({
    sourceRepository: "https://github.com/incursa/auditable-reports",
    sourceCommit,
    sourcePath: "skill/create-auditable-reports/scripts",
    files: entries
  }, null, 2)}\n`,
  "utf8"
);
console.log(`Synced ${entries.length} canonical compiler files from ${sourceRoot}.`);
