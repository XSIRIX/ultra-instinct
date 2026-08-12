import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertScenarioSet, EVAL_CLIENTS, EVAL_PROFILES } from "./contracts.mjs";
import { gradeTrace } from "./grade.mjs";

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function flagValue(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1 || !args[index + 1] || args[index + 1].startsWith("--")) return null;
  return args[index + 1];
}

export function parseArgs(args) {
  const client = flagValue(args, "--client") ?? "all";
  const profile = flagValue(args, "--profile") ?? "guided";
  const repeat = Number.parseInt(flagValue(args, "--repeat") ?? "1", 10);
  const label = flagValue(args, "--label") ?? "local";
  if (client !== "all" && !EVAL_CLIENTS.includes(client)) throw new Error(`Unsupported client: ${client}`);
  if (!EVAL_PROFILES.includes(profile)) throw new Error(`Unsupported profile: ${profile}`);
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > 20) throw new Error("--repeat must be between 1 and 20.");
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(label)) throw new Error("--label must be filesystem-safe.");
  return {
    clients: client === "all" ? [...EVAL_CLIENTS] : [client],
    profile,
    repeat,
    label,
    modelsFrom: flagValue(args, "--models-from"),
    model: flagValue(args, "--model"),
    dryRun: args.includes("--dry-run"),
    allowClientState: args.includes("--allow-client-state"),
  };
}

export function assertLivePermission(options) {
  if (options.dryRun) return;
  if (!options.allowClientState && options.clients.some((client) => client === "codex" || client === "opencode")) {
    throw new Error("Codex/OpenCode live runs may update client trust or session state. Re-run with --allow-client-state.");
  }
}

export function createRunPlan(options, scenarios, root = pluginRoot) {
  const selected = assertScenarioSet(scenarios).filter(({ profiles }) => profiles.includes(options.profile));
  return options.clients.flatMap((client) => selected.flatMap((scenario) =>
    Array.from({ length: options.repeat }, (_, index) => ({
      client,
      profile: options.profile,
      scenario,
      repeat: index + 1,
      resultDirectory: path.join(root, ".ultra-instinct/evals", options.label, client, options.profile),
    })),
  ));
}

async function createFixture(fixture) {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "ultra-instinct-eval-"));
  const files = fixture === "typo"
    ? { "README.md": "Please recieve this tiny example.\n" }
    : {
        "package.json": `${JSON.stringify({ type: "module", scripts: { test: "node --test" } }, null, 2)}\n`,
        "index.js": fixture === "failing-test"
          ? "export function add(a, b) { return a - b; }\n"
          : "export function add(a, b) { return a + b; }\n",
        "index.test.js": [
          "import assert from 'node:assert/strict';",
          "import test from 'node:test';",
          "import { add } from './index.js';",
          "test('add', () => assert.equal(add(2, 3), 5));",
          "",
        ].join("\n"),
      };
  await Promise.all(Object.entries(files).map(([name, content]) => writeFile(path.join(workspace, name), content)));
  return workspace;
}

async function loadModels(label) {
  const models = {};
  for (const client of EVAL_CLIENTS) {
    for (const profile of EVAL_PROFILES) {
      const file = path.join(pluginRoot, ".ultra-instinct/evals", label, client, profile, "summary.json");
      try {
        const summary = JSON.parse(await readFile(file, "utf8"));
        const model = summary.grades?.find((grade) => grade.model)?.model;
        if (model) models[client] = model;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
  }
  return models;
}

async function driverFor(client) {
  return import(`./clients/${client}.mjs`);
}

async function writeSummaries(grades, options) {
  for (const client of options.clients) {
    const selected = grades.filter((grade) => grade.client === client);
    const directory = path.join(pluginRoot, ".ultra-instinct/evals", options.label, client, options.profile);
    const summary = {
      schema: "ultra.eval-summary.v1",
      label: options.label,
      client,
      profile: options.profile,
      generatedAt: new Date().toISOString(),
      grades: selected,
    };
    const passed = selected.filter((grade) => grade.passed).length;
    const markdown = [
      `# ${options.label}: ${client}/${options.profile}`,
      "",
      `- Passed: ${passed}/${selected.length}`,
      `- Model: ${selected.find((grade) => grade.model)?.model ?? "unknown"}`,
      `- Client: ${selected.find((grade) => grade.version)?.version ?? "unknown"}`,
      "",
      "## Failures",
      "",
      ...selected.filter((grade) => !grade.passed).map((grade) =>
        `- ${grade.scenarioId} run ${grade.repeat}: ${grade.failureSignatures.join(", ")}`),
      ...(selected.every((grade) => grade.passed) ? ["- None"] : []),
      "",
    ].join("\n");
    await writeFile(path.join(directory, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
    await writeFile(path.join(directory, "summary.md"), markdown, { mode: 0o600 });
  }
}

export async function runEval(options) {
  assertLivePermission(options);
  const scenarios = JSON.parse(await readFile(path.join(pluginRoot, "evals/scenarios.json"), "utf8"));
  const plan = createRunPlan(options, scenarios);
  if (options.dryRun) return { plan, grades: [] };
  const inheritedModels = options.modelsFrom ? await loadModels(options.modelsFrom) : {};
  if (options.modelsFrom) {
    const missing = options.clients.filter((client) => !inheritedModels[client]);
    if (missing.length) throw new Error(`No recorded model in ${options.modelsFrom} for: ${missing.join(", ")}`);
  }
  const grades = [];
  for (const item of plan) {
    await mkdir(item.resultDirectory, { recursive: true, mode: 0o700 });
    const workspace = await createFixture(item.scenario.fixture);
    try {
      const { runScenario } = await driverFor(item.client);
      const trace = await runScenario({
        scenario: item.scenario,
        profile: item.profile,
        pluginRoot,
        workspace,
        model: options.model ?? inheritedModels[item.client] ?? null,
      });
      const metadata = trace.find((event) => event.type === "client") ?? {};
      if (!metadata.model) throw new Error(`${item.client} did not report its exact active model slug.`);
      const grade = {
        ...gradeTrace(item.scenario, trace),
        client: item.client,
        profile: item.profile,
        repeat: item.repeat,
        model: metadata.model,
        version: metadata.version ?? "unknown",
        os: metadata.os ?? `${os.platform()}-${os.arch()}`,
      };
      const filename = `trace-${item.scenario.id}-${String(item.repeat).padStart(2, "0")}.json`;
      await writeFile(path.join(item.resultDirectory, filename), `${JSON.stringify({ trace, grade }, null, 2)}\n`, { mode: 0o600 });
      grades.push(grade);
      console.log(`${grade.passed ? "PASS" : "FAIL"} ${item.client}/${item.profile}/${item.scenario.id} #${item.repeat}`);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }
  await writeSummaries(grades, options);
  return { plan, grades };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const result = await runEval(options);
  if (options.dryRun) {
    console.log(JSON.stringify({
      runs: result.plan.length,
      clients: options.clients,
      profile: options.profile,
      repeat: options.repeat,
      scenarios: [...new Set(result.plan.map((item) => item.scenario.id))],
    }, null, 2));
  } else if (result.grades.some((grade) => !grade.passed)) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Evaluation failed.");
    process.exitCode = 1;
  });
}
