# Ultra Instinct v2 Runtime — Implementation Plan

**Design spec:** `docs/design/2026-08-12/ultra-instinct-v2-runtime.md`

**Goal:** Build a small cross-client runtime that makes Ultra Instinct skills reliably guide Claude Code, Codex, and OpenCode while preserving skills-only installation.

**Approach:** Keep `skills/` as the only methodology source. A dependency-free shared runtime reduces normalized lifecycle events into deterministic context and completion decisions, while thin client adapters translate native hook payloads. Static validation, adapter fixtures, and repeated live sessions measure whether guidance works before release.

**Stack:** ECMAScript modules, Node.js 20+, Bun 1.3+, Node's built-in test runner, Ajv 8.20.0 as a development-only schema validator, Agent Plugins 1.0, Claude Code 2.1.227+, Codex CLI 0.147.0+, and OpenCode 1.18.15+.

## Constraints

- Agent Plugins schema: 1.0.0.
- Initial validated clients: Claude Code 2.1.227 or newer, Codex CLI 0.147.0 or newer, and OpenCode 1.18.15 or newer.
- Initial supported operating systems: macOS 14 or newer and Ubuntu 24.04 LTS.
- Windows remains skills-only until it passes the same runtime contract and live smoke gates.
- Runtime modules MUST work in Node.js 20 or newer and Bun 1.3 or newer.
- Production runtime dependencies: zero. Ajv is development-only.
- Bootstrap body after frontmatter removal: at most 2,400 UTF-8 bytes.
- Persisted state: at most 4 KiB per active session.
- Hook runtime: 50 ms p95 in fixture tests with a hard client timeout of two seconds.
- Hook network access: none.
- Default profile: `guided`; supported overrides are `lite` and `strict` through `ULTRA_INSTINCT_PROFILE`.
- Initial v2 skill count: exactly thirteen.
- Hooks MUST fail open on runtime, state, and adapter errors.
- Hooks MUST NOT store prompts, transcripts, tool arguments, tool output, source text, filenames, environment values, or credentials.
- Hooks MUST NOT modify project source files, install dependencies, run project checks automatically, make model calls, or spawn agents. Fact-only state under ignored `.ultra-instinct/` is allowed.
- User and repository instructions remain higher priority than Ultra Instinct guidance.
- `npx skills add xsirix/ultra-instinct` MUST remain a supported skills-only installation.
- Repository license: MIT. Reused Agent Plugins schema material retains Apache-2.0 attribution; directly reused Superpowers or ECC code retains MIT attribution; Claude Code source is not copied.
- One commit per task, after that task's verification passes.

## References

- [Approved design spec](../../design/2026-08-12/ultra-instinct-v2-runtime.md) — requirements, boundaries, event mapping, and release thresholds.
- Existing [`README.md`](../../../README.md) and [`skills/using-ultra-instinct/SKILL.md`](../../../skills/using-ultra-instinct/SKILL.md) — current skills-only behavior at commit `43d3f3532c499f1beffd7b12517a027cc3c34727`.
- [Superpowers porting guide](https://github.com/obra/superpowers/blob/44c9b2d6e889982ac18c27d05a19fefe335194e1/docs/porting-to-a-new-harness.md) — v6.2.0 bootstrap and thin-adapter pattern.
- [Superpowers OpenCode adapter](https://github.com/obra/superpowers/blob/44c9b2d6e889982ac18c27d05a19fefe335194e1/.opencode/plugins/superpowers.js) — config registration, message injection, and deduplication.
- [ECC cross-harness architecture](https://github.com/affaan-m/everything-claude-code/blob/569b1d5b32ebf4c32d0b965bb956b16713533e07/docs/architecture/cross-harness.md) — shared runtime and client-edge separation in ECC 2.2.0.
- [Agent Plugins 1.0 specification](https://github.com/agentplugins/agent-plugins-spec/blob/bd383552095128f6effe895b9257cfd580a6d179/spec/1.0.0.md) and [plugin schema](https://github.com/agentplugins/agent-plugins-spec/blob/bd383552095128f6effe895b9257cfd580a6d179/schemas/1.0.0/plugin.schema.json) — portable manifest and skill discovery contract.
- [Ajv getting started](https://ajv.js.org/guide/getting-started.html) — v8.20.0 development-time JSON Schema validation.
- [Claude Code plugin reference](https://code.claude.com/docs/en/plugins-reference) and [hook reference](https://code.claude.com/docs/en/hooks) — plugin manifests, `${CLAUDE_PLUGIN_ROOT}`, native events, and output payloads.
- [Official Codex plugin guide](https://learn.chatgpt.com/docs/build-plugins) and [official Codex hooks reference](https://learn.chatgpt.com/docs/hooks) — `.codex-plugin/plugin.json`, default `hooks/hooks.json`, trust, common payloads, and Stop continuation.
- [Codex Agent Plugins manifest discovery](https://github.com/openai/codex/blob/eb752e43d9b7bd7dc5965ea20642bcf7f1a492d8/codex-rs/utils/plugins/src/plugin_namespace.rs) — root standard manifest with legacy-manifest fallback.
- [Codex app-server capability roots](https://github.com/openai/codex/blob/eb752e43d9b7bd7dc5965ea20642bcf7f1a492d8/codex-rs/app-server/README.md#api-overview) — direct plugin-root injection for live evaluation without marketplace installation.
- [OpenCode plugin reference](https://opencode.ai/docs/plugins/) and [SDK reference](https://opencode.ai/docs/sdk/) — config mutation, tool events, compaction, `session.idle`, and `session.prompt`.

## File map

- `plugin.json` — canonical Agent Plugins 1.0 metadata.
- `package.json`, `package-lock.json` — development scripts, zero runtime dependencies, and the Git-installable OpenCode entry point.
- `schemas/agent-plugins/1.0.0/plugin.schema.json` — pinned portable-manifest schema.
- `validation/` — static portable, Claude, Codex, OpenCode, skills, and metadata-parity checks.
- `runtime/contracts.mjs` — event, decision, client, stage, and state constants.
- `runtime/profile.mjs` — profile resolution and warning behavior.
- `runtime/bootstrap.mjs` — frontmatter stripping, byte budget, and deduplication marker.
- `runtime/classify.mjs` — transient mutation and verification classification.
- `runtime/state.mjs` — bounded private session-state persistence and cleanup.
- `runtime/policy.mjs` — pure state transition and completion policy.
- `runtime/index.mjs` — stateful runtime facade used by every adapter.
- `runtime/surfaces.mjs` — canonical command and specialist-agent registry.
- `hooks/hooks.json` — shared Claude/Codex lifecycle declaration.
- `hooks/dispatch.mjs` — stdin/stdout command entry point and client selection.
- `adapters/claude.mjs`, `adapters/codex.mjs`, `adapters/opencode.mjs` — native payload translation only.
- `.claude-plugin/`, `.codex-plugin/`, `.agents/plugins/`, `.opencode/` — client packaging surfaces.
- `commands/`, `agents/` — Claude-native explicit entry points; OpenCode registers the same surfaces from `runtime/surfaces.mjs`.
- `tests/static/`, `tests/runtime/`, `tests/adapters/`, `tests/evals/`, `tests/fixtures/` — deterministic validation and recorded native payloads.
- `evals/` — shared scenarios, client drivers, normalized traces, deterministic grading, comparisons, and operator instructions.
- `docs/runtime.md` — installation, profiles, safety, troubleshooting, and client capability matrix.

### Task 1: Portable package and validation foundation

**Delivers:** The repository is a valid Agent Plugins 1.0 package with a repeatable Node test and validation command, while still containing only the existing skills behavior.

**Requirement coverage:** 1, 3, 16; packaging and dependency constraints.

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `plugin.json`
- Create: `schemas/agent-plugins/1.0.0/plugin.schema.json`
- Create: `THIRD_PARTY_NOTICES.md`
- Create: `validation/portable.mjs`
- Create: `validation/skills.mjs`
- Create: `validation/cli.mjs`
- Create: `tests/static/plugin-manifest.test.mjs`
- Create: `tests/static/skill-layout.test.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `validatePortablePlugin(pluginRoot: string): Promise<{ manifest: object | null, errors: string[] }>` from `validation/portable.mjs`.
- Produces: `readSkillFrontmatter(skillFile: string): { name: string | null, description: string | null, body: string, errors: string[] }` and `validateSkillLayout(pluginRoot: string): { names: string[], errors: string[] }` from `validation/skills.mjs`.
- Produces package scripts: `npm test`, `npm run validate`, `npm run validate:portable`, and `npm run check`.
- Produces canonical plugin metadata: name `ultra-instinct`, version `2.0.0-rc.1`, author name `XSIRIX` with URL `https://github.com/XSIRIX`, MIT license, repository `https://github.com/XSIRIX/ultra-instinct`, and `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`; the npm package is scoped as `@xsirix/ultra-instinct`.

**References:**
- [Agent Plugins manifest](https://github.com/agentplugins/agent-plugins-spec/blob/bd383552095128f6effe895b9257cfd580a6d179/spec/1.0.0.md#5-manifest)
- [Agent Plugins fixed skill location](https://github.com/agentplugins/agent-plugins-spec/blob/bd383552095128f6effe895b9257cfd580a6d179/spec/1.0.0.md#6-component-discovery)
- [Ajv getting started](https://ajv.js.org/guide/getting-started.html)

**Approach:** Write failing manifest and skill-layout tests first. Pin the official 1.0.0 schema in the repository and validate it through `Ajv2020`; record the schema's Apache-2.0 origin in `THIRD_PARTY_NOTICES.md`. `package.json` uses ESM, Node's test runner, Ajv 8.20.0 only under `devDependencies`, an empty `dependencies` object, and no lifecycle install scripts. `validation/cli.mjs` runs all validators registered at that point and exits nonzero with one error per line. Ignore `node_modules/`, legacy `evals/results/`, and the unified `.ultra-instinct/` local workspace.

**Verify:**

```bash
npm ci --ignore-scripts
npm run validate:portable
npm test -- tests/static/plugin-manifest.test.mjs tests/static/skill-layout.test.mjs
npm ls --omit=dev
```

**Done when:** The real root manifest passes the pinned schema; malformed closed fields, wrong skill paths, mismatched folder/frontmatter names, and missing descriptions fail tests; the Skills CLI layout remains unchanged; and `npm ls --omit=dev` reports no production dependency.

**Commit:** `build: add portable plugin foundation`

### Task 2: Thirteen-skill catalog and compact canonical router

**Delivers:** Ultra Instinct has the approved thirteen canonical skills, and `using-ultra-instinct` is small enough to serve as the injected bootstrap.

**Requirement coverage:** 7, 12, 13, 16; bootstrap and skill-count constraints.

**Files:**
- Create: `skills/systematic-debugging/SKILL.md`
- Create: `skills/verification-before-completion/SKILL.md`
- Create: `skills/receiving-code-review/SKILL.md`
- Create: `tests/static/skill-catalog.test.mjs`
- Create: `tests/static/bootstrap-budget.test.mjs`
- Modify: `skills/using-ultra-instinct/SKILL.md`
- Modify: `skills/execute-plan/SKILL.md`
- Modify: `skills/request-review/SKILL.md`
- Modify: `skills/finish-branch/SKILL.md`
- Modify: `THIRD_PARTY_NOTICES.md`

**Interfaces:**
- Consumes: `readSkillFrontmatter()` and `validateSkillLayout()` from Task 1.
- Produces: exactly thirteen immediate `skills/*/SKILL.md` entries.
- Produces bootstrap marker: `<!-- ultra-instinct:bootstrap:v2 -->` exactly once in the `using-ultra-instinct` body.
- Produces routing names consumed by `runtime/bootstrap.mjs`: `systematic-debugging`, `verification-before-completion`, and `receiving-code-review` alongside the existing ten names.

**References:**
- Existing Ultra skill voice and structure in `skills/tdd/SKILL.md`, `skills/request-review/SKILL.md`, and `skills/using-ultra-instinct/SKILL.md`.
- [Superpowers systematic debugging](https://github.com/obra/superpowers/blob/44c9b2d6e889982ac18c27d05a19fefe335194e1/skills/systematic-debugging/SKILL.md)
- [Superpowers verification before completion](https://github.com/obra/superpowers/blob/44c9b2d6e889982ac18c27d05a19fefe335194e1/skills/verification-before-completion/SKILL.md)
- [Superpowers receiving code review](https://github.com/obra/superpowers/blob/44c9b2d6e889982ac18c27d05a19fefe335194e1/skills/receiving-code-review/SKILL.md)

**Approach:** Write the exact-catalog and byte-budget tests first. Adapt the three missing workflows to Ultra's concise, outcome-led style rather than copying Superpowers' imperative wrappers or rationalization tables. `systematic-debugging` ends with a testable root-cause hypothesis and hands behavior changes to `tdd`; `verification-before-completion` requires fresh commands and honest evidence; `receiving-code-review` verifies feedback before changing code. Rewrite the router body to include user-instruction precedence, all routes, and the stable marker within 2,400 bytes. Update execution, review, and finish skills so verification and received-review handling compose without duplicating the new skill bodies. Record the three MIT-licensed Superpowers source skills in `THIRD_PARTY_NOTICES.md` whether the final wording is adapted or independently rewritten.

**Verify:**

```bash
npm test -- tests/static/skill-layout.test.mjs tests/static/skill-catalog.test.mjs tests/static/bootstrap-budget.test.mjs
npm run validate:portable
```

**Done when:** Static validation sees exactly thirteen unique skills; every new description has positive and negative trigger boundaries; the stripped router is at most 2,400 bytes; all thirteen names are routable; user instructions remain higher priority; and no router text still claims there are nine skills or no session injection.

**Commit:** `feat: complete the Ultra Instinct skill router`

### Task 3: Shared deterministic runtime

**Delivers:** A client-neutral runtime resolves profiles, loads the canonical bootstrap, tracks only mutation/verification facts, and returns bounded guidance decisions.

**Requirement coverage:** 4–12; runtime, privacy, profile, state, failure, and performance constraints.

**Files:**
- Create: `runtime/contracts.mjs`
- Create: `runtime/profile.mjs`
- Create: `runtime/bootstrap.mjs`
- Create: `runtime/classify.mjs`
- Create: `runtime/state.mjs`
- Create: `runtime/policy.mjs`
- Create: `runtime/index.mjs`
- Create: `tests/runtime/profile.test.mjs`
- Create: `tests/runtime/bootstrap.test.mjs`
- Create: `tests/runtime/classify.test.mjs`
- Create: `tests/runtime/state.test.mjs`
- Create: `tests/runtime/policy.test.mjs`
- Create: `tests/runtime/index.test.mjs`
- Create: `tests/helpers/runtime.mjs`

**Interfaces:**
- Produces: `RUNTIME_SCHEMA = "ultra.runtime-event.v1"`, client constants, lifecycle-stage constants, `createInitialState()`, and `assertRuntimeEvent(event)` from `runtime/contracts.mjs`.
- Produces: `resolveProfile(raw: string | undefined): { profile: "lite" | "guided" | "strict", warning: string | null }`.
- Produces: `loadBootstrap(pluginRoot: string): Promise<{ marker: string, context: string }>`; it strips frontmatter and enforces the marker and byte budget.
- Produces: `classifyTool(tool: { name: string, input: unknown, response: unknown, success: boolean }): { mutation: boolean, verificationKind: string | null }`; raw input and response are never returned or stored.
- Produces: `createStateStore(options): { read(key), write(key, state), delete(key), cleanup() }` with injected `stateDir`, `clock`, and warning sink for deterministic tests.
- Produces: `reduceRuntimeEvent(state, event, bootstrap): { nextState, decision }`, where `decision` is `{ allow: boolean, context: string | null, warning: string | null, continueSession: boolean }`.
- Produces: `handleRuntimeEvent(event, options): Promise<decision>` from `runtime/index.mjs`; this is the only runtime entry point adapters call.

**References:**
- Approved spec sections “Shared runtime contract,” “Runtime state,” “Profiles,” and “Failure handling and safety.”
- [Codex hook tool coverage](https://learn.chatgpt.com/docs/hooks#tool-coverage) — normalized Bash and `apply_patch` names.

**Approach:** Use TDD for each pure module before wiring the facade. State keys hash client, session, and workspace; state lives in `ULTRA_INSTINCT_STATE_DIR` or `.ultra-instinct/runtime/`, uses owner-only permissions where supported, stays under 4 KiB, and expires after seven days. The first successful native mutation after startup or verification opens one dirty cycle and increments `mutationEpoch`; later mutations in that cycle do not rewrite state or rearm the gate. Common shell mutations are classified conservatively. Only successful recognized verification families close the cycle. `guided` emits context without denying; `strict` returns one continuation decision per unverified epoch and then allows the next completion attempt. `lite` performs no state writes. Missing IDs, corrupt state, permission failures, unsupported events, and exceptions all return an allow decision with at most one warning. A fixture benchmark samples at least 1,000 in-memory reductions and asserts p95 below 50 ms.

**Verify:**

```bash
npm test -- tests/runtime
npm run check
```

**Done when:** All profile, classifier, privacy, TTL, corruption, size, bounded-loop, user-precedence, and performance cases pass; no test state is written into the repository; and a forced runtime exception returns `allow: true` without exposing raw input.

**Commit:** `feat: add the shared Ultra runtime`

### Task 4: Claude Code plugin adapter and explicit surfaces

**Delivers:** Claude Code can validate and load Ultra Instinct as a marketplace plugin, inject guided context, track tools, continue once in strict mode, and expose explicit commands and specialist agents.

**Requirement coverage:** Claude portion of 2, 4, 6, 8, 11, and 14; native installation portion of 15.

**Files:**
- Create: `.claude-plugin/plugin.json`
- Create: `.claude-plugin/marketplace.json`
- Create: `hooks/hooks.json`
- Create: `hooks/dispatch.mjs`
- Create: `adapters/claude.mjs`
- Create: `runtime/surfaces.mjs`
- Create: `commands/brainstorm.md`
- Create: `commands/design-spec.md`
- Create: `commands/plan.md`
- Create: `commands/execute.md`
- Create: `commands/verify.md`
- Create: `commands/finish.md`
- Create: `agents/reviewer.md`
- Create: `agents/debugger.md`
- Create: `validation/claude.mjs`
- Create: `tests/fixtures/claude/session-start.json`
- Create: `tests/fixtures/claude/post-bash-success.json`
- Create: `tests/fixtures/claude/stop.json`
- Create: `tests/fixtures/claude/session-end.json`
- Create: `tests/adapters/claude.test.mjs`
- Create: `tests/runtime/surfaces.test.mjs`
- Create: `tests/static/claude-package.test.mjs`
- Modify: `validation/cli.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `handleRuntimeEvent()` from Task 3 and the canonical router from Task 2.
- Produces: `normalizeClaudeEvent(input, env): RuntimeEvent` and `encodeClaudeDecision(eventName, decision): object | null` from `adapters/claude.mjs`.
- Produces: `SURFACES.commands` with six `{ name, skill, description }` entries and `SURFACES.agents` with reviewer/debugger metadata from `runtime/surfaces.mjs`.
- Produces: `dispatchHook({ stdin, env }): Promise<{ stdout: string, stderr: string, exitCode: number }>` from `hooks/dispatch.mjs`.
- Produces package script: `npm run validate:claude`.

**References:**
- [Claude Code plugin reference](https://code.claude.com/docs/en/plugins-reference)
- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- [Claude Code plugin validation](https://code.claude.com/docs/en/plugins-reference#test-your-plugins-locally)

**Approach:** Start with recorded fixture tests for every active native payload and expected output. The shared `hooks/hooks.json` registers synchronous `SessionStart`, `PostToolUse`, `Stop`, and `SessionEnd` commands using `node "${CLAUDE_PLUGIN_ROOT}/hooks/dispatch.mjs"`, explicit matchers, two-second timeouts, and bounded additional context. Claude normalization maps startup/resume/clear/compact sources, successful native edit tools, Bash results, `stop_hook_active`, and session end into the runtime contract. Stop encoding uses Claude's supported block/continue shape only when `strict` requests continuation. Commands contain only enough text to load their named canonical skill. Agent prompts load `request-review` or `systematic-debugging`; they do not duplicate methodology.

**Verify:**

```bash
npm test -- tests/adapters/claude.test.mjs tests/runtime/surfaces.test.mjs tests/static/claude-package.test.mjs
npm run validate:claude
claude plugin validate .
```

**Done when:** Claude validation passes; each fixture produces valid native JSON; guided SessionStart contains the compact router once; compact SessionStart restores it; tool events update only fact state; strict Stop blocks once and respects `stop_hook_active`; commands and agents resolve existing skills; and adapter failures return valid fail-open output.

**Commit:** `feat: add Claude Code runtime support`

### Task 5: Codex plugin adapter and compatibility marketplace

**Delivers:** Codex can discover Ultra Instinct through the Agent Plugins root plus its current compatibility manifest, load shared hooks, and apply the same runtime policy with Codex-native payloads.

**Requirement coverage:** Codex portion of 2, 4, 6, 8, 11, and 14; native installation portion of 15.

**Files:**
- Create: `.codex-plugin/plugin.json`
- Create: `.agents/plugins/marketplace.json`
- Create: `adapters/codex.mjs`
- Create: `validation/codex.mjs`
- Create: `tests/fixtures/codex/session-start.json`
- Create: `tests/fixtures/codex/post-bash-success.json`
- Create: `tests/fixtures/codex/stop.json`
- Create: `tests/fixtures/codex/session-end.json`
- Create: `tests/adapters/codex.test.mjs`
- Create: `tests/static/codex-package.test.mjs`
- Modify: `hooks/dispatch.mjs`
- Modify: `validation/cli.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `handleRuntimeEvent()`, `hooks/hooks.json`, and `dispatchHook()` from Tasks 3–4.
- Produces: `normalizeCodexEvent(input, env): RuntimeEvent` and `encodeCodexDecision(eventName, decision): object | null` from `adapters/codex.mjs`.
- Extends: `dispatchHook()` selects Codex when the hook environment supplies `PLUGIN_ROOT` and the common input supplies Codex's `model` field; otherwise it retains Claude behavior.
- Produces: `validateCodexPackage(pluginRoot: string): { errors: string[] }` and package script `npm run validate:codex`.

**References:**
- [Official Codex plugin guide](https://learn.chatgpt.com/docs/build-plugins)
- [Official Codex hooks reference](https://learn.chatgpt.com/docs/hooks)
- [Codex manifest discovery source](https://github.com/openai/codex/blob/eb752e43d9b7bd7dc5965ea20642bcf7f1a492d8/codex-rs/utils/plugins/src/plugin_namespace.rs)
- [Codex plugin hook-root environment](https://github.com/openai/codex/blob/eb752e43d9b7bd7dc5965ea20642bcf7f1a492d8/codex-rs/hooks/src/engine/discovery.rs)

**Approach:** Write Codex fixture and package tests before the adapter. Keep the root Agent Plugins manifest canonical; `.codex-plugin/plugin.json` contains only currently accepted compatibility fields and relies on default `hooks/hooks.json` discovery. `.agents/plugins/marketplace.json` names one local `ultra-instinct` plugin with explicit installation/authentication policy and Productivity category. The adapter maps Codex's common `session_id`, `cwd`, `model`, `turn_id`, `apply_patch`, Bash, `tool_response`, and `stop_hook_active` fields without reading `transcript_path`. Codex Stop output uses `decision: "block"` and `reason` only for the bounded strict continuation. Static validation checks strict semver, metadata parity, safe relative component roots, default hook discovery, and the marketplace source path because the released CLI has no standalone plugin-validate command.

**Verify:**

```bash
npm test -- tests/adapters/codex.test.mjs tests/static/codex-package.test.mjs
npm run validate:codex
npm run check
```

**Done when:** Both root and compatibility manifests agree; Codex package fixtures pass; hooks are discovered from the default location; Codex-specific fields normalize correctly; transcript content is never read; strict Stop continues exactly once; guided mode never blocks; and Claude adapter tests remain green against the shared hook declaration.

**Commit:** `feat: add Codex runtime support`

### Task 6: OpenCode plugin adapter, commands, and agents

**Delivers:** OpenCode can install the Git package, discover the canonical skills, inject and restore the router, track tool outcomes, and perform one guarded strict continuation from `session.idle`.

**Requirement coverage:** OpenCode portion of 2, 4, 6, 8, 11, 14, and 15.

**Files:**
- Create: `.opencode/index.mjs`
- Create: `adapters/opencode.mjs`
- Create: `validation/opencode.mjs`
- Create: `tests/fixtures/opencode/tool-after.json`
- Create: `tests/fixtures/opencode/file-edited.json`
- Create: `tests/fixtures/opencode/session-idle.json`
- Create: `tests/fixtures/opencode/session-deleted.json`
- Create: `tests/adapters/opencode.test.mjs`
- Create: `tests/static/opencode-package.test.mjs`
- Modify: `validation/cli.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `handleRuntimeEvent()` from Task 3 and `SURFACES` from Task 4.
- Produces: default export and named `UltraInstinctPlugin(ctx): Promise<OpenCodeHooks>` from `.opencode/index.mjs`.
- Produces: `registerOpenCodeConfig(config, pluginRoot): void`, `normalizeOpenCodeEvent(event, context): RuntimeEvent`, and `applyOpenCodeDecision(decision, context): Promise<void>` from `adapters/opencode.mjs`.
- Produces package main/export entry: `.opencode/index.mjs` and package script `npm run validate:opencode`.

**References:**
- [OpenCode plugin reference](https://opencode.ai/docs/plugins/)
- [OpenCode SDK `session.prompt`](https://opencode.ai/docs/sdk/)
- [`@opencode-ai/sdk` 1.2.15 package](https://www.npmjs.com/package/@opencode-ai/sdk/v/1.2.15) — generated types installed alongside the validated OpenCode 1.18.15 use the flat `session.prompt({ sessionID, parts })` signature.
- [Superpowers OpenCode adapter](https://github.com/obra/superpowers/blob/44c9b2d6e889982ac18c27d05a19fefe335194e1/.opencode/plugins/superpowers.js)

**Approach:** Build the adapter against a fake OpenCode context before loading the real plugin entry. The config hook appends the repository `skills/` path exactly once and registers the six commands plus reviewer/debugger definitions from `SURFACES`. `experimental.chat.messages.transform` prepends the marked router to the first user message and deduplicates repeated transforms. `experimental.session.compacting` appends fact-only state to `output.context` without replacing OpenCode's prompt. The post-execution handler normalizes successful tool facts. One general `event` handler dispatches `file.edited`, `session.idle`, and `session.deleted` by `event.type`, matching OpenCode's documented session-event shape. On the first strict unverified idle event, call `client.session.prompt` for that session with one continuation request; never call it again for the same dirty cycle. Guided mode logs or shows a warning without continuing. Session deletion removes state. SDK or plugin errors warn and leave OpenCode running.

**Verify:**

```bash
npm test -- tests/adapters/opencode.test.mjs tests/static/opencode-package.test.mjs
npm run validate:opencode
npm run check
```

**Done when:** A fake OpenCode session proves single skill-path registration, single bootstrap injection, compaction restoration, command/agent registration, mutation and verification tracking, one guarded strict continuation, cleanup, and fail-open SDK errors; the Git package main resolves without a build step or production dependency.

**Commit:** `feat: add OpenCode runtime support`

### Task 7: Cross-client behavior evaluation and operator documentation

**Delivers:** Maintainers can install every supported mode, run the same repeated scenarios against all three real clients, compare `lite` with `guided`, and produce an evidence report that enforces the approved thresholds.

**Requirement coverage:** 2, 5, 15, 17; all release, documentation, and live behavior gates.

**Files:**
- Create: `docs/runtime.md`
- Create: `evals/scenarios.json`
- Create: `evals/contracts.mjs`
- Create: `evals/run.mjs`
- Create: `evals/trace.mjs`
- Create: `evals/grade.mjs`
- Create: `evals/compare.mjs`
- Create: `evals/report.mjs`
- Create: `evals/clients/claude.mjs`
- Create: `evals/clients/codex.mjs`
- Create: `evals/clients/opencode.mjs`
- Create: `evals/README.md`
- Create: `tests/evals/grade.test.mjs`
- Create: `tests/evals/compare.test.mjs`
- Create: `tests/evals/runner.test.mjs`
- Create: `tests/static/docs.test.mjs`
- Modify: `README.md`
- Modify: `.gitignore`
- Modify: `package.json`

**Interfaces:**
- Produces: `EvalScenario = { id, prompt, fixture, expectedSkill, forbiddenSkills, mutationExpected, verificationExpected, profiles }` and normalized `EvalTraceEvent` definitions from `evals/contracts.mjs`.
- Produces: client driver contract `runScenario({ scenario, profile, pluginRoot, workspace, model }): Promise<EvalTraceEvent[]>` implemented by all three client modules.
- Produces: `gradeTrace(scenario, trace): ScenarioGrade`, where routing passes only when the expected skill is loaded or announced before the first mutating tool event.
- Produces: `compareRuns(baseline, candidate): ComparisonReport` enforcing per-case, overall-positive, false-positive, and improvement thresholds.
- Produces package scripts: `npm run eval`, `npm run eval:compare`, and `npm run eval:report`.
- Produces ignored results under `.ultra-instinct/evals/`; each run creates nested directories named from its explicit label, client, and profile, containing sanitized JSON traces plus Markdown and JSON summary reports.

**References:**
- Approved spec section “Verification and release gates.”
- [Claude print mode and local plugin loading](https://code.claude.com/docs/en/cli-reference)
- [Codex app-server `selectedCapabilityRoots`](https://github.com/openai/codex/blob/eb752e43d9b7bd7dc5965ea20642bcf7f1a492d8/codex-rs/app-server/README.md#api-overview)
- [OpenCode JSON run output](https://opencode.ai/docs/cli/)

**Approach:** Write deterministic grader and comparison tests before any real model run. Encode the nine approved positive, negative, compaction, guided, and strict scenarios once in `evals/scenarios.json`; drivers normalize native streams rather than maintaining separate prompt sets. The Claude driver uses `claude -p --plugin-dir` with stream JSON, hook events, and no session persistence. The Codex driver uses an ephemeral app-server thread with `selectedCapabilityRoots` pointing directly at this plugin. The OpenCode driver creates a temporary workspace-local loader that imports `.opencode/index.mjs`, then runs `opencode run --format json`. The baseline resolves and records each client's exact active model slug. Candidate runs use `--models-from baseline`, and comparison rejects client/model mismatches. All fixture workspaces live under the operating system temporary directory and are deleted after grading; no credentials or model output enter git.

Codex workspace-write evaluation may add its temporary fixture path to Codex's trusted-project state, and OpenCode may record a temporary local session. The live runner MUST refuse these stateful cases unless the operator supplies `--allow-client-state`; dry preflight and all deterministic checks remain non-mutating. `README.md` and `docs/runtime.md` document skills-only installation, native runtime installation for each client, profile selection, trust prompts, privacy guarantees, current capability differences, supported versions, and uninstall steps. They MUST distinguish deterministic checks from paid/live model evaluations.

**Verify:**

```bash
npm run check
npm run eval -- --client all --profile lite --repeat 5 --label baseline --allow-client-state
npm run eval -- --client all --profile guided --repeat 5 --label guided --models-from baseline --allow-client-state
npm run eval -- --client all --profile strict --repeat 5 --label strict --models-from baseline --allow-client-state
npm run eval:compare -- --baseline baseline --candidate guided
npm run eval:report -- --runs baseline,guided,strict
```

**Done when:** Static and contract suites pass 100%; every positive routing case passes at least four of five runs per client; guided positive routing is at least 90% overall; false-positive routing is at most 10% overall and no more than five percentage points above baseline; a baseline below 70% improves by at least 20 percentage points; compaction and bounded strict completion pass on all three clients; the report records client/model/OS/profile versions and failure signatures; and documentation contains exact tested install and removal commands.

**Commit:** `test: add cross-client runtime acceptance`

## Requirement traceability

| Design requirement | Implemented by | Proven by |
|---|---|---|
| Agent Plugins portable core | Task 1 | Schema and layout tests |
| Claude, Codex, OpenCode first-class behavior | Tasks 4–7 | Adapter fixtures and live traces |
| One canonical `skills/` source | Tasks 1–2, 4–6 | Skill-root and package tests |
| Shared versioned runtime contract | Task 3 | Runtime contract tests |
| `lite`, `guided`, `strict` resolution | Task 3 | Profile and policy tests |
| Context-only guided mode and bounded strict mode | Tasks 3–6 | Policy and adapter tests |
| Compact canonical bootstrap | Task 2 | Marker and byte-budget tests |
| Compaction restoration | Tasks 4–7 | Adapter fixtures and live compaction scenarios |
| Fact-only private state | Task 3 | State, corruption, TTL, and privacy tests |
| No network, project mutation, model calls, or automatic checks in hooks | Tasks 3–6 | Runtime and package tests |
| Fail-open behavior | Tasks 3–6 | Forced-error tests per layer |
| User instruction precedence | Tasks 2–3 | Router and policy tests |
| Exactly thirteen skills | Task 2 | Exact-catalog test |
| Commands and reviewer/debugger agents | Tasks 4 and 6 | Surface and adapter tests |
| Skills CLI compatibility | Tasks 1, 2, and 7 | Layout tests and documented smoke command |
| License provenance | Tasks 1–2 | Notice and package validation |
| Real behavior measurement | Task 7 | Repeated cross-client report |
