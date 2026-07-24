import * as assert from "node:assert/strict";
import * as vscode from "vscode";

export async function run(): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  assert.ok(workspace, "Feature-tour workspace was not opened.");
  const uri = vscode.Uri.joinPath(workspace.uri, "report.report.md");
  const document = await vscode.workspace.openTextDocument(uri);
  assert.equal(document.languageId, "auditable-report", "*.report.md was not associated with Report Markdown.");
  assert.match(document.getText(), /# Northwind Delivery Review/);
  await vscode.window.showTextDocument(document, { preview: false });

  const extension = vscode.extensions.getExtension("incursa.auditable-reports-vsce");
  assert.ok(extension, "Development extension was not discovered.");
  await extension.activate();
  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes("auditableReports.openPreviewToSide"), "Preview command was not registered.");
  assert.ok(commands.includes("auditableReports.refreshPreview"), "Refresh command was not registered.");

  await vscode.commands.executeCommand("auditableReports.openPreviewToSide", uri);
  const deadline = Date.now() + 15_000;
  let previewCompiled = false;
  while (Date.now() < deadline) {
    previewCompiled = vscode.window.tabGroups.all.some((group) =>
      group.tabs.some((tab) => tab.label === "Preview: Northwind Delivery Review")
    );
    if (previewCompiled) break;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  assert.ok(previewCompiled, "The bundled compiler did not produce the feature-tour preview.");

  console.log("Extension host passed: installed compiler path produced a live Report Markdown preview.");
}
