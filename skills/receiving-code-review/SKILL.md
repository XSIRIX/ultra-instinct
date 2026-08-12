---
name: receiving-code-review
description: Use when code-review feedback arrives and must be evaluated, answered, or implemented. Do not apply suggestions blindly; verify each finding against the current code and requirements first.
---

# Receiving Code Review

Treat review comments as technical claims to verify, not commands to obey or arguments to win.

**Done when** every actionable comment is accepted with evidence, rejected with evidence, or held for one clear question.

## Process the review

1. Read all feedback before editing. Group comments that share one cause.
2. Locate the exact current code and reproduce the claimed problem when possible.
3. Check the suggestion against user requirements, supported platforms, and nearby patterns.
4. Ask one precise question if the intended behavior is ambiguous.
5. For a confirmed behavior change, use `tdd`: reproduce it in a failing test, then make the smallest fix.
6. Run fresh verification after the changes.

Reply with facts. State what changed and the evidence, or explain why a suggestion does not fit. Avoid empty agreement, defensive prose, and unrelated cleanup.
