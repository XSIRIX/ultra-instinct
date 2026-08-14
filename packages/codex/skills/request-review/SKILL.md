---
name: request-review
description: Use when an implementation is complete and before merging or opening a PR — dispatches one reviewer subagent over all committed and working-tree changes, then fixes what it finds in a single pass. Follows execute-plan, precedes finish-branch.
---

# Request Review

One reviewer, over the whole branch, once. This is an explicit review boundary, not automatic delegation from a hook. Fix what's real in a single pass and move on.

When feedback arrives, process it with `receiving-code-review` before changing code.

If you are already the reviewer subagent, review directly and return findings. Do not dispatch another reviewer or modify the branch.

Why a subagent instead of reading the diff yourself: you wrote this code, and you'll read past your own assumptions. A fresh reader catches what you can't see, and the diff never enters your context — only the findings do.

## Prepare the diff

Write it to a file. A large diff pasted into a prompt sits in your context for the rest of the session.

```bash
BASE=$(git merge-base main HEAD)   # or whatever this branch forked from
{
  echo "## Commits"; git log --oneline "$BASE"..HEAD
  echo; echo "## Files"; git status --short; git diff --stat "$BASE"
  echo; echo "## Tracked diff"; git diff -U10 "$BASE"
  echo; echo "## Untracked files"
  while IFS= read -r -d '' file; do
    git diff --no-index -U10 -- /dev/null "$file" || true
  done < <(git ls-files --others --exclude-standard -z)
} > /tmp/review-package.md
```

Using `git diff "$BASE"` includes committed, staged, and unstaged tracked changes. The final loop adds untracked files, so a newly created artifact is reviewed even when the active workflow did not authorize a commit.

## Dispatch

One subagent, on the most capable model available — this is the only review the work gets.

```
You are reviewing a completed implementation before it merges.

Requirements: <path to spec>
Plan: <path to plan>
Diff: /tmp/review-package.md

Read the requirements, then the diff. Read surrounding code in the repo
wherever the diff alone doesn't give you enough context to judge.

The spec and plan carry a References section with the docs and versions
this was built against. Reuse them. Where code uses an external API,
check its pinned version. If its references are missing, stale, or
contradicted, run one bounded web search or Exa pass against official
version-matched docs or source. Search again only if the contract
changes. If search is unavailable, state the limit. Code written against
an outdated API is a real finding.

Assess:

1. Correctness — does it do what the requirements say? Anything missing,
   partial, or done differently without a stated reason?
2. Bugs — logic errors, unhandled failure paths, races, off-by-ones,
   resource leaks, swallowed errors.
3. Tests — do they test real behavior or assert on mocks? Would any of
   them still pass if the implementation were broken? What's untested
   that should be tested?
4. Security — injection, authz gaps, secrets in code, unvalidated input
   crossing a trust boundary.
5. Quality — duplication, dead code, unclear naming, functions doing too
   much, inconsistency with the patterns already in this codebase.
6. Scope — anything built that nothing asked for.

Report each finding as CRITICAL (broken, unsafe, or a missing
requirement), IMPORTANT (a real defect that will cause problems), or
MINOR (worth knowing, doesn't block).

For each: file:line, what's wrong, why it matters, and a concrete
failure case — the input or state that makes it go wrong. If you can't
name one, it's probably MINOR or not a finding.

Be specific and be honest. Say clearly if the work is solid; don't
invent findings to seem thorough. End with an overall assessment.
```

## Act on the findings

**Keep going. Don't hand the findings back and wait.** You are mid-flow — the branch is yours, the context is warm, the suite is set up. Stopping to ask "want me to fix these?" makes the user the router between two halves of one job, and by the time they answer you've lost the context that made fixing cheap. Fix, then report what you fixed.

The only findings that go to the user as a question are MINOR ones, and they go *after* the real fixes are done and green.

Read all of them before fixing anything. Then:

- **Critical and Important** — fix in **one pass**, all together. Not one subagent per finding: each fresh fixer rebuilds the same context and re-runs the same suite, which is how a final review ends up costing more than the implementation did.
- **Minor** — tell the user what they are and let them choose. Don't silently fix and don't silently drop.
- **Wrong** — reviewers get things wrong. Say so with the reasoning or the test that disproves it. Don't fix correct code to close a ticket, and don't quietly ignore a finding you can't refute.

After fixing: full suite green, fixes committed, and you've verified them yourself. A second full review round is usually churn — if the fix wave was large or touched something subtle, one scoped re-review of just the fix diff is reasonable.

## Report

Give the user the honest summary: what the reviewer found, what you fixed, what you're leaving and why. Anything still open gets said plainly, not buried.

Then use `finish-branch`.
