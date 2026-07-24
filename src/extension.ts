import * as vscode from "vscode";
import { resolve } from "node:path";

import { compileReport, CompileFailure } from "./compiler";
import type { PreviewMessage } from "./model";
import { diagnosticLine, looksLikeReportMarkdown, reportDependencies } from "./source";

const PREVIEW_COMMAND = "auditableReports.openPreviewToSide";
const REFRESH_COMMAND = "auditableReports.refreshPreview";
const OUTPUT_COMMAND = "auditableReports.showOutput";
const PREVIEW_VIEW_TYPE = "auditableReports.preview";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Auditable Reports");
  const diagnostics = vscode.languages.createDiagnosticCollection("auditable-reports");
  const manager = new PreviewManager(context, output, diagnostics);

  context.subscriptions.push(
    output,
    diagnostics,
    manager,
    vscode.commands.registerCommand(PREVIEW_COMMAND, (uri?: vscode.Uri) => manager.open(uri)),
    vscode.commands.registerCommand(REFRESH_COMMAND, () => manager.refreshActive()),
    vscode.commands.registerCommand(OUTPUT_COMMAND, () => output.show(true))
  );
}

export function deactivate(): void {}

class PreviewManager implements vscode.Disposable {
  private readonly sessions = new Map<string, PreviewSession>();

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly output: vscode.OutputChannel,
    private readonly diagnostics: vscode.DiagnosticCollection
  ) {}

  public async open(requestedUri?: vscode.Uri): Promise<void> {
    const editor = requestedUri
      ? await vscode.window.showTextDocument(requestedUri, { preview: false })
      : vscode.window.activeTextEditor;
    const document = editor?.document;
    if (!document) {
      void vscode.window.showInformationMessage("Open a Report Markdown file before opening its preview.");
      return;
    }
    if (document.uri.scheme !== "file") {
      void vscode.window.showErrorMessage("Auditable Reports preview currently requires a saved local file.");
      return;
    }
    if (!looksLikeReportMarkdown(document.getText())) {
      void vscode.window.showErrorMessage(
        "This file does not have Report Markdown front matter with generated-at, status, and data or evidence."
      );
      return;
    }
    if (!vscode.workspace.isTrusted) {
      void vscode.window.showWarningMessage(
        "Trust this workspace to run the bundled Report Markdown compiler and open the live preview."
      );
      return;
    }

    const key = document.uri.toString();
    const existing = this.sessions.get(key);
    if (existing) {
      existing.reveal();
      await existing.refresh();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      PREVIEW_VIEW_TYPE,
      `Preview: ${document.uri.path.split("/").pop()}`,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "dist")]
      }
    );
    const session = new PreviewSession(this.context, document, panel, this.output, this.diagnostics, () => {
      this.sessions.delete(key);
      void vscode.commands.executeCommand("setContext", "auditableReports.previewVisible", this.sessions.size > 0);
    });
    this.sessions.set(key, session);
    void vscode.commands.executeCommand("setContext", "auditableReports.previewVisible", true);
    await session.refresh();
  }

  public async refreshActive(): Promise<void> {
    const active = vscode.window.activeTextEditor?.document.uri.toString();
    const session = active ? this.sessions.get(active) : undefined;
    const fallback = session ?? [...this.sessions.values()].at(-1);
    if (fallback) await fallback.refresh();
  }

  public dispose(): void {
    for (const session of this.sessions.values()) session.dispose();
    this.sessions.clear();
  }
}

class PreviewSession implements vscode.Disposable {
  private readonly subscriptions: vscode.Disposable[] = [];
  private readonly dependencies = new Set<string>();
  private debounceTimer: NodeJS.Timeout | undefined;
  private revision = 0;
  private abortController: AbortController | undefined;
  private disposed = false;

  public constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly document: vscode.TextDocument,
    private readonly panel: vscode.WebviewPanel,
    private readonly output: vscode.OutputChannel,
    private readonly diagnostics: vscode.DiagnosticCollection,
    private readonly onDispose: () => void
  ) {
    this.panel.webview.html = webviewShell(this.panel.webview, this.context.extensionUri);
    this.updateDependencies();
    this.subscriptions.push(
      this.panel,
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.uri.toString() !== this.document.uri.toString()) return;
        this.updateDependencies();
        this.schedule();
      }),
      vscode.workspace.onDidSaveTextDocument((saved) => {
        if (this.dependencies.has(saved.uri.fsPath.toLowerCase())) this.schedule(50);
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("auditableReports", this.document.uri)) this.schedule(50);
      }),
      this.panel.webview.onDidReceiveMessage((message: { type?: string }) => {
        if (message.type === "ready") void this.refresh();
        if (message.type === "showOutput") this.output.show(true);
      }),
      this.panel.onDidDispose(() => {
        this.disposed = true;
        this.abortController?.abort();
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.diagnostics.delete(this.document.uri);
        this.subscriptions.splice(0).forEach((subscription) => {
          if (subscription !== this.panel) subscription.dispose();
        });
        this.onDispose();
      })
    );
  }

  public reveal(): void {
    this.panel.reveal(vscode.ViewColumn.Beside, true);
  }

  public schedule(delay?: number): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    const configured = vscode.workspace
      .getConfiguration("auditableReports.preview", this.document.uri)
      .get<number>("debounceMs", 350);
    this.debounceTimer = setTimeout(() => void this.refresh(), delay ?? configured);
  }

  public async refresh(): Promise<void> {
    if (this.disposed) return;
    const revision = ++this.revision;
    this.abortController?.abort();
    this.abortController = new AbortController();
    await this.panel.webview.postMessage({ type: "compiling" });
    const started = Date.now();
    try {
      const artifact = await compileReport(
        this.document.uri.fsPath,
        {
          compilerPath: this.context.asAbsolutePath(resolve("runtime", "compiler", "compile_report.py")),
          pythonPath: vscode.workspace
            .getConfiguration("auditableReports", this.document.uri)
            .get<string>("pythonPath", "")
            .trim() || undefined
        },
        this.abortController.signal
      );
      if (this.disposed || revision !== this.revision) return;
      const message: PreviewMessage = {
        type: "render",
        artifact,
        documentLabel: vscode.workspace.asRelativePath(this.document.uri, false),
        preserveScroll: vscode.workspace
          .getConfiguration("auditableReports.preview", this.document.uri)
          .get<boolean>("preserveScroll", true),
        compiledAt: new Date().toISOString()
      };
      this.diagnostics.delete(this.document.uri);
      this.panel.title = `Preview: ${artifact.manifest.title}`;
      await this.panel.webview.postMessage(message);
      this.output.appendLine(
        `[${new Date().toLocaleTimeString()}] Previewed ${message.documentLabel} in ${Date.now() - started} ms.`
      );
    } catch (error) {
      if (this.disposed || revision !== this.revision || this.abortController.signal.aborted) return;
      const message = error instanceof Error ? error.message : String(error);
      this.publishDiagnostic(message);
      this.output.appendLine(`[${new Date().toLocaleTimeString()}] ${this.document.uri.fsPath}`);
      this.output.appendLine(error instanceof CompileFailure ? error.output : message);
      await this.panel.webview.postMessage({ type: "error", message });
    }
  }

  private publishDiagnostic(message: string): void {
    const line = diagnosticLine(message) ?? 0;
    const safeLine = Math.max(0, Math.min(line, this.document.lineCount - 1));
    const range = this.document.lineAt(safeLine).range;
    const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
    diagnostic.source = "Auditable Reports";
    this.diagnostics.set(this.document.uri, [diagnostic]);
  }

  private updateDependencies(): void {
    this.dependencies.clear();
    for (const dependency of reportDependencies(this.document.uri.fsPath, this.document.getText())) {
      this.dependencies.add(dependency.toLowerCase());
    }
  }

  public dispose(): void {
    if (!this.disposed) this.panel.dispose();
  }
}

function webviewShell(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "web", "webview.js"));
  const nonce = createNonce();
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>Auditable Report Preview</title>
</head>
<body>
  <main id="app" aria-live="polite">
    <div class="preview-state">Compiling report preview…</div>
  </main>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function createNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = new Uint8Array(24);
  crypto.getRandomValues(values);
  return [...values].map((value) => alphabet[value % alphabet.length]).join("");
}
