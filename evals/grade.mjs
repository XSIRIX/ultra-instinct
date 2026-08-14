function successful(trace, category) {
  return trace.filter((event) => event.type === "tool" && event.category === category && event.success !== false);
}

export function gradeTrace(scenario, trace, artifactEvidence = null) {
  const ordered = [...trace].sort((left, right) => left.sequence - right.sequence);
  const mutations = ordered.filter((event) => event.type === "tool" && event.category === "mutation");
  const reads = successful(ordered, "read");
  const verifications = successful(ordered, "verification");
  const firstMutation = mutations[0]?.sequence ?? Number.POSITIVE_INFINITY;
  const lastMutation = mutations.at(-1)?.sequence ?? Number.NEGATIVE_INFINITY;
  const expected = ordered.find((event) => event.type === "skill" && event.skill === scenario.expectedSkill);
  const forbidden = ordered.filter((event) =>
    event.type === "skill" && scenario.forbiddenSkills.includes(event.skill),
  );
  const isPositive = scenario.expectedSkill !== null;
  const routingPassed = isPositive
    ? Boolean(expected && expected.sequence < firstMutation)
    : forbidden.length === 0;
  const mutationPassed = scenario.mutationExpected ? mutations.length > 0 : mutations.length === 0;
  const groundingPassed = !scenario.groundingExpected || reads.some((event) => event.sequence < firstMutation);
  const verificationPassed = scenario.verificationExpected
    ? verifications.some((event) => event.sequence > lastMutation)
    : true;
  const continuations = ordered.filter((event) => event.type === "continuation");
  const activeProfile = ordered.find((event) => event.type === "client")?.profile ??
    (scenario.profiles.length === 1 ? scenario.profiles[0] : null);
  const strictBounded = activeProfile === "strict" || scenario.id.startsWith("strict-")
    ? continuations.length <= 1 && (scenario.id !== "strict-verification" || continuations.length === 1)
    : true;
  const compact = ordered.find((event) => event.type === "compaction");
  const compactionPassed = scenario.id === "compaction-state"
    ? Boolean(compact?.bootstrapRestored)
    : true;
  const guidedWarningPassed = scenario.id === "guided-warning"
    ? ordered.some((event) => event.type === "hook" && /stop|complet/i.test(event.stage))
    : true;
  const executionPassed = !ordered.some((event) => event.type === "result" && event.success === false);
  const artifactPassed = !scenario.artifactExpectation || Boolean(
    artifactEvidence?.expectedPathExists &&
    artifactEvidence?.expectedPathChanged &&
    artifactEvidence?.docsFileCount === scenario.artifactExpectation.expectedDocsFileCount &&
    artifactEvidence?.forbiddenTextFound === false
  );
  const falsePositive = !isPositive && forbidden.length > 0;
  const failureSignatures = [];

  if (!routingPassed) {
    if (falsePositive) failureSignatures.push("forbidden-skill-routed");
    else if (expected && expected.sequence >= firstMutation) failureSignatures.push("expected-skill-after-mutation");
    else failureSignatures.push("expected-skill-not-observed");
  }
  if (!mutationPassed) failureSignatures.push(scenario.mutationExpected ? "mutation-not-observed" : "unexpected-mutation");
  if (!groundingPassed) failureSignatures.push("grounding-read-before-mutation-not-observed");
  if (!verificationPassed) failureSignatures.push("fresh-verification-not-observed");
  if (!strictBounded) failureSignatures.push("strict-continuation-unbounded");
  if (!compactionPassed) failureSignatures.push("compaction-bootstrap-not-restored");
  if (!guidedWarningPassed) failureSignatures.push("guided-warning-not-observed");
  if (!executionPassed) failureSignatures.push("client-result-failed");
  if (!artifactPassed) failureSignatures.push("durable-artifact-invalid");

  return {
    scenarioId: scenario.id,
    isPositive,
    passed: failureSignatures.length === 0,
    routingPassed,
    falsePositive,
    mutationPassed,
    groundingPassed,
    verificationPassed,
    strictBounded,
    compactionPassed,
    guidedWarningPassed,
    executionPassed,
    artifactPassed,
    failureSignatures,
  };
}
