import { spawn, spawnSync } from "node:child_process";
import readline from "node:readline";

import { normalizeNativeEvent, sanitizeTrace } from "../trace.mjs";

export function commandVersion(command) {
  const result = spawnSync(command, ["--version"], { encoding: "utf8", timeout: 10_000 });
  return result.status === 0 ? result.stdout.trim().slice(0, 120) : "unknown";
}

export function runJsonCommand(command, args, { client, cwd, env, timeoutMs = 600_000, onValue } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const events = [];
    let diagnosticLines = 0;
    let settled = false;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${client} evaluation timed out.`));
    }, timeoutMs);
    const lines = readline.createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      try {
        const value = JSON.parse(line);
        onValue?.(value);
        normalizeNativeEvent(value, { client, events });
      } catch {
        diagnosticLines += 1;
      }
    });
    child.stderr.on("data", (chunk) => {
      diagnosticLines += String(chunk).split(/\r?\n/).filter(Boolean).length;
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`${client} CLI could not start (${error.code ?? "unknown error"}).`));
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      lines.close();
      if (code !== 0) {
        reject(new Error(`${client} CLI exited with code ${code}; ${diagnosticLines} diagnostic lines were withheld.`));
        return;
      }
      resolve(sanitizeTrace(events));
    });
  });
}
