import * as esbuild from "esbuild";
import { mkdir } from "node:fs/promises";

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");
const shared = {
  bundle: true,
  sourcemap: !production,
  minify: production,
  logLevel: "info"
};

await mkdir("dist/node", { recursive: true });
await mkdir("dist/web", { recursive: true });
await mkdir("dist/test", { recursive: true });

const builds = [
  {
    ...shared,
    entryPoints: ["src/extension.ts"],
    outfile: "dist/node/extension.cjs",
    format: "cjs",
    platform: "node",
    external: ["vscode"]
  },
  {
    ...shared,
    entryPoints: ["src/webview/main.ts"],
    outfile: "dist/web/webview.js",
    format: "iife",
    platform: "browser"
  },
  {
    ...shared,
    entryPoints: [
      "test/source.test.ts",
      "test/format.test.ts",
      "test/compiler.integration.test.ts"
    ],
    outdir: "dist/test",
    entryNames: "[name]",
    outExtension: { ".js": ".cjs" },
    format: "cjs",
    platform: "node"
  },
  {
    ...shared,
    entryPoints: ["test/extension-host/index.ts"],
    outfile: "dist/extension-test/index.cjs",
    format: "cjs",
    platform: "node",
    external: ["vscode"]
  }
];

if (watch) {
  const contexts = await Promise.all(builds.map((options) => esbuild.context(options)));
  await Promise.all(contexts.map((context) => context.watch()));
  console.log("Watching extension, preview webview, and tests.");
} else {
  await Promise.all(builds.map((options) => esbuild.build(options)));
}
