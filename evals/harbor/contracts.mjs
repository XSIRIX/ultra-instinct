import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifestDirectory = path.join(root, "evals/harbor/manifests");
const allowedExperiments = new Set(["smoke", "pilot", "full"]);
const allowedReasoning = new Set(["low", "medium", "high", "xhigh"]);
const allowedEnvironments = new Set(["docker", "daytona"]);
const conditionImports = new Map([
  ["codex-vanilla", "evals.harbor.agents.codex_ab:CodexVanilla"],
  ["codex-ultra-guided", "evals.harbor.agents.codex_ab:CodexUltraGuided"],
]);

function assertClosedObject(value, allowedKeys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unknown.length) throw new Error(`${label} has unknown fields: ${unknown.join(", ")}.`);
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function validateTaskNames(taskNames, expectedTaskCount, name) {
  if (taskNames === null) {
    if (name !== "full") throw new Error("Only the full experiment may select the whole dataset.");
    return;
  }
  if (!Array.isArray(taskNames) || taskNames.length !== expectedTaskCount) {
    throw new Error(`${name} taskNames must contain ${expectedTaskCount} tasks.`);
  }
  if (new Set(taskNames).size !== taskNames.length) throw new Error(`${name} taskNames must be unique.`);
  if (taskNames.some((task) => !/^[a-z0-9][a-z0-9-]*$/.test(task))) {
    throw new Error(`${name} contains an invalid task name.`);
  }
  const sorted = [...taskNames].sort();
  if (taskNames.some((task, index) => task !== sorted[index])) {
    throw new Error(`${name} taskNames must be sorted.`);
  }
}

function validateStrata(manifest) {
  if (manifest.taskNames === null) {
    if (manifest.taskStrata !== null) throw new Error("Full taskStrata must be null.");
    return;
  }
  assertClosedObject(manifest.taskStrata, new Set(["software", "neutral"]), "taskStrata");
  const flattened = [...manifest.taskStrata.software, ...manifest.taskStrata.neutral].sort();
  if (flattened.length !== manifest.taskNames.length
      || flattened.some((task, index) => task !== manifest.taskNames[index])) {
    throw new Error("taskStrata must partition taskNames exactly.");
  }
  if (manifest.name === "pilot"
      && (manifest.taskStrata.software.length !== 10 || manifest.taskStrata.neutral.length !== 5)) {
    throw new Error("Pilot taskStrata must contain ten software and five neutral tasks.");
  }
}

export function validateExperimentManifest(manifest) {
  assertClosedObject(manifest, new Set([
    "schemaVersion", "name", "harborVersion", "sourceCommit", "dataset", "conditions",
    "attempts", "expectedTaskCount", "expectedTrials", "taskNames", "taskStrata", "bootstrap",
  ]), "experiment manifest");
  if (manifest.schemaVersion !== 1) throw new Error("Unsupported experiment manifest version.");
  if (!allowedExperiments.has(manifest.name)) throw new Error("Unknown experiment name.");
  if (manifest.harborVersion !== "0.16.1") throw new Error("Harbor must be pinned to 0.16.1.");
  if (!/^[a-f0-9]{40}$/.test(manifest.sourceCommit)) throw new Error("sourceCommit must be a full Git SHA.");
  assertClosedObject(manifest.dataset, new Set(["name", "ref"]), "dataset");
  if (manifest.dataset.name !== "terminal-bench/terminal-bench-2-1" || manifest.dataset.ref !== "6") {
    throw new Error("Terminal-Bench must be pinned to revision 6.");
  }
  if (JSON.stringify(manifest.conditions) !== JSON.stringify([...conditionImports.keys()])) {
    throw new Error("Experiment conditions must be vanilla then guided.");
  }
  if (!Number.isSafeInteger(manifest.attempts) || manifest.attempts < 1) {
    throw new Error("attempts must be a positive integer.");
  }
  if (!Number.isSafeInteger(manifest.expectedTaskCount) || manifest.expectedTaskCount < 1) {
    throw new Error("expectedTaskCount must be a positive integer.");
  }
  if (manifest.expectedTrials !== manifest.expectedTaskCount * manifest.attempts * manifest.conditions.length) {
    throw new Error("expectedTrials does not match the experiment grid.");
  }
  validateTaskNames(manifest.taskNames, manifest.expectedTaskCount, manifest.name);
  validateStrata(manifest);
  assertClosedObject(manifest.bootstrap, new Set(["seed", "iterations"]), "bootstrap");
  if (!Number.isSafeInteger(manifest.bootstrap.seed)
      || !Number.isSafeInteger(manifest.bootstrap.iterations)
      || manifest.bootstrap.iterations !== 10_000) {
    throw new Error("bootstrap must contain a safe seed and 10000 iterations.");
  }
  return deepFreeze(structuredClone(manifest));
}

export async function loadExperimentManifest(nameOrPath) {
  const file = allowedExperiments.has(nameOrPath)
    ? path.join(manifestDirectory, `${nameOrPath}.json`)
    : path.resolve(nameOrPath);
  return validateExperimentManifest(JSON.parse(await readFile(file, "utf8")));
}

function validateRunOptions(options) {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(options.label ?? "")) {
    throw new Error("Run label must be filesystem-safe.");
  }
  if (!/^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i.test(options.model ?? "")
      || /(?:^|\/|[-_.])(latest|default)(?:$|[-_.])|[*\s]/i.test(options.model)) {
    throw new Error("Provide an exact model as provider/model; floating aliases are not allowed.");
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(options.codexVersion ?? "")) {
    throw new Error("Codex version must be an exact semantic version.");
  }
  if (!allowedReasoning.has(options.reasoning)) throw new Error("Unsupported reasoning effort.");
  if (!allowedEnvironments.has(options.environment)) throw new Error("Unsupported environment.");
  if (!Number.isSafeInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 32) {
    throw new Error("Concurrency must be an integer from 1 through 32.");
  }
  if (!options.outputDirectory || !path.isAbsolute(options.outputDirectory)) {
    throw new Error("outputDirectory must be absolute.");
  }
  if (Number.isNaN(Date.parse(options.createdAt))) throw new Error("createdAt must be an ISO timestamp.");
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function createRunFiles(options) {
  const manifest = validateExperimentManifest(options.manifest);
  validateRunOptions(options);

  const sharedAgent = {
    model_name: options.model,
    n_concurrent: options.concurrency,
    concurrency_group: "ultra-codex-ab",
    kwargs: {
      version: options.codexVersion,
      reasoning_effort: options.reasoning,
      web_search: "disabled",
      source_commit: manifest.sourceCommit,
    },
    env: {
      OPENAI_API_KEY: "${OPENAI_API_KEY}",
      ULTRA_INSTINCT_PROFILE: "guided",
      ULTRA_INSTINCT_STATE_DIR: "/tmp/ultra-instinct-state",
    },
  };
  const dataset = { name: manifest.dataset.name, ref: manifest.dataset.ref };
  if (manifest.taskNames !== null) dataset.task_names = [...manifest.taskNames];

  const job = {
    job_name: `ultra-${manifest.name}-${options.label}`,
    jobs_dir: path.join(options.outputDirectory, "harbor-jobs"),
    n_attempts: manifest.attempts,
    n_concurrent_trials: options.concurrency,
    environment: { type: options.environment, delete: true },
    agents: manifest.conditions.map((condition) => ({
      import_path: conditionImports.get(condition),
      ...structuredClone(sharedAgent),
    })),
    datasets: [dataset],
  };
  const jobSha256 = createHash("sha256").update(stableJson(job)).digest("hex");
  const runManifest = {
    schemaVersion: 1,
    label: options.label,
    experiment: manifest.name,
    createdAt: new Date(options.createdAt).toISOString(),
    harborVersion: manifest.harborVersion,
    sourceCommit: manifest.sourceCommit,
    dataset: structuredClone(manifest.dataset),
    conditions: [...manifest.conditions],
    attempts: manifest.attempts,
    expectedTaskCount: manifest.expectedTaskCount,
    expectedTrials: manifest.expectedTrials,
    taskNames: manifest.taskNames === null ? null : [...manifest.taskNames],
    taskStrata: structuredClone(manifest.taskStrata),
    bootstrap: structuredClone(manifest.bootstrap),
    model: options.model,
    codexVersion: options.codexVersion,
    reasoning: options.reasoning,
    environment: options.environment,
    concurrency: options.concurrency,
    jobSha256,
  };
  return { job, runManifest };
}

export async function prepareRun(options) {
  const { job, runManifest } = createRunFiles(options);
  await mkdir(path.dirname(options.outputDirectory), { recursive: true, mode: 0o700 });
  try {
    await mkdir(options.outputDirectory, { mode: 0o700 });
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error(`Run output already exists: ${options.outputDirectory}`);
    throw error;
  }
  await Promise.all([
    writeFile(path.join(options.outputDirectory, "job.json"), stableJson(job), { mode: 0o600 }),
    writeFile(
      path.join(options.outputDirectory, "run-manifest.json"),
      stableJson(runManifest),
      { mode: 0o600 },
    ),
  ]);
  return { outputDirectory: options.outputDirectory, job, runManifest };
}

export const harborRoot = root;
