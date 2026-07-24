import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve(import.meta.dirname, "..");
const artifactPath = resolve(root, ".work", "preview-artifact.json");
await mkdir(resolve(root, ".work"), { recursive: true });

const compile = process.platform === "win32"
  ? spawnSync("py", [
      "-3",
      resolve(root, "runtime", "compiler", "compile_report.py"),
      "--input",
      resolve(root, "examples", "feature-tour", "report.report.md"),
      "--output",
      artifactPath
    ], {
      encoding: "utf8",
      windowsHide: true,
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" }
    })
  : spawnSync("python3", [
      resolve(root, "runtime", "compiler", "compile_report.py"),
      "--input",
      resolve(root, "examples", "feature-tour", "report.report.md"),
      "--output",
      artifactPath
    ], {
      encoding: "utf8",
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" }
    });
if (compile.status !== 0) throw new Error(compile.stderr || compile.stdout || "Fixture compilation failed.");

const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
const webviewScript = await readFile(resolve(root, "dist", "web", "webview.js"));
const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body><main id="app"><div class="preview-state">Compiling report preview…</div></main><script src="/webview.js"></script></body>
</html>`;
const server = createServer((request, response) => {
  if (request.url === "/webview.js") {
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
    response.end(webviewScript);
    return;
  }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html);
});
await new Promise((resolveServer) => server.listen(0, "127.0.0.1", resolveServer));
const address = server.address();
if (!address || typeof address === "string") throw new Error("Smoke server did not bind to a TCP port.");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 1 });
  const consoleProblems = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") consoleProblems.push(message.text());
  });
  page.on("pageerror", (error) => consoleProblems.push(error.message));
  await page.addInitScript(() => {
    window.__messages = [];
    window.acquireVsCodeApi = () => ({
      postMessage: (message) => window.__messages.push(message),
      getState: () => undefined,
      setState: (state) => { window.__previewState = state; }
    });
  });
  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "networkidle" });
  await page.evaluate((previewArtifact) => {
    window.dispatchEvent(new MessageEvent("message", {
      data: {
        type: "render",
        artifact: previewArtifact,
        documentLabel: "examples/feature-tour/report.report.md",
        preserveScroll: false,
        compiledAt: "2026-07-24T12:01:00-06:00"
      }
    }));
  }, artifact);
  await page.locator(".report-page").waitFor();
  await page.locator(".chart-card canvas").first().waitFor();
  await page.waitForTimeout(250);

  const checks = await page.evaluate(() => ({
    cards: document.querySelectorAll(".metric-card").length,
    charts: document.querySelectorAll(".chart-card").length,
    tables: document.querySelectorAll(".table-card").length,
    figures: document.querySelectorAll(".figure-card img").length,
    title: document.querySelector(".report-markdown h1")?.textContent,
    horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth
  }));
  if (checks.cards !== 4 || checks.charts !== 2 || checks.tables !== 1 || checks.figures !== 1) {
    throw new Error(`Preview fixture rendered unexpected components: ${JSON.stringify(checks)}`);
  }
  if (checks.title !== "Northwind Delivery Review") throw new Error(`Unexpected preview title: ${checks.title}`);
  if (checks.horizontalOverflow > 1) throw new Error(`Preview has ${checks.horizontalOverflow}px horizontal overflow.`);
  if (consoleProblems.length) throw new Error(`Preview console problems:\n${consoleProblems.join("\n")}`);

  await mkdir(resolve(root, "images"), { recursive: true });
  await mkdir(resolve(root, "artifacts", "runtime"), { recursive: true });
  await page.screenshot({ path: resolve(root, "images", "report-preview.png") });
  await page.screenshot({ path: resolve(root, "artifacts", "runtime", "report-preview.png") });
  console.log("Webview smoke passed: metrics, Chart.js visuals, semantic table, figure, and responsive width.");
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
