import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";

import { normalizeNativeEvent, sanitizeTrace } from "../trace.mjs";

function commandVersion() {
  const result = spawnSync("codex", ["--version"], { encoding: "utf8", timeout: 10_000 });
  return result.status === 0 ? result.stdout.trim().slice(0, 120) : "unknown";
}

export function codexCapabilityRoot(pluginRoot) {
  return path.join(pluginRoot, "packages/codex");
}

export async function runScenario({ scenario, profile, pluginRoot, workspace, model }) {
  const child = spawn("codex", ["app-server", "--stdio"], {
    cwd: workspace,
    env: {
      ...process.env,
      ULTRA_INSTINCT_PROFILE: profile,
      ULTRA_INSTINCT_STATE_DIR: path.join(workspace, ".ultra-instinct", "runtime"),
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const events = [];
  const pending = new Map();
  let nextId = 1;
  let diagnostics = 0;
  const lines = readline.createInterface({ input: child.stdout });
  const exited = new Promise((resolve) => child.once("close", resolve));
  child.once("close", () => {
    for (const waiter of pending.values()) waiter.reject(new Error(`Codex app-server exited during ${waiter.method}.`));
    pending.clear();
  });
  child.once("error", () => {
    for (const waiter of pending.values()) waiter.reject(new Error(`Codex app-server could not start during ${waiter.method}.`));
    pending.clear();
  });
  child.stderr.on("data", (chunk) => {
    diagnostics += String(chunk).split(/\r?\n/).filter(Boolean).length;
  });
  lines.on("line", (line) => {
    let value;
    try {
      value = JSON.parse(line);
    } catch {
      diagnostics += 1;
      return;
    }
    normalizeNativeEvent(value, { client: "codex", events });
    if (value.id !== undefined && (Object.hasOwn(value, "result") || Object.hasOwn(value, "error"))) {
      const waiter = pending.get(value.id);
      if (waiter) {
        pending.delete(value.id);
        if (value.error) waiter.reject(new Error(`Codex app-server rejected ${waiter.method}.`));
        else waiter.resolve(value.result);
      }
      return;
    }
    if (value.id !== undefined && value.method) {
      child.stdin.write(`${JSON.stringify({ id: value.id, error: { code: -32601, message: "Unsupported in eval" } })}\n`);
    }
  });

  function request(method, params) {
    const id = nextId;
    nextId += 1;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject, method });
      child.stdin.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }

  const timeout = setTimeout(() => child.kill("SIGTERM"), 600_000);
  try {
    await request("initialize", {
      clientInfo: { name: "ultra-instinct-eval", title: "Ultra Instinct Eval", version: "2.0.0" },
      capabilities: { experimentalApi: true, requestAttestation: false },
    });
    child.stdin.write(`${JSON.stringify({ method: "initialized" })}\n`);
    const started = await request("thread/start", {
      ...(model ? { model } : {}),
      cwd: workspace,
      runtimeWorkspaceRoots: [workspace],
      approvalPolicy: "never",
      sandbox: "workspace-write",
      ephemeral: true,
      selectedCapabilityRoots: [{
        id: "ultra-instinct",
        location: { type: "environment", environmentId: "local", path: codexCapabilityRoot(pluginRoot) },
      }],
      experimentalRawEvents: true,
    });
    const threadID = started.thread.id;
    await request("turn/start", {
      threadId: threadID,
      input: [{ type: "text", text: scenario.prompt, text_elements: [] }],
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Codex turn did not complete.")), 540_000);
      const poll = setInterval(() => {
        if (events.some((event) => event.type === "result")) {
          clearInterval(poll);
          clearTimeout(timer);
          resolve();
        }
      }, 50);
    });

    if (scenario.id === "compaction-state") {
      await request("thread/compact/start", { threadId: threadID });
      const snapshot = await request("thread/read", { threadId: threadID, includeTurns: true });
      const restored = JSON.stringify(snapshot).includes("ultra-instinct:bootstrap:v2");
      const compact = [...events].reverse().find((event) => event.type === "compaction");
      if (compact) compact.bootstrapRestored = restored;
      else events.push({ type: "compaction", bootstrapRestored: restored, sequence: events.length });
    }

    const trace = sanitizeTrace(events);
    const metadata = trace.find((event) => event.type === "client");
    Object.assign(metadata, {
      model: started.model,
      version: commandVersion(),
      os: `${os.platform()}-${os.arch()}`,
      profile,
    });
    return trace;
  } catch (error) {
    throw new Error(`${error.message} (${diagnostics} diagnostic lines withheld).`);
  } finally {
    clearTimeout(timeout);
    lines.close();
    child.stdin.end();
    child.kill("SIGTERM");
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 1_000))]);
  }
}
