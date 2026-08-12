---
name: using-ultra-instinct
description: Use when the user asks about ultra-instinct itself, asks which workflow fits, or says "use ultra instinct". Routes work to the smallest matching skill. Not a workflow step and produces no artifact.
---

<!-- ultra-instinct:bootstrap:v2 -->
# Using Ultra Instinct

Select the smallest matching skill before acting, including before exploration or clarification. Say which skill you are using, then follow it. Drop it if evidence shows it does not fit.

User and repository instructions take priority. Never manufacture process the user did not ask for. If directly assigned a narrow subtask, do that task.

One primary agent owns the task and its final result. Delegate only independent read-only research, non-overlapping implementation, or an explicit review. Hooks never spawn agents or dispatch agents.

## Route by the current need

- Unsettled goal, behavior, or approach: `brainstorm`.
- Visual layout, screen, or flow decision: `mockup`.
- Agreed design that needs a durable spec: `write-design-spec`.
- Approved spec or clear requirements that need build tasks: `write-plan`.
- Tracked artifact or implementation needs isolation: `isolate-work`.
- Approved plan needs full implementation: `execute-plan`.
- Feature, fix, or behavior change: `tdd`.
- Unexplained failure: `systematic-debugging`, then `tdd` after the cause is confirmed.
- Work appears done: `verification-before-completion`.
- Request a whole-branch review: `request-review`.
- Review feedback arrived: `receiving-code-review`.
- Reviewed, green branch needs to land: `finish-branch`.
- Questions about this suite or routing: `using-ultra-instinct`.

Do not restart at `brainstorm` when a valid spec or plan already exists. Inputs may come from another session or document. Ask once only when the entry point materially changes the work.

For implementation, use fresh library docs, tests before production changes, and fresh evidence before completion. Ultra Instinct guidance never outranks the user's direct request.
