import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function safeLabel(value) {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(value ?? "")) throw new Error("Evaluation labels must be filesystem-safe.");
  return value;
}

function flagValue(args, flag) {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1];
}

async function loadSummary(label, client, profile) {
  try {
    return JSON.parse(await readFile(
      path.join(root, "evals/results", label, client, profile, "summary.json"),
      "utf8",
    ));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function buildReport(labels) {
  const summaries = [];
  for (const label of labels) {
    safeLabel(label);
    for (const client of ["claude", "codex", "opencode"]) {
      for (const profile of ["lite", "guided", "strict"]) {
        const summary = await loadSummary(label, client, profile);
        if (summary) summaries.push(summary);
      }
    }
  }
  const grades = summaries.flatMap((summary) => summary.grades);
  const failures = grades.filter((grade) => !grade.passed);
  return {
    schema: "ultra.eval-report.v1",
    generatedAt: new Date().toISOString(),
    labels,
    totalRuns: grades.length,
    passedRuns: grades.length - failures.length,
    clients: [...new Set(grades.map((grade) => `${grade.client} ${grade.version}`))],
    models: [...new Set(grades.map((grade) => `${grade.client}: ${grade.model}`))],
    operatingSystems: [...new Set(grades.map((grade) => grade.os))],
    failureSignatures: failures.flatMap((grade) => grade.failureSignatures.map((signature) => ({
      label: summaries.find((summary) => summary.grades.includes(grade))?.label,
      client: grade.client,
      profile: grade.profile,
      scenario: grade.scenarioId,
      signature,
    }))),
  };
}

function markdown(report) {
  return [
    "# Ultra Instinct cross-client evaluation",
    "",
    `- Runs: ${report.passedRuns}/${report.totalRuns} passed`,
    `- Labels: ${report.labels.join(", ")}`,
    `- Clients: ${report.clients.join(", ") || "none"}`,
    `- Models: ${report.models.join(", ") || "none"}`,
    `- OS: ${report.operatingSystems.join(", ") || "unknown"}`,
    "",
    "## Failure signatures",
    "",
    ...(report.failureSignatures.length
      ? report.failureSignatures.map((failure) =>
          `- ${failure.label}/${failure.client}/${failure.profile}/${failure.scenario}: ${failure.signature}`)
      : ["- None"]),
    "",
  ].join("\n");
}

async function main() {
  const labels = (flagValue(process.argv.slice(2), "--runs") ?? "").split(",").filter(Boolean);
  if (!labels.length) throw new Error("Use --runs <label,label>.");
  const report = await buildReport(labels);
  const directory = path.join(root, "evals/results", "reports");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const name = labels.join("-");
  await writeFile(path.join(directory, `${name}.json`), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  await writeFile(path.join(directory, `${name}.md`), markdown(report), { mode: 0o600 });
  console.log(markdown(report));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Report failed.");
    process.exitCode = 1;
  });
}
