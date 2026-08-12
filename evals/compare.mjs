import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function safeLabel(value) {
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(value ?? "")) throw new Error("Evaluation labels must be filesystem-safe.");
  return value;
}

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : 0;
}

function groupBy(values, keyOf) {
  const groups = new Map();
  for (const value of values) {
    const key = keyOf(value);
    groups.set(key, [...(groups.get(key) ?? []), value]);
  }
  return groups;
}

export function summarizeGrades(grades) {
  const positives = grades.filter((grade) => grade.isPositive);
  const negatives = grades.filter((grade) => !grade.isPositive);
  return {
    runs: grades.length,
    positiveRate: rate(positives.filter((grade) => grade.routingPassed).length, positives.length),
    falsePositiveRate: rate(negatives.filter((grade) => grade.falsePositive).length, negatives.length),
    passRate: rate(grades.filter((grade) => grade.passed).length, grades.length),
  };
}

export function compareRuns(baseline, candidate) {
  const candidateKeys = new Set(candidate.map((grade) => `${grade.client}/${grade.scenarioId}`));
  const baselineKeys = new Set(baseline.map((grade) => `${grade.client}/${grade.scenarioId}`));
  const commonBaseline = baseline.filter((grade) => candidateKeys.has(`${grade.client}/${grade.scenarioId}`));
  const commonCandidate = candidate.filter((grade) => baselineKeys.has(`${grade.client}/${grade.scenarioId}`));
  const base = summarizeGrades(commonBaseline);
  const next = summarizeGrades(candidate);
  const comparableNext = summarizeGrades(commonCandidate);
  const failures = [];
  const baselineModels = new Map(groupBy(baseline, (grade) => grade.client).entries());
  const candidateModels = new Map(groupBy(candidate, (grade) => grade.client).entries());

  for (const [client, grades] of candidateModels) {
    const before = new Set((baselineModels.get(client) ?? []).map((grade) => grade.model).filter(Boolean));
    const after = new Set(grades.map((grade) => grade.model).filter(Boolean));
    if (before.size !== after.size || [...before].some((model) => !after.has(model))) {
      failures.push({ code: "model-mismatch", client });
    }
  }

  for (const [key, grades] of groupBy(candidate.filter((grade) => grade.isPositive),
    (grade) => `${grade.client}/${grade.scenarioId}`)) {
    const passed = grades.filter((grade) => grade.routingPassed).length;
    const required = Math.ceil(grades.length * 0.8);
    if (passed < required) failures.push({ code: "per-case-below-four-of-five", case: key, passed, runs: grades.length });
  }

  if (next.positiveRate < 0.9) failures.push({ code: "positive-routing-rate", actual: next.positiveRate, required: 0.9 });
  if (next.falsePositiveRate > 0.1 || next.falsePositiveRate > base.falsePositiveRate + 0.05) {
    failures.push({
      code: "false-positive-rate",
      actual: next.falsePositiveRate,
      baseline: base.falsePositiveRate,
    });
  }
  const improvement = comparableNext.positiveRate - base.positiveRate;
  if (base.positiveRate < 0.7 && improvement < 0.2) {
    failures.push({ code: "insufficient-improvement", actual: improvement, required: 0.2 });
  }

  return {
    passed: failures.length === 0,
    metrics: {
      baselinePositiveRate: base.positiveRate,
      candidatePositiveRate: next.positiveRate,
      comparableCandidatePositiveRate: comparableNext.positiveRate,
      baselineFalsePositiveRate: base.falsePositiveRate,
      candidateFalsePositiveRate: next.falsePositiveRate,
      improvement,
    },
    failures,
  };
}

async function loadGrades(label) {
  safeLabel(label);
  const directory = path.join(root, "evals/results", label);
  const files = [];
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(target);
      else if (entry.name === "summary.json") files.push(target);
    }
  }
  await walk(directory);
  return (await Promise.all(files.map(async (file) => JSON.parse(await readFile(file, "utf8"))))).flatMap(
    (report) => report.grades ?? [],
  );
}

function readFlag(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
}

async function main() {
  const baselineLabel = readFlag(process.argv.slice(2), "--baseline");
  const candidateLabel = readFlag(process.argv.slice(2), "--candidate");
  if (!baselineLabel || !candidateLabel) throw new Error("Use --baseline <label> --candidate <label>.");
  safeLabel(baselineLabel);
  safeLabel(candidateLabel);
  const report = compareRuns(await loadGrades(baselineLabel), await loadGrades(candidateLabel));
  const output = path.join(root, "evals/results", `${baselineLabel}-vs-${candidateLabel}.json`);
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Comparison failed.");
    process.exitCode = 1;
  });
}
