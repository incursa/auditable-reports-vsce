import Chart from "chart.js/auto";
import MarkdownIt from "markdown-it";

import { formatReportValue } from "../format";
import type {
  PreviewMessage,
  ReportArtifact,
  ReportBlock,
  ReportCard,
  ReportChart,
  ReportTable
} from "../model";

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): { artifact?: ReportArtifact; documentLabel?: string } | undefined;
  setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();
const appElement = document.querySelector<HTMLElement>("#app");
if (!appElement) throw new Error("Preview root was not found.");
const app: HTMLElement = appElement;

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
});
const charts: Chart[] = [];

installStyles();
window.addEventListener("message", (event: MessageEvent) => {
  const message = event.data as { type?: string; message?: string } | PreviewMessage;
  if (message.type === "compiling") showCompiling();
  if (message.type === "error") showError(message.message ?? "Report compilation failed.");
  if (message.type === "render") renderPreview(message as PreviewMessage);
});

const saved = vscode.getState();
if (saved?.artifact) {
  renderPreview({
    type: "render",
    artifact: saved.artifact,
    documentLabel: saved.documentLabel ?? "Report Markdown",
    preserveScroll: true,
    compiledAt: new Date().toISOString()
  });
}
vscode.postMessage({ type: "ready" });

function renderPreview(message: PreviewMessage): void {
  const previousProgress = document.documentElement.scrollHeight > window.innerHeight
    ? window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)
    : 0;
  charts.splice(0).forEach((chart) => chart.destroy());
  app.replaceChildren();
  app.className = "preview-shell";

  const artifact = message.artifact;
  const toolbar = element("header", "preview-toolbar");
  const identity = element("div", "preview-identity");
  identity.append(
    element("span", "preview-product", "AUDITABLE REPORTS"),
    element("span", "preview-document", message.documentLabel)
  );
  const state = element("div", "preview-meta");
  state.append(
    pill(artifact.reportConfig?.documentType ?? "report"),
    pill(artifact.reportConfig?.orientation ?? "portrait"),
    element("span", "preview-ready", "Preview current")
  );
  toolbar.append(identity, state);

  const note = element(
    "div",
    "authority-note",
    "Editing preview · The generated Paged.js PDF remains the authoritative print edition."
  );
  const page = element("article", `report-page orientation-${artifact.reportConfig?.orientation ?? "portrait"}`);
  page.setAttribute("aria-label", `${artifact.manifest.title} report preview`);
  for (const block of artifact.manifest.blocks) {
    const rendered = renderBlock(artifact, block);
    if (!rendered) continue;
    if (block.keepTogether) rendered.classList.add("keep-together");
    if (block.breakBefore === "page") rendered.classList.add("page-break-marker");
    page.append(rendered);
  }
  if (artifact.reportConfig?.sourceDisplay !== "hidden" && artifact.manifest.sources.length > 0) {
    page.append(renderSources(artifact));
  }
  const footer = element("footer", "preview-footer");
  footer.textContent = `Compiled ${new Date(message.compiledAt).toLocaleTimeString()} · ${artifact.snapshot.status}`;
  app.append(toolbar, note, page, footer);
  vscode.setState({ artifact, documentLabel: message.documentLabel });

  requestAnimationFrame(() => {
    if (!message.preserveScroll) return;
    const available = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ top: previousProgress * available });
  });
}

function renderBlock(artifact: ReportArtifact, block: ReportBlock): HTMLElement | undefined {
  if (block.type === "markdown") {
    const section = element("section", "report-markdown");
    section.dataset.blockId = block.id;
    section.innerHTML = markdown.render(block.body ?? "");
    decorateExternalLinks(section);
    return section;
  }
  if (block.type === "metric-strip") {
    const cards = (block.cardIds ?? [])
      .map((id) => artifact.manifest.cards.find((card) => card.id === id))
      .filter((card): card is ReportCard => Boolean(card));
    return renderMetrics(artifact, cards, block.id);
  }
  if (block.type === "chart" && block.chartId) {
    const chart = artifact.manifest.charts.find((candidate) => candidate.id === block.chartId);
    return chart ? renderChart(artifact, chart) : undefined;
  }
  if (block.type === "table" && block.tableId) {
    const table = artifact.manifest.tables.find((candidate) => candidate.id === block.tableId);
    return table ? renderTable(artifact, table) : undefined;
  }
  if (block.type === "html" && block.body) return renderFigure(block);
  return undefined;
}

function renderMetrics(artifact: ReportArtifact, cards: readonly ReportCard[], blockId: string): HTMLElement {
  const section = element("section", "metric-strip");
  section.dataset.blockId = blockId;
  for (const card of cards) {
    const row = artifact.snapshot.datasets[card.dataset]?.[0] ?? {};
    const metric = card.metrics[0];
    if (!metric) continue;
    const value = row[metric.field];
    const cardElement = element("div", "metric-card");
    cardElement.append(
      element("div", "metric-label", metric.label),
      element("div", "metric-value", formatReportValue(value, metric.format, metric.signed)),
      element("div", "metric-description", card.description ?? "")
    );
    section.append(cardElement);
  }
  return section;
}

function renderChart(artifact: ReportArtifact, chart: ReportChart): HTMLElement {
  const section = element("section", "visual-card chart-card");
  section.dataset.blockId = chart.id;
  const heading = element("div", "visual-heading");
  heading.append(element("h3", "", chart.title));
  if (chart.subtitle) heading.append(element("p", "", chart.subtitle));
  const canvasShell = element("div", "chart-canvas");
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", chart.title);
  canvasShell.append(canvas);
  const rows = artifact.snapshot.datasets[chart.dataset] ?? [];
  const labels = rows.map((row) => String(row[chart.encodings.x.field] ?? "—"));
  const values = rows.map((row) => Number(row[chart.encodings.y.field] ?? 0));
  const valueFormat = chart.valueFormat ?? chart.encodings.y.format ?? "number";
  section.append(heading, canvasShell);

  const instance = new Chart(canvas, {
    type: chart.type,
    data: {
      labels,
      datasets: [
        {
          label: chart.encodings.y.label ?? chart.title,
          data: values,
          backgroundColor: chart.type === "pie"
            ? ["#4459c6", "#25a59a", "#e4a448", "#7c6fc7", "#5994c7", "#9aa5b5"]
            : values.map((value) => value < 0 ? "#c65f62" : "#4459c6"),
          borderColor: chart.type === "pie" ? "#ffffff" : "transparent",
          borderWidth: chart.type === "pie" ? 2 : 0,
          borderRadius: chart.type === "bar" ? 5 : 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      indexAxis: chart.type === "bar" ? "y" : "x",
      plugins: {
        legend: {
          display: chart.type === "pie",
          position: "bottom",
          labels: { color: "#384458", usePointStyle: true, boxWidth: 9 }
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.label ?? ""}: ${formatReportValue(context.raw, valueFormat)}`
          }
        }
      },
      scales: chart.type === "bar"
        ? {
            x: {
              beginAtZero: true,
              ticks: {
                color: "#667085",
                callback: (value) => formatReportValue(Number(value), valueFormat)
              },
              grid: { color: "#e5e9f0" }
            },
            y: {
              ticks: { color: "#384458" },
              grid: { display: false }
            }
          }
        : undefined
    }
  });
  charts.push(instance);
  return section;
}

function renderTable(artifact: ReportArtifact, table: ReportTable): HTMLElement {
  const section = element("section", `visual-card table-card table-${table.kind ?? "standard"}`);
  section.dataset.blockId = table.id;
  const heading = element("div", "visual-heading");
  heading.append(element("h3", "", table.title));
  if (table.subtitle) heading.append(element("p", "", table.subtitle));
  const scroller = element("div", "table-scroll");
  const tableElement = document.createElement("table");
  const head = tableElement.createTHead().insertRow();
  for (const column of table.columns) {
    const cell = document.createElement("th");
    cell.textContent = column.label;
    cell.dataset.role = column.role ?? "";
    head.append(cell);
  }
  const body = tableElement.createTBody();
  const rows = [...(artifact.snapshot.datasets[table.dataset] ?? [])];
  if (table.defaultSort) {
    const { field, direction } = table.defaultSort;
    rows.sort((left, right) => compare(left[field], right[field]) * (direction === "asc" ? 1 : -1));
  }
  for (const row of rows) {
    const tr = body.insertRow();
    for (const column of table.columns) {
      const cell = tr.insertCell();
      cell.dataset.role = column.role ?? "";
      cell.textContent = formatReportValue(
        row[column.field],
        column.format ?? column.type ?? "text"
      );
      const movementValue = row[column.field];
      if (column.movement && typeof movementValue === "number") {
        cell.dataset.movement = movementValue > 0 ? "up" : movementValue < 0 ? "down" : "flat";
      }
    }
  }
  scroller.append(tableElement);
  section.append(heading, scroller);
  return section;
}

function renderFigure(block: ReportBlock): HTMLElement {
  const section = element("section", "visual-card figure-card");
  section.dataset.blockId = block.id;
  const parsed = new DOMParser().parseFromString(block.body ?? "", "text/html");
  const source = parsed.querySelector("img");
  const figure = document.createElement("figure");
  if (source?.src.startsWith("data:image/")) {
    const image = document.createElement("img");
    image.src = source.src;
    image.alt = source.alt;
    figure.append(image);
  }
  const sourceCaption = parsed.querySelector("figcaption");
  if (sourceCaption?.textContent?.trim()) {
    const caption = document.createElement("figcaption");
    caption.textContent = sourceCaption.textContent.trim();
    figure.append(caption);
  }
  section.append(figure);
  return section;
}

function renderSources(artifact: ReportArtifact): HTMLElement {
  const section = element("section", "report-sources");
  section.append(element("h2", "", "Sources"));
  const list = document.createElement("ol");
  for (const source of artifact.manifest.sources) {
    const item = document.createElement("li");
    item.append(element("strong", "", source.label));
    if (source.path) item.append(document.createTextNode(` · ${source.path}`));
    list.append(item);
  }
  section.append(list);
  return section;
}

function showCompiling(): void {
  const existing = document.querySelector(".preview-ready");
  if (existing) {
    existing.textContent = "Compiling…";
    existing.classList.add("is-busy");
    return;
  }
  app.className = "";
  app.replaceChildren(element("div", "preview-state", "Compiling report preview…"));
}

function showError(message: string): void {
  const shell = element("div", "preview-error");
  shell.append(
    element("div", "error-mark", "!"),
    element("h2", "", "The preview could not be compiled"),
    element("pre", "", message)
  );
  const button = element("button", "", "Show compiler output");
  button.addEventListener("click", () => vscode.postMessage({ type: "showOutput" }));
  shell.append(button);
  app.className = "";
  app.replaceChildren(shell);
}

function decorateExternalLinks(container: HTMLElement): void {
  for (const anchor of Array.from(container.querySelectorAll<HTMLAnchorElement>("a"))) {
    anchor.rel = "noreferrer noopener";
    anchor.target = "_blank";
  }
}

function pill(text: string): HTMLElement {
  return element("span", "preview-pill", text.replace(/-/g, " "));
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = ""
): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text) result.textContent = text;
  return result;
}

function compare(left: unknown, right: unknown): number {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left ?? "").localeCompare(String(right ?? ""), undefined, { numeric: true });
}

function installStyles(): void {
  const style = document.createElement("style");
  style.textContent = `
    :root {
      color-scheme: light dark;
      --ink: #172033;
      --muted: #667085;
      --line: #dce2ea;
      --soft: #f2f5f9;
      --paper: #ffffff;
      --indigo: #4459c6;
      --deep: #263248;
      --teal: #258f87;
      font-family: Inter, "Segoe UI", system-ui, sans-serif;
    }
    * { box-sizing: border-box; }
    html { min-width: 320px; background: var(--vscode-editor-background, #edf0f5); }
    body { margin: 0; color: var(--ink); background: #e8ecf2; }
    button { font: inherit; }
    .preview-shell { min-height: 100vh; }
    .preview-toolbar {
      position: sticky; top: 0; z-index: 5;
      display: flex; justify-content: space-between; align-items: center; gap: 20px;
      min-height: 48px; padding: 8px 18px;
      color: #f7f8fb; background: rgba(38,50,72,.97);
      border-bottom: 1px solid rgba(255,255,255,.12);
      backdrop-filter: blur(8px);
    }
    .preview-identity { display: flex; flex-direction: column; min-width: 0; }
    .preview-product { color: #d8defd; font-size: 10px; font-weight: 800; letter-spacing: .14em; }
    .preview-document { overflow: hidden; color: white; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
    .preview-meta { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; justify-content: flex-end; }
    .preview-pill {
      padding: 3px 7px; color: #dfe4ff; background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.12); border-radius: 999px;
      font-size: 10px; text-transform: capitalize;
    }
    .preview-ready { color: #8fe0d8; font-size: 11px; font-weight: 650; }
    .preview-ready.is-busy { color: #f2cf8d; }
    .authority-note {
      width: min(100% - 32px, 920px); margin: 14px auto 10px; padding: 8px 12px;
      color: #58657a; background: #f8fafc; border: 1px solid #d8dee8; border-radius: 7px;
      font-size: 11px; text-align: center;
    }
    .report-page {
      width: min(100% - 32px, 920px); min-height: 1080px; margin: 0 auto 18px; padding: 54px 58px 64px;
      background: var(--paper); border: 1px solid #d8dee8; border-radius: 3px;
      box-shadow: 0 14px 34px rgba(24,34,50,.12);
    }
    .report-page.orientation-landscape { width: min(100% - 32px, 1080px); }
    .report-markdown { margin: 0 0 22px; font-family: Charter, Cambria, Georgia, serif; font-size: 15px; line-height: 1.58; }
    .report-markdown h1, .report-markdown h2, .report-markdown h3, .visual-heading h3, .report-sources h2 {
      color: var(--ink); font-family: Inter, "Segoe UI", system-ui, sans-serif; line-height: 1.18;
    }
    .report-markdown h1 { margin: 0 0 12px; font-size: 31px; letter-spacing: -.025em; }
    .report-markdown h1::after { display: block; width: 70px; height: 4px; margin-top: 16px; content: ""; background: var(--indigo); border-radius: 4px; }
    .report-markdown h2 { margin: 29px 0 10px; font-size: 19px; letter-spacing: -.012em; }
    .report-markdown h3 { margin: 22px 0 8px; font-size: 16px; }
    .report-markdown p { margin: 0 0 12px; }
    .report-markdown a { color: #3549ae; }
    .report-markdown blockquote {
      margin: 16px 0; padding: 11px 16px; color: #384458; background: #f4f6ff;
      border-left: 4px solid var(--indigo);
    }
    .report-markdown code { padding: 1px 4px; font: 12px/1.45 "Cascadia Code", Consolas, monospace; background: #f0f2f5; border-radius: 4px; }
    .report-markdown pre { overflow: auto; padding: 14px; color: #ecf0f8; background: #20293b; border-radius: 7px; }
    .report-markdown pre code { padding: 0; color: inherit; background: transparent; }
    .report-markdown ul, .report-markdown ol { padding-left: 23px; }
    .metric-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(145px, 1fr)); gap: 10px; margin: 8px 0 22px; }
    .metric-card { min-height: 106px; padding: 14px; background: #f7f8fc; border: 1px solid var(--line); border-top: 3px solid var(--indigo); border-radius: 7px; }
    .metric-label { color: #4e5b70; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .055em; }
    .metric-value { margin-top: 5px; color: #1f2a44; font-size: 25px; font-weight: 750; letter-spacing: -.025em; }
    .metric-description { margin-top: 5px; color: var(--muted); font-size: 11px; line-height: 1.35; }
    .visual-card { margin: 8px 0 24px; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
    .visual-heading { padding: 13px 15px 9px; background: #f8f9fb; border-bottom: 1px solid var(--line); }
    .visual-heading h3 { margin: 0; font-size: 14px; }
    .visual-heading p { margin: 4px 0 0; color: var(--muted); font-size: 11px; }
    .chart-canvas { position: relative; height: 300px; padding: 16px 18px 10px; background: white; }
    .table-scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; line-height: 1.35; }
    th { padding: 9px 10px; color: #384458; background: #eef1f5; border-bottom: 1px solid #ccd4df; font-size: 10px; text-align: left; text-transform: uppercase; letter-spacing: .035em; }
    td { padding: 8px 10px; vertical-align: top; border-bottom: 1px solid #e6eaf0; }
    tbody tr:nth-child(even) { background: #fafbfc; }
    td[data-role="item"], th[data-role="item"], td[data-role="status"], th[data-role="status"] { width: 12%; }
    td[data-role="narrative"], th[data-role="narrative"], td[data-role="decision"], th[data-role="decision"], td[data-role="recommendation"], th[data-role="recommendation"] { width: 28%; }
    td[data-role="owner"], th[data-role="owner"], td[data-role="date"], th[data-role="date"], td[data-role="amount"], th[data-role="amount"] { width: 14%; }
    td[data-movement="up"] { color: #9e3f43; font-weight: 650; }
    td[data-movement="down"] { color: #18756e; font-weight: 650; }
    .figure-card { padding: 14px; background: #fbfcfd; }
    .figure-card figure { margin: 0; text-align: center; }
    .figure-card img { display: block; width: auto; max-width: 100%; max-height: 420px; margin: 0 auto; border: 1px solid var(--line); border-radius: 6px; }
    .figure-card figcaption { margin-top: 8px; color: var(--muted); font-size: 11px; }
    .report-sources { margin-top: 30px; padding-top: 15px; border-top: 1px solid var(--line); }
    .report-sources h2 { margin: 0 0 8px; font-size: 16px; }
    .report-sources ol { margin: 0; padding-left: 22px; color: var(--muted); font-size: 11px; line-height: 1.45; }
    .page-break-marker { margin-top: 44px; padding-top: 22px; border-top: 2px dashed #bdc5d1; }
    .page-break-marker::before { display: block; margin: -35px 0 14px; color: #8893a3; font: 9px Inter, sans-serif; content: "PRINT PAGE BREAK"; letter-spacing: .08em; }
    .keep-together { break-inside: avoid; }
    .preview-footer { padding: 0 20px 24px; color: #657185; font-size: 10px; text-align: center; }
    .preview-state, .preview-error {
      width: min(100% - 40px, 620px); margin: 80px auto; padding: 26px; color: var(--vscode-foreground, #1f2937);
      background: var(--vscode-editor-background, white); border: 1px solid var(--vscode-panel-border, #d8dee8); border-radius: 8px;
    }
    .preview-error { text-align: center; }
    .preview-error h2 { margin: 10px 0; font-size: 18px; }
    .preview-error pre { overflow: auto; padding: 12px; color: #79383a; background: #fff3f3; border-radius: 6px; font: 12px/1.45 "Cascadia Code", monospace; text-align: left; white-space: pre-wrap; }
    .preview-error button { padding: 7px 12px; color: var(--vscode-button-foreground, white); background: var(--vscode-button-background, #4459c6); border: 0; border-radius: 4px; cursor: pointer; }
    .error-mark { display: grid; width: 32px; height: 32px; margin: 0 auto; place-items: center; color: white; background: #b84c50; border-radius: 50%; font-weight: 800; }
    @media (max-width: 650px) {
      .preview-toolbar { align-items: flex-start; flex-direction: column; gap: 7px; }
      .preview-meta { justify-content: flex-start; }
      .report-page { width: calc(100% - 16px); padding: 32px 24px 42px; }
      .authority-note { width: calc(100% - 16px); }
      .chart-canvas { height: 260px; }
    }
  `;
  document.head.append(style);
}
