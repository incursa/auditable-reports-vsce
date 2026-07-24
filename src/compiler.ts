import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ReportArtifact } from "./model";

export interface CompilerOptions {
  readonly compilerPath: string;
  readonly pythonPath?: string;
  readonly timeoutMs?: number;
}

export class CompileFailure extends Error {
  public constructor(message: string, public readonly output: string) {
    super(message);
    this.name = "CompileFailure";
  }
}

interface PythonCommand {
  readonly executable: string;
  readonly prefixArguments: readonly string[];
}

export async function compileReport(
  inputPath: string,
  options: CompilerOptions,
  signal?: AbortSignal
): Promise<ReportArtifact> {
  const directory = await mkdtemp(join(tmpdir(), "auditable-report-preview-"));
  const outputPath = join(directory, "artifact.json");
  try {
    const commands = options.pythonPath
      ? [{ executable: options.pythonPath, prefixArguments: [] }]
      : process.platform === "win32"
        ? [
            { executable: "py", prefixArguments: ["-3"] },
            { executable: "python", prefixArguments: [] }
          ]
        : [
            { executable: "python3", prefixArguments: [] },
            { executable: "python", prefixArguments: [] }
          ];

    let lastFailure: unknown;
    for (const command of commands) {
      try {
        await runCompiler(command, options.compilerPath, inputPath, outputPath, options.timeoutMs ?? 15_000, signal);
        return JSON.parse(await readFile(outputPath, "utf8")) as ReportArtifact;
      } catch (error) {
        if (signal?.aborted) throw error;
        if (error instanceof CompileFailure && !/ENOENT|not recognized|cannot find/i.test(error.output)) throw error;
        lastFailure = error;
      }
    }
    throw lastFailure instanceof Error
      ? lastFailure
      : new CompileFailure("Python 3 could not be located.", "Install Python 3 or set auditableReports.pythonPath.");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function runCompiler(
  command: PythonCommand,
  compilerPath: string,
  inputPath: string,
  outputPath: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      command.executable,
      [...command.prefixArguments, compilerPath, "--input", inputPath, "--output", outputPath],
      {
        windowsHide: true,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    let output = "";
    const append = (chunk: Buffer) => {
      if (output.length < 1_000_000) output += chunk.toString("utf8");
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.once("error", (error) => rejectPromise(new CompileFailure(error.message, `${error.name}: ${error.message}`)));

    const timeout = setTimeout(() => {
      child.kill();
      rejectPromise(new CompileFailure(`Report compilation exceeded ${timeoutMs} ms.`, output));
    }, timeoutMs);
    const abort = () => {
      child.kill();
      rejectPromise(new CompileFailure("Report compilation was superseded by a newer edit.", output));
    };
    signal?.addEventListener("abort", abort, { once: true });
    child.once("close", (code) => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      if (code === 0) resolvePromise();
      else rejectPromise(new CompileFailure(cleanCompilerOutput(output), output));
    });
  });
}

function cleanCompilerOutput(output: string): string {
  const cleaned = output
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  const failure = cleaned.find((line) => line.startsWith("FAIL:"));
  if (failure) return failure.slice(5).trim();
  return cleaned.slice(-8).join("\n") || "Report compilation failed.";
}
