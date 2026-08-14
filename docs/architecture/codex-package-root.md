# Codex package root

## Summary

Codex installs Ultra Instinct from `packages/codex`, while the repository root remains the portable Agent Plugins, Claude Code, and OpenCode package.

Codex 0.147 treats a root Agent Plugins `plugin.json` as authoritative and does not load the legacy `.codex-plugin` hook declaration beside it. The dedicated Codex root intentionally has no root `plugin.json`, so Codex discovers its skills and four lifecycle hooks from `.codex-plugin/plugin.json`.

The shared dispatcher identifies Codex from its `PLUGIN_ROOT` environment. It must not depend on the payload's `model` field because Codex 0.147 omits that field from `SessionEnd`.

## Maintenance

The repository-root adapters, hooks, runtime, and skills remain canonical. Run `npm run sync:codex` after changing them. Codex validation compares the generated package byte-for-byte with those sources and rejects stale copies.

## Verification

- Codex CLI 0.147.0 installed the local marketplace package and reported four hooks needing review.
- The Codex Desktop bundled CLI 0.147.0-alpha.6.5 reported the same four hooks from an isolated install.
- Claude Code 2.1.227 accepted the unchanged Claude marketplace.
- OpenCode 1.18.16 package and adapter validation passed.
- `npm run check` passed 116 tests, and the npm dry-run package included the dedicated Codex manifest, hooks, runtime, and skills.

## Limitation

The fix remains local until a new package version is published and users reinstall or upgrade Ultra Instinct.
