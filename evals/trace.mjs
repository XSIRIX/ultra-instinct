import { classifyTool } from "../runtime/classify.mjs";

export const SKILL_NAMES = Object.freeze([
  "brainstorm",
  "execute-plan",
  "finish-branch",
  "grilling",
  "isolate-work",
  "mockup",
  "receiving-code-review",
  "request-review",
  "systematic-debugging",
  "tdd",
  "using-ultra-instinct",
  "verification-before-completion",
  "write-design-spec",
  "write-plan",
]);

const MUTATION_NAMES = new Set(["apply_patch", "edit", "filechange", "multiedit", "patch", "write"]);
const READ_NAMES = new Set(["glob", "grep", "list", "read", "search"]);

function record(events, event) {
  events.push({ ...event, sequence: events.length });
}

function stringsAt(value, keyPattern, output = []) {
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string" && keyPattern.test(key)) output.push(child);
    else if (child && typeof child === "object") stringsAt(child, keyPattern, output);
  }
  return output;
}

function modelFrom(value) {
  const direct = stringsAt(value, /^model$/i)[0];
  if (direct) return direct;
  const modelID = stringsAt(value, /^model_?id$/i)[0];
  const providerID = stringsAt(value, /^provider_?id$/i)[0];
  if (modelID && providerID && !modelID.includes("/")) return `${providerID}/${modelID}`;
  return modelID ?? null;
}

function exactSkill(candidate) {
  const normalized = String(candidate).toLowerCase().replace(/^\//, "");
  return SKILL_NAMES.find((skill) => normalized === skill || normalized.endsWith(`:${skill}`)) ?? null;
}

function assistantTextIsVisible(value) {
  const method = String(value.method ?? value.type ?? "");
  const item = value.params?.item ?? value.item;
  return value.type === "assistant" ||
    value.message?.role === "assistant" ||
    item?.type === "agentMessage" ||
    (value.type === "text" && value.part?.type === "text") ||
    /^item\/(?:agentMessage)/i.test(method);
}

function findSkill(value) {
  const toolNames = stringsAt(value, /^(tool|tool_name|name)$/i);
  const isSkillTool = toolNames.some((candidate) => /^skill$/i.test(candidate));
  if (isSkillTool) {
    for (const candidate of stringsAt(value, /^(skill|name|command)$/i)) {
      const skill = exactSkill(candidate);
      if (skill) return { skill, action: "loaded" };
    }
  }
  for (const candidate of stringsAt(value, /^skill$/i)) {
    const skill = exactSkill(candidate);
    if (skill) return { skill, action: "loaded" };
  }
  if (!assistantTextIsVisible(value)) return null;
  for (const candidate of stringsAt(value, /^text$/i)) {
    const announced = SKILL_NAMES.find((skill) =>
      new RegExp(`(?:using|loading|following|use)\\s+(?:the\\s+)?${skill.replaceAll("-", "[- ]")}(?:\\s+skill)?`, "i")
        .test(candidate),
    );
    if (announced) return { skill: announced, action: "announced" };
  }
  return null;
}

function findToolNode(value) {
  if (!value || typeof value !== "object") return null;
  const type = String(value.type ?? "").toLowerCase();
  if (["commandexecution", "filechange", "tool_use", "tooluse"].includes(type) ||
      typeof value.tool_name === "string" || typeof value.tool === "string") return value;
  for (const child of Object.values(value)) {
    if (!child || typeof child !== "object") continue;
    if (Array.isArray(child)) {
      for (const entry of child) {
        const found = findToolNode(entry);
        if (found) return found;
      }
    } else {
      const found = findToolNode(child);
      if (found) return found;
    }
  }
  return null;
}

function toolShape(value) {
  const item = findToolNode(value);
  if (!item) return null;
  const type = String(item?.type ?? value?.type ?? "").toLowerCase();
  let name = item?.name ?? item?.tool ?? value?.tool_name ?? value?.tool ?? value?.input?.tool;
  if (type === "filechange" || type.includes("file_change")) name = "fileChange";
  if (type === "commandexecution" || type.includes("command_execution")) name = "Bash";
  if (typeof name !== "string") return null;
  const normalized = name.toLowerCase().replaceAll(/[^a-z_]/g, "");
  if (normalized === "skill") return { name, category: "other", success: true };
  const command = item?.command ?? item?.input?.command ?? item?.state?.input?.command ??
    value?.input?.command ?? value?.tool_input?.command ?? value?.input?.args?.command;
  const status = String(item?.status ?? value?.status ?? value?.part?.state?.status ?? "").toLowerCase();
  const method = String(value.method ?? value.type ?? value.hook_event_name ?? "");
  const completed = /completed|posttooluse|tool\.execute\.after/i.test(method) ||
    ["completed", "success", "failed", "error", "rejected", "denied"].includes(status);
  const exitCode = item?.exitCode ?? item?.exit_code ?? value?.exitCode ?? value?.exit_code;
  const success = completed && !["failed", "error", "rejected", "denied"].includes(status) &&
    (!Number.isInteger(exitCode) || exitCode === 0) && value?.is_error !== true;
  const nativeId = item?.id ?? item?.callID ?? item?.call_id ?? item?.tool_use_id ?? null;
  const classified = classifyTool({ name, input: command ? { command } : {}, success });
  if (classified.verificationKind) {
    return { name: classified.verificationKind, category: "verification", success, nativeId };
  }
  if (classified.mutation || MUTATION_NAMES.has(normalized)) {
    return { name: normalized, category: "mutation", success, nativeId };
  }
  if (READ_NAMES.has(normalized)) return { name: normalized, category: "read", success, nativeId };
  return { name: normalized || "other", category: "other", success, nativeId };
}

export function normalizeNativeEvent(value, { client, events = [] } = {}) {
  if (!value || typeof value !== "object") return events;
  const method = String(value.method ?? value.type ?? value.hook_event_name ?? "");

  if (!events.some((event) => event.type === "client")) {
    const model = modelFrom(value);
    record(events, { type: "client", client, model });
  } else {
    const clientEvent = events.find((event) => event.type === "client");
    if (!clientEvent.model) clientEvent.model = modelFrom(value);
  }

  const routed = findSkill(value);
  if (routed && !events.some((event) => event.type === "skill" && event.skill === routed.skill)) {
    record(events, { type: "skill", ...routed });
  }

  const tool = toolShape(value);
  if (tool && !/^item\/(?:agentMessage|reasoning)/i.test(method)) {
    const existing = tool.nativeId
      ? events.find((event) => event.type === "tool" && event._nativeId === tool.nativeId)
      : null;
    if (existing) {
      existing.success ||= tool.success;
      existing.category = tool.category;
      existing.tool = tool.name;
    } else {
      record(events, {
        type: "tool",
        category: tool.category,
        tool: tool.name,
        success: tool.success,
        ...(tool.nativeId ? { _nativeId: tool.nativeId } : {}),
      });
    }
  }

  if (/compact/i.test(method)) {
    const restored = stringsAt(value, /^(context|text|content|output)$/i)
      .some((entry) => entry.includes("ultra-instinct:bootstrap:v2"));
    record(events, { type: "compaction", bootstrapRestored: restored });
  }

  if (/hook/i.test(method)) {
    const stage = stringsAt(value, /^(hook_event_name|event|name)$/i)[0] ?? method;
    record(events, { type: "hook", stage: String(stage).slice(0, 80) });
    const blocked = stringsAt(value, /^(decision|status|reason)$/i).some((entry) => /block|verification/i.test(entry));
    if (blocked && /stop|complet/i.test(JSON.stringify(value, (_key, child) =>
      typeof child === "string" && child.length > 200 ? child.slice(0, 200) : child))) {
      record(events, { type: "continuation", reason: "verification" });
    }
  }

  if (/turn\/completed|session\.idle|^result$/i.test(method)) {
    const failed = stringsAt(value, /^(status|subtype)$/i).some((entry) => /fail|error/i.test(entry));
    record(events, { type: "result", success: !failed });
  }
  return events;
}

export function parseJsonLines(text, options) {
  const events = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      normalizeNativeEvent(JSON.parse(line), { ...options, events });
    } catch {
      // Native CLIs may mix diagnostics into their structured stream.
    }
  }
  return events;
}

export function sanitizeTrace(trace) {
  const allowed = {
    client: ["type", "client", "model", "version", "os", "profile", "sequence"],
    skill: ["type", "skill", "action", "sequence"],
    tool: ["type", "category", "tool", "success", "sequence"],
    hook: ["type", "stage", "sequence"],
    continuation: ["type", "reason", "sequence"],
    compaction: ["type", "bootstrapRestored", "sequence"],
    result: ["type", "success", "sequence"],
  };
  return trace.map((event, index) => Object.fromEntries(
    (allowed[event.type] ?? []).filter((key) => event[key] !== undefined)
      .map((key) => [key, key === "sequence" ? index : event[key]]),
  )).filter((event) => event.type);
}
