import { STAGES } from "./contracts.mjs";

const MUTATION_REMINDER =
  "Files changed. Use TDD for behavior changes, systematic debugging for unexplained failures, and brainstorming only when intended behavior is unsettled.";
const VERIFY_WARNING =
  "Files changed after the latest recognized verification. Run fresh relevant checks, or clearly explain why no check applies.";

function allowDecision(overrides = {}) {
  return { allow: true, context: null, warning: null, continueSession: false, ...overrides };
}

function isFreshlyVerified(state) {
  return (
    state.mutationEpoch === 0 ||
    (state.lastVerificationAt !== null &&
      state.lastMutationAt !== null &&
      state.lastVerificationAt >= state.lastMutationAt)
  );
}

export function reduceRuntimeEvent(state, event, bootstrap) {
  if (event.profile === "lite") return { nextState: state, decision: allowDecision() };
  const nextState = { ...state };

  if (event.stage === STAGES.SESSION_START) {
    return { nextState, decision: allowDecision({ context: bootstrap.context }) };
  }

  if (event.stage === STAGES.CONTEXT_COMPACTING) {
    const fact = !isFreshlyVerified(nextState)
      ? "\n\nUltra observed facts: an unverified mutation exists since the latest recognized verification."
      : nextState.verificationKind
        ? `\n\nUltra observed facts: fresh ${nextState.verificationKind} verification followed the latest mutation.`
        : "";
    return { nextState, decision: allowDecision({ context: `${bootstrap.context}${fact}` }) };
  }

  if (event.stage === STAGES.TOOL_AFTER && event.tool?.success !== false) {
    if (event.tool?.mutation) {
      if (isFreshlyVerified(nextState)) {
        nextState.mutationEpoch += 1;
        nextState.lastMutationAt = event.at ?? Date.now();
        nextState.lastVerificationAt = null;
        nextState.verificationKind = null;
        nextState.gateIssuedForEpoch = null;
        if (!nextState.firstMutationReminderSent) {
          nextState.firstMutationReminderSent = true;
          return { nextState, decision: allowDecision({ context: MUTATION_REMINDER }) };
        }
      }
    } else if (event.tool?.verificationKind) {
      nextState.lastVerificationAt = event.at ?? Date.now();
      nextState.verificationKind = event.tool.verificationKind;
    }
    return { nextState, decision: allowDecision() };
  }

  if (event.stage === STAGES.SESSION_COMPLETING && !isFreshlyVerified(nextState)) {
    if (
      event.profile === "strict" &&
      !event.stopHookActive &&
      !event.userOverride &&
      nextState.gateIssuedForEpoch !== nextState.mutationEpoch
    ) {
      nextState.gateIssuedForEpoch = nextState.mutationEpoch;
      return {
        nextState,
        decision: allowDecision({ allow: false, context: VERIFY_WARNING, continueSession: true }),
      };
    }
    return { nextState, decision: allowDecision({ context: VERIFY_WARNING }) };
  }

  return { nextState, decision: allowDecision() };
}
