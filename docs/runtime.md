# Runtime guide

Ultra Instinct has two modes:

- **Skills-only** installs the canonical `skills/` folders. It behaves like the `lite` profile.
- **Native runtime** installs the client plugin. It defaults to `guided` and adds lifecycle hooks.

## Install and uninstall

### Skills-only

Install all fourteen skills in the current project:

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

```bash
codex plugin marketplace add XSIRIX/ultra-instinct
codex plugin add ultra-instinct@ultra-instinct
```

Remove it:

```bash
codex plugin remove ultra-instinct@ultra-instinct
codex plugin marketplace remove ultra-instinct
```

Codex may ask you to trust executable hooks. The hooks are bundled JavaScript and use a two-second timeout. Review the source and accept only the expected plugin root.

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
  "plugin": ["@xsirix/ultra-instinct@2.0.0-rc.1"]
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
| Mutation and verification facts | No | Yes | Yes |
| Unverified completion warning | No | Yes | Yes |
| Completion continuation | No | No | Once per mutation cycle |

`guided` never denies an action. `strict` may ask the agent to continue once when a change has no fresh recognized verification. A second completion attempt is allowed, so the hook cannot loop forever. Direct user instructions remain higher priority in every profile.

## Client capabilities

| Capability | Claude Code | Codex | OpenCode |
|---|---:|---:|---:|
| Canonical skills | Yes | Yes | Yes |
| Session and completion hooks | Native hook files | Native hook files | JavaScript plugin events |
| Compaction recovery | Compact `SessionStart` | Compaction lifecycle | Compaction context hook |
| Workflow commands | Six native commands | Use skills directly | Six registered commands |
| Reviewer/debugger agents | Native agents | Use skills directly | Registered subagents |

All adapters call the same code in `runtime/`. They only translate client events and responses.

## Privacy and safety

The runtime never stores prompts, transcripts, source text, filenames, tool arguments, tool output, environment values, or credentials.

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
- Codex CLI 0.147.0 or newer;
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
