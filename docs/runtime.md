# Runtime guide

Ultra Instinct has two modes:

- **Skills-only** installs the canonical `skills/` folders. It behaves like the `lite` profile.
- **Native runtime** installs the client plugin. It defaults to `guided` and adds lifecycle hooks.

## Install and uninstall

### Skills-only

Install all fifteen skills in the current project:

```bash
npx skills add xsirix/ultra-instinct
```

Install globally:

```bash
npx skills add xsirix/ultra-instinct --global
```

The Skills CLI removes skills by skill name, not repository name. Run `npx skills list`, then remove the installed Ultra Instinct skills you want. For example:

```bash
npx skills remove tdd systematic-debugging verification-before-completion
```

Add `--global` when removing a global install.

### Claude Code native runtime

```bash
claude plugin marketplace add XSIRIX/ultra-instinct
claude plugin install ultra-instinct@ultra-instinct
```

Remove it:

```bash
claude plugin uninstall ultra-instinct@ultra-instinct
claude plugin marketplace remove ultra-instinct
```

Claude Code shows the plugin source and requested scope during installation. Review it before accepting. Do not use hook-trust bypass flags for normal use.

### Codex native runtime

Codex CLI:

```bash
codex plugin marketplace add XSIRIX/ultra-instinct
codex plugin add ultra-instinct@ultra-instinct
```

Codex Desktop:

1. Open Plugins and install Ultra Instinct.
2. Review and trust the declared lifecycle hooks when the app shows the hook permission.
3. Start a new task.

The `using-ultra-instinct` router skill matches every coding task, so Desktop still selects a workflow if executable hooks have not been trusted. Codex registers `SessionStart` bootstrap only; untrusted hooks remove that bootstrap and compact recovery.

Current Codex documentation exposes hook review through `/hooks` in Codex CLI. If your Desktop build does not show hook review, open `/hooks` once in the CLI and trust the Ultra Instinct hooks there. Desktop and CLI use the same Codex configuration and persisted hook hashes.

Remove it:

```bash
codex plugin remove ultra-instinct@ultra-instinct
codex plugin marketplace remove ultra-instinct
```

Codex never trusts plugin hooks just because the plugin is installed. The hooks are bundled JavaScript and use a two-second timeout. Review the source and accept only the expected plugin root.

### OpenCode native runtime

Project-local source install:

```bash
git clone https://github.com/XSIRIX/ultra-instinct.git vendor/ultra-instinct
mkdir -p .opencode/plugins
ln -s "$PWD/vendor/ultra-instinct/.opencode/index.mjs" .opencode/plugins/ultra-instinct.mjs
```

Remove it:

```bash
rm .opencode/plugins/ultra-instinct.mjs
rm -rf vendor/ultra-instinct
```

For a global source install, place the link in `~/.config/opencode/plugins/` instead. OpenCode executes local plugins as code with your user permissions; it does not provide a plugin sandbox. Inspect the checkout before loading it.

When the RC is published to npm, add it to the `plugin` list in project or global `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@xsirix/ultra-instinct@2.0.0-rc.2"]
}
```

OpenCode installs configured npm plugins automatically with Bun. Until publication is verified, use the source install above.

## Profiles

Choose a profile in the environment that launches the client:

```bash
ULTRA_INSTINCT_PROFILE=lite codex
ULTRA_INSTINCT_PROFILE=guided opencode
ULTRA_INSTINCT_PROFILE=strict claude
```

| Behavior | `lite` | `guided` | `strict` |
|---|---:|---:|---:|
| Native skills | Yes | Yes | Yes |
| Session routing bootstrap | No | Yes | Yes |
| Compaction recovery | No | Yes | Yes |
| Mutation and verification facts | No | Claude/OpenCode | Claude/OpenCode |
| Unverified completion warning | No | Claude/OpenCode | Claude/OpenCode |
| Completion continuation | No | No | Claude/OpenCode, once per mutation cycle |

`guided` never denies an action. `strict` may ask the agent to continue once when a change has no fresh recognized verification. A second completion attempt is allowed, so the hook cannot loop forever. Direct user instructions remain higher priority in every profile.

Codex uses `SessionStart` only for the router bootstrap and compact recovery. Codex does not track mutation or verification facts and does not run completion warnings or strict continuation. Its current `PostToolUse.tool_response` for local commands is model-facing output, not trustworthy process status.

## Client capabilities

| Capability | Claude Code | Codex Desktop and CLI | OpenCode |
|---|---:|---:|---:|
| Canonical skills | Yes | Yes | Yes |
| Registered lifecycle hooks | `SessionStart`, `PostToolUse`, `Stop`, `SessionEnd` | `SessionStart` only | JavaScript plugin events |
| Compaction recovery | Compact `SessionStart` | Compaction lifecycle | Compaction context hook |
| Workflow commands | Seven native commands | Use skills directly | Seven registered commands |
| Reviewer/debugger agents | Native agents | Use skills directly | Registered subagents |

Registered adapters call the same code in `runtime/` for the events each client can support reliably. They only translate client events and responses.

## Design workflow

Use `brainstorm` to find a direction, then `grilling` to pressure-test its open choices and failure cases. Only after the user explicitly confirms the empty decision frontier does `write-design-spec` turn that understanding into a build contract.

Inside a project, grilling keeps its resumable working record under ignored `.ultra-instinct/grills/`. Outside a project, it stays in conversation and writes no file.

## Privacy and safety

The runtime never stores prompts, transcripts, source text, filenames, tool arguments, tool output, environment values, or credentials. Codex writes no workflow state because it registers bootstrap hooks only.

It stores only:

- a schema version;
- a mutation counter and timestamp;
- the last successful verification timestamp and broad family, such as `test`;
- whether the first reminder or strict gate was already issued.

Files are at most 4 KiB. Their names are SHA-256 hashes of the client/session/workspace key. By default they live in `.ultra-instinct/runtime/` inside the workspace. Ultra Instinct creates `.ultra-instinct/.gitignore` with `*` when missing and never overwrites it. The directory and files are owner-only where supported. State is deleted at normal session end, and stale files older than seven days are removed. Set `ULTRA_INSTINCT_STATE_DIR` to choose another directory.

Hooks do not make network requests. They do not install dependencies, edit project source files, run checks, call another model, spawn agents, or make product decisions. Errors fail open: the original client action continues.

## Supported versions

The initial contract was checked on macOS with:

- Claude Code 2.1.227 or newer;
- Codex CLI 0.148.0-alpha.15;
- OpenCode 1.18.15 or newer;
- Node.js 20 or newer;
- Bun 1.3 or newer.

Ubuntu 24.04 is supported by the same contract. Windows is skills-only until its native runtime passes the same tests.

## Verify an install

Repository checks are deterministic. They do not call a model:

```bash
npm install
npm run check
npm run eval -- --dry-run --client all --profile guided --repeat 5 --label guided
```

Paid live model evaluations are separate. Codex and OpenCode can also record trusted temporary workspaces or local sessions, so their live runner requires `--allow-client-state`. See [the evaluation guide](../evals/README.md).
