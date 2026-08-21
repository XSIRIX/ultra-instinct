# Ultra Instinct

Ultra Instinct helps coding agents choose the right workflow before they act. It keeps one set of fifteen skills and adds a small, shared runtime for Claude Code, Codex, and OpenCode.

## Choose an install

### Skills-only

This is the lightest option. It works with Claude Code, Codex, OpenCode, Cursor, Gemini CLI, and other clients supported by the [Skills CLI](https://github.com/vercel-labs/skills). There are no hooks or runtime state.

```bash
npx skills add xsirix/ultra-instinct
```

Install globally with `-g`, or install one skill with `--skill tdd`.

### Native runtime

This adds session routing and compaction recovery. Claude Code and OpenCode also add mutation tracking and verification guidance. The default profile is `guided`.

Claude Code:

```bash
claude plugin marketplace add XSIRIX/ultra-instinct
claude plugin install ultra-instinct@ultra-instinct
```

Codex:

```bash
codex plugin marketplace add XSIRIX/ultra-instinct
codex plugin add ultra-instinct@ultra-instinct
```

Codex Desktop: install Ultra Instinct from the Plugins screen, then start a new task. The router skill applies to every coding task, so workflow selection still works before executable hooks are trusted. The plugin declares a `SessionStart` bootstrap hook only. If your Desktop build does not show hook review yet, open `/hooks` once in Codex CLI; Codex Desktop and CLI share the persisted trust state.

OpenCode can load the source checkout directly. Clone it under your project, then link its entry point:

```bash
git clone https://github.com/XSIRIX/ultra-instinct.git vendor/ultra-instinct
mkdir -p .opencode/plugins
ln -s "$PWD/vendor/ultra-instinct/.opencode/index.mjs" .opencode/plugins/ultra-instinct.mjs
```

After the RC is published to npm, add the scoped package to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@xsirix/ultra-instinct@2.0.0-rc.2"]
}
```

See [the runtime guide](docs/runtime.md) for profiles, trust, privacy, tested versions, global OpenCode setup, and uninstall commands.

## Profiles

Set `ULTRA_INSTINCT_PROFILE` before starting your client:

```bash
ULTRA_INSTINCT_PROFILE=strict claude
```

| Profile | What it does |
|---|---|
| `lite` | Skills only. No bootstrap, state, warnings, or completion gate. |
| `guided` | Routes work, restores context, and warns about unverified changes. Never blocks. |
| `strict` | Adds one bounded verification continuation per mutation cycle. Never loops. |

Invalid or missing values fall back to `guided`; invalid values emit a short warning.

On Codex, `guided` and `strict` currently provide the same bootstrap and compaction recovery. Codex does not expose a trustworthy command-success field to hooks, so Ultra Instinct does not track mutation or verification facts or run a completion gate there.

## Skills

| Need | Skill |
|---|---|
| Pick an approach | `brainstorm` |
| Compare visual options | `mockup` |
| Pressure-test a proposed design | `grilling` |
| Record an agreed design | `write-design-spec` |
| Turn a spec into tasks | `write-plan` |
| Isolate committed work | `isolate-work` |
| Execute an approved plan | `execute-plan` |
| Change behavior safely | `tdd` |
| Diagnose an unexplained failure | `systematic-debugging` |
| Prove completion | `verification-before-completion` |
| Capture durable project documentation | `capture-artifact` |
| Request or receive review | `request-review`, `receiving-code-review` |
| Finish a reviewed branch | `finish-branch` |
| Understand the suite | `using-ultra-instinct` |

Claude Code and OpenCode also expose workflow commands plus reviewer and debugger agents. Codex provides the equivalent behavior through skills and runtime guidance.

## Safety

- User and repository instructions always win.
- Hooks do not use the network, install packages, edit project source files, call a model, or run checks.
- Local drafts, runtime facts, and eval output stay under ignored `.ultra-instinct/`.
- On Claude Code and OpenCode, state contains only mutation and verification facts. Codex writes no workflow state. No client stores prompts, transcripts, source, filenames, tool arguments, output, environment values, or credentials.
- Runtime failures allow the client action and emit a short warning.
- There are zero production dependencies and no postinstall script.

## Development

```bash
npm install
npm run sync:codex
npm run check
npm run eval -- --dry-run --client all --profile guided --repeat 5 --label guided
```

Run `npm run sync:codex` after changing the shared adapters, hooks, runtime, or skills. Validation rejects a stale Codex package copy.

Deterministic checks are free and local. Live evaluations call paid models and require separate operator consent. See [evals/README.md](evals/README.md).

For end-to-end agent quality, the [Harbor A/B benchmark](evals/harbor/README.md) compares true vanilla Codex with Ultra Instinct `guided` on pinned Terminal-Bench 2.1 tasks. Setup and job preparation are free; model-backed runs require explicit approval.

## License

MIT. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for retained provenance.
