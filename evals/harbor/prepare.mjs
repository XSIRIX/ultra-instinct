import path from "node:path";
import { fileURLToPath } from "node:url";

import { harborRoot, loadExperimentManifest, prepareRun } from "./contracts.mjs";

function flag(args, name, fallback = null) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
}

export function parsePrepareArgs(args) {
  const experiment = flag(args, "--experiment");
  const label = flag(args, "--label");
  const model = flag(args, "--model");
  const codexVersion = flag(args, "--codex-version");
  if (!experiment || !label || !model || !codexVersion) {
    throw new Error(
      "Use --experiment <smoke|pilot|full> --label <label> --model <provider/model> --codex-version <semver>.",
    );
  }
  const concurrencyText = flag(args, "--concurrency", "1");
  if (!/^\d+$/.test(concurrencyText)) throw new Error("Concurrency must be an integer.");
  return {
    experiment,
    label,
    model,
    codexVersion,
    reasoning: flag(args, "--reasoning", "high"),
    environment: flag(args, "--environment", "docker"),
    concurrency: Number(concurrencyText),
  };
}

async function main() {
  const options = parsePrepareArgs(process.argv.slice(2));
  const manifest = await loadExperimentManifest(options.experiment);
  const outputDirectory = path.join(harborRoot, "evals/results/harbor", options.label);
  const prepared = await prepareRun({
    ...options,
    manifest,
    outputDirectory,
    createdAt: new Date().toISOString(),
  });
  process.stdout.write(`${JSON.stringify({
    job: path.join(prepared.outputDirectory, "job.json"),
    runManifest: path.join(prepared.outputDirectory, "run-manifest.json"),
    expectedTrials: prepared.runManifest.expectedTrials,
    paidRunStarted: false,
  }, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Preparation failed.");
    process.exitCode = 1;
  });
}
