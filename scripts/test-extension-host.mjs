import { downloadAndUnzipVSCode, runTests } from "@vscode/test-electron";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const vscodeExecutablePath = await downloadAndUnzipVSCode("stable");

// A machine-wide Inno Setup mutex can be left active while an unrelated
// installed VS Code update is pending. The archive test runtime has no updater,
// so disable that installer-only guard in the disposable downloaded product.
if (process.platform === "win32") {
  const executableDirectory = dirname(vscodeExecutablePath);
  const versionDirectories = (await readdir(executableDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(executableDirectory, entry.name));
  const productPath = [
    resolve(executableDirectory, "resources", "app", "product.json"),
    ...versionDirectories.map((directory) => resolve(directory, "resources", "app", "product.json"))
  ].find((candidate) => existsSync(candidate));
  if (!productPath) throw new Error("Downloaded VS Code product.json was not found.");
  const product = JSON.parse(await readFile(productPath, "utf8"));
  if (product.win32VersionedUpdate) {
    product.win32VersionedUpdate = false;
    await writeFile(productPath, `${JSON.stringify(product, null, 2)}\n`, "utf8");
  }
}

await runTests({
  vscodeExecutablePath,
  extensionDevelopmentPath: root,
  extensionTestsPath: resolve(root, "dist", "extension-test", "index.cjs"),
  launchArgs: [
    "--disable-extensions",
    "--disable-workspace-trust",
    "--skip-welcome",
    "--skip-release-notes",
    resolve(root, "examples", "feature-tour")
  ]
});
