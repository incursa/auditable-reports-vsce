import { readFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const renderTasks = [
  { source: "images/auditable-reports-icon.svg", output: "images/icon.png", width: 256, height: 256 },
  { source: "images/auditable-reports-icon.svg", output: "images/icon-128.png", width: 128, height: 128 },
  { source: "images/auditable-reports-icon.svg", output: "images/icon-64.png", width: 64, height: 64 },
  { source: "images/auditable-reports-icon.svg", output: "images/icon-32.png", width: 32, height: 32 },
  { source: "images/auditable-reports-icon.svg", output: "images/icon-16.png", width: 16, height: 16 },
  { source: "images/auditable-reports-readme-banner.svg", output: "images/auditable-reports-readme-banner.png", width: 960, height: 220 },
  { source: "artifacts/brand/auditable-reports-brand-sheet.svg", output: "artifacts/brand/auditable-reports-brand-sheet.png", width: 1200, height: 720 }
];

const browser = await chromium.launch({ headless: true });
try {
  for (const task of renderTasks) {
    const sourcePath = resolve(root, task.source);
    const outputPath = resolve(root, task.output);
    await mkdir(dirname(outputPath), { recursive: true });
    const page = await browser.newPage({ viewport: { width: task.width, height: task.height } });
    let svg = await readFile(sourcePath, "utf8");
    for (const match of [...svg.matchAll(/href="([^"]+\.svg)"/g)]) {
      const reference = match[1];
      if (!reference) continue;
      const embedded = await readFile(resolve(dirname(sourcePath), reference));
      svg = svg.replace(
        match[0],
        `href="data:image/svg+xml;base64,${embedded.toString("base64")}"`
      );
    }
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    await page.setContent(
      `<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}img{display:block;width:100%;height:100%}</style><img alt="" src="${dataUrl}">`
    );
    await page.locator("img").evaluate((image) => image.complete
      ? undefined
      : new Promise((resolveImage, rejectImage) => {
        image.addEventListener("load", () => resolveImage(undefined), { once: true });
        image.addEventListener("error", () => rejectImage(new Error("SVG failed to load.")), { once: true });
      }));
    await page.screenshot({ path: outputPath, omitBackground: true });
    await page.close();
    console.log(`Rendered ${task.output} (${task.width}x${task.height})`);
  }
} finally {
  await browser.close();
}
