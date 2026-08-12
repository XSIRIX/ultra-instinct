import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { createInitialState, isRuntimeState } from "./contracts.mjs";

const MAX_STATE_BYTES = 4096;
const STATE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function resolveStateDir(workspace = null) {
  if (process.env.ULTRA_INSTINCT_STATE_DIR) return process.env.ULTRA_INSTINCT_STATE_DIR;
  if (workspace) return path.join(workspace, ".ultra-instinct", "runtime");
  return path.join(os.tmpdir(), "ultra-instinct-runtime");
}

function fileName(key) {
  return `${createHash("sha256").update(String(key)).digest("hex")}.json`;
}

export function createStateStore({ stateDir = resolveStateDir(), clock = Date.now, warningSink = () => {} } = {}) {
  const warned = new Set();
  const warn = (category, message) => {
    if (warned.has(category)) return;
    warned.add(category);
    warningSink(message);
  };
  const ensureDirectory = () => {
    const artifactRoot = path.dirname(stateDir);
    if (path.basename(artifactRoot) === ".ultra-instinct") {
      mkdirSync(artifactRoot, { recursive: true, mode: 0o700 });
      try {
        writeFileSync(path.join(artifactRoot, ".gitignore"), "*\n", { flag: "wx", mode: 0o600 });
      } catch (error) {
        if (error.code !== "EEXIST") {
          warn("artifact-ignore", "Ultra Instinct: local artifact ignore file could not be created.");
        }
      }
    }
    mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    try { chmodSync(stateDir, 0o700); } catch {}
  };
  const targetFor = (key) => path.join(stateDir, fileName(key));

  return {
    read(key) {
      const target = targetFor(key);
      if (!existsSync(target)) return createInitialState();
      try {
        const raw = readFileSync(target, "utf8");
        if (Buffer.byteLength(raw, "utf8") > MAX_STATE_BYTES) throw new Error("oversized state");
        const state = JSON.parse(raw);
        if (!isRuntimeState(state)) throw new Error("unsupported state");
        return state;
      } catch {
        warn("read", "Ultra Instinct: state was unreadable and has been reset.");
        try { unlinkSync(target); } catch {}
        return createInitialState();
      }
    },
    write(key, state) {
      if (!isRuntimeState(state)) {
        warn("contract", "Ultra Instinct: non-fact state was rejected.");
        return false;
      }
      const encoded = JSON.stringify(state);
      if (Buffer.byteLength(encoded, "utf8") > MAX_STATE_BYTES) {
        warn("size", "Ultra Instinct: state exceeded 4 KiB and was not saved.");
        return false;
      }
      try {
        ensureDirectory();
        const target = targetFor(key);
        const temporary = `${target}.${process.pid}.tmp`;
        writeFileSync(temporary, encoded, { mode: 0o600 });
        renameSync(temporary, target);
        try { chmodSync(target, 0o600); } catch {}
        return true;
      } catch {
        warn("write", "Ultra Instinct: state could not be saved; continuing without persistence.");
        return false;
      }
    },
    delete(key) {
      try { unlinkSync(targetFor(key)); } catch (error) {
        if (error.code !== "ENOENT") warn("delete", "Ultra Instinct: state cleanup failed open.");
      }
    },
    cleanup() {
      if (!existsSync(stateDir)) return;
      try {
        for (const entry of readdirSync(stateDir)) {
          if (!entry.endsWith(".json")) continue;
          const target = path.join(stateDir, entry);
          if (clock() - statSync(target).mtimeMs > STATE_TTL_MS) unlinkSync(target);
        }
      } catch {
        warn("cleanup", "Ultra Instinct: stale-state cleanup failed open.");
      }
    },
  };
}
