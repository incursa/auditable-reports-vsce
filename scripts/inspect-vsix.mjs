import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import JSZip from "jszip";

const root = resolve(import.meta.dirname, "..");
const vsixPath = resolve(root, "auditable-reports-vsce.vsix");
const bytes = await readFile(vsixPath);
const archive = await JSZip.loadAsync(bytes);
const entries = new Set(Object.keys(archive.files));

for (const expected of [
  "extension.vsixmanifest",
  "extension/package.json",
  "extension/dist/node/extension.cjs",
  "extension/runtime/compiler/compile_report.py",
  "extension/runtime/compiler/COMPILER-PROVENANCE.json",
  "extension/images/icon-128.png",
  "extension/examples/decision-brief/report.report.md"
]) {
  if (!entries.has(expected)) throw new Error(`VSIX is missing ${expected}.`);
}

for (const forbidden of [
  "extension/src/",
  "extension/test/",
  "extension/node_modules/",
  "extension/.github/"
]) {
  if ([...entries].some((entry) => entry.startsWith(forbidden))) {
    throw new Error(`VSIX contains forbidden development content beneath ${forbidden}.`);
  }
}

const packageJson = JSON.parse(
  await archive.file("extension/package.json").async("string")
);
if (packageJson.publisher !== "incursa" || packageJson.name !== "auditable-reports-vsce") {
  throw new Error("VSIX identity does not match incursa.auditable-reports-vsce.");
}

const sha256 = createHash("sha256").update(bytes).digest("hex");
await writeFile(
  `${vsixPath}.sha256`,
  `${sha256}  auditable-reports-vsce.vsix\n`,
  "utf8"
);
console.log(`VSIX verified: ${entries.size} entries, ${bytes.length} bytes, sha256 ${sha256}`);
