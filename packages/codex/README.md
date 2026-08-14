# Codex package

This directory is the self-contained Codex plugin root. It intentionally has no root `plugin.json`, because Codex 0.147 treats an Agent Plugins manifest as authoritative and does not load legacy plugin hooks from it.

The manifest in `.codex-plugin/` is maintained here. The adapters, hooks, runtime, and skills are generated from the repository's canonical sources with:

```bash
npm run sync:codex
```
