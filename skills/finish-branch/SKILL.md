---
name: finish-branch
description: Use when implementation and review are complete and the work needs to land — verifies the suite, presents merge/PR/keep options, executes the choice, and cleans up the worktree. Follows request-review.
---

# Finish Branch

Green suite, then let the user decide how it lands.

**Done when** the work has landed the way the user chose, and nothing they didn't ask you to delete has been deleted.

## Verify

Run the full suite on the tree you're about to integrate. A green run from earlier in the session only proves the tree it ran on. If anything fails, report it and stop — no menu until it's green.

## Know where you are

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
WORKTREE=$(git rev-parse --show-toplevel)   # capture now, before any cd
```

`GIT_DIR != GIT_COMMON` means a worktree. On a detached HEAD, local merge isn't available — offer PR or keep-as-is only.

The base branch is whatever this work forked from. If that isn't already established, ask — merging into the wrong branch is expensive to undo.

## Ask

```
Implementation complete, tests green. How should this land?

1. Merge into <base> locally
2. Push and open a PR
3. Leave the branch as-is
```

Wait for the answer. This is the user's call, not yours.

## Land it

**Merge locally** — from the main repo root: checkout base, pull, merge, then run the suite **on the merged result**. If that fails, stop and investigate; nothing's pushed, so it's all recoverable. Once green, remove the worktree and delete the branch.

**Push and PR** — push with upstream tracking, open the PR against the base using the forge's CLI or the URL git prints, following the repo's PR template if there is one. Report the URL. **Keep the worktree** — PR feedback gets fixed there.

**Keep as-is** — report the branch name and worktree path. Nothing to clean up.

## Cleanup

Only after a local merge, and only for worktrees you created:

```bash
cd "$(git -C "$(git rev-parse --git-common-dir)/.." rev-parse --show-toplevel)"
git worktree remove "$WORKTREE" && git worktree prune
git branch -d <feature-branch>
```

If the worktree lives somewhere the harness manages rather than under `.worktrees/`, leave it — or use the harness's own exit tool.

Discarding work is only ever a response to an explicit request, and it gets an explicit confirmation first.
