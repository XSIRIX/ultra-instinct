---
name: isolate-work
description: Use before creating the first artifact of a piece of work — spec, plan, or code — to make sure it happens on a dedicated branch or worktree instead of the user's current checkout. Detects existing isolation and does nothing if already isolated.
---

# Isolate Work

Make sure this work has somewhere of its own to live.

**Done when** you're on a branch that belongs to this work, dependencies are installed, and you know whether the test suite was green before you touched anything.

Ignored specs and plans do not require isolation. Files under `.ultra-instinct/` are local working state. Isolate before changing source files or publishing an artifact into a tracked project path.

## Are you already isolated?

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
git rev-parse --show-superproject-working-tree 2>/dev/null   # prints a path = submodule
```

`GIT_DIR != GIT_COMMON` means a linked worktree — **unless you're in a submodule**, which looks identical from the first two commands. That's what the third one rules out.

- **In a worktree** → report path and branch, stop. Don't create another.
- **Normal checkout, on a feature branch for this work** → isolation enough. Say so, stop.
- **Normal checkout on `main`/`master`** → get a workspace, below.
- **Not a git repo** → say so and ask before running `git init`. Don't create one silently.

## Getting a workspace

Follow any preference the user already stated — in instructions, project config, or earlier in the conversation — without asking again. Otherwise ask once:

> This'll create files. Want an isolated worktree so your current branch stays untouched, or just a branch here?

If they decline isolation, create a feature branch and work in place.

**Use a native tool if you have one** — something like `EnterWorktree`, a `/worktree` command, or a `--worktree` flag. It owns placement, branch creation, and cleanup; `git worktree add` behind its back leaves state the harness can't see or clean up.

**Otherwise, git.** The one thing worth getting right: verify the worktree directory is git-ignored *before* creating it, or you commit an entire copy of the tree into the repo.

```bash
git check-ignore -q .worktrees || { echo ".worktrees/" >> .gitignore; git add .gitignore && git commit -m "chore: ignore worktrees"; }
git worktree add ".worktrees/$BRANCH_NAME" -b "$BRANCH_NAME"
cd ".worktrees/$BRANCH_NAME"
```

Use an existing `worktrees/` or `.worktrees/` if the project has one. If `git worktree add` fails on permissions (sandbox denial), say so and work in place on a feature branch.

## Make it runnable

Install dependencies if the worktree needs its own copy — whatever the project uses. Then run the suite once for a baseline.

If it's already red before you've touched anything, say so and ask whether to proceed. Otherwise every later failure is ambiguous.

```
Workspace: <path>  (branch <name>)
Baseline: <N> tests passing
```
