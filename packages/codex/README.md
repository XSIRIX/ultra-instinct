# Codex package

This directory is the self-contained Codex plugin root. It intentionally has no root `plugin.json`, because Codex 0.147 treats an Agent Plugins manifest as authoritative and does not load legacy plugin hooks from it.

The manifest in `.codex-plugin/` is maintained here. The adapters, hooks, runtime, and skills are generated from the repository's canonical sources with:

```bash
npm run sync:codex
```

Codex registers `SessionStart` only. This injects the workflow router at startup, resume, clear, and compact. Mutation tracking and completion gates stay disabled because current local-command `PostToolUse` payloads do not include a trustworthy exit status.
