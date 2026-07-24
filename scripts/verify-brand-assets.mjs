import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const expected = new Map([
  ["images/icon.png", [256, 256]],
  ["images/icon-128.png", [128, 128]],
  ["images/icon-64.png", [64, 64]],
  ["images/icon-32.png", [32, 32]],
  ["images/icon-16.png", [16, 16]],
  ["images/auditable-reports-readme-banner.png", [960, 220]],
  ["images/report-preview.png", [1440, 1200]],
  ["artifacts/brand/auditable-reports-brand-sheet.png", [1200, 720]]
]);

for (const [relativePath, [width, height]] of expected) {
  const bytes = await readFile(resolve(root, relativePath));
  if (!bytes.subarray(0, 8).equals(signature)) throw new Error(`${relativePath} is not a PNG.`);
  if (bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height) {
    throw new Error(`${relativePath} must be ${width}x${height}.`);
  }
}

const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (packageJson.icon !== "images/icon.png") throw new Error("Marketplace icon declaration is missing.");
const activityMark = await readFile(resolve(root, "resources/auditable-reports.svg"), "utf8");
if (!activityMark.includes('stroke="currentColor"') || /#[0-9a-f]{3,8}/i.test(activityMark)) {
  throw new Error("Activity mark must be monochrome and theme-aware.");
}
const readme = await readFile(resolve(root, "README.md"), "utf8");
for (const reference of [
  "images/auditable-reports-readme-banner.png",
  "images/report-preview.png"
]) {
  if (!readme.includes(reference)) throw new Error(`README must reference ${reference}.`);
}
console.log(`Brand assets verified: ${expected.size} PNGs and a theme-aware activity mark.`);
