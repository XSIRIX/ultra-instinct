export const SURFACES = Object.freeze({
  commands: Object.freeze([
    { name: "brainstorm", skill: "brainstorm", description: "Clarify an unsettled idea or approach" },
    { name: "grilling", skill: "grilling", description: "Pressure-test a proposed design" },
    { name: "design-spec", skill: "write-design-spec", description: "Capture an agreed design" },
    { name: "plan", skill: "write-plan", description: "Turn requirements into build tasks" },
    { name: "execute", skill: "execute-plan", description: "Implement an approved plan" },
    { name: "verify", skill: "verification-before-completion", description: "Prove work with fresh evidence" },
    { name: "finish", skill: "finish-branch", description: "Land a reviewed green branch" },
  ]),
  agents: Object.freeze([
    { name: "reviewer", skill: "request-review", description: "Review the whole branch once" },
    { name: "debugger", skill: "systematic-debugging", description: "Find a failure's root cause" },
  ]),
});
