const NATIVE_MUTATIONS = new Set([
  "apply_patch",
  "edit",
  "multiedit",
  "notebookedit",
  "patch",
  "write",
  "file.edit",
  "file.write",
  "file.edited",
]);

const VERIFICATIONS = [
  [/^(?:npm|pnpm|bun)\s+(?:run\s+)?(test|check|typecheck|lint|build)(?:\s|$)/i, (match) => match[1].toLowerCase()],
  [/^yarn\s+(?:run\s+)?(test|check|typecheck|lint|build)(?:\s|$)/i, (match) => match[1].toLowerCase()],
  [/^(?:python\s+-m\s+)?pytest(?:\s|$)/i, () => "pytest"],
  [/^cargo\s+test(?:\s|$)/i, () => "cargo-test"],
  [/^go\s+test(?:\s|$)/i, () => "go-test"],
  [/^dotnet\s+test(?:\s|$)/i, () => "dotnet-test"],
  [/^mvn(?:\s+[^;&|]+)*\s+verify(?:\s|$)/i, () => "maven-verify"],
  [/^(?:gradle|\.\/gradlew)\s+test(?:\s|$)/i, () => "gradle-test"],
  [/^swift\s+test(?:\s|$)/i, () => "swift-test"],
  [/^xcodebuild(?:\s+[^;&|]+)*\s+test(?:\s|$)/i, () => "xcodebuild-test"],
  [/^make\s+test(?:\s|$)/i, () => "make-test"],
  [/^git\s+diff\s+--check(?:\s|$)/i, () => "diff-check"],
];

const SHELL_MUTATION = /^(?:touch|mkdir|mv|cp|install)\s|^(?:sed\s+[^;&|]*\s-i|perl\s+-pi)\b|(?:^|\s)(?:>|>>|tee\s)/i;

function commandFrom(input) {
  if (typeof input === "string") return input.trim();
  if (input && typeof input === "object" && typeof input.command === "string") return input.command.trim();
  return "";
}

export function classifyTool(tool) {
  if (!tool || tool.success !== true) return { mutation: false, verificationKind: null };
  const normalizedName = String(tool.name ?? "").toLowerCase();
  if (NATIVE_MUTATIONS.has(normalizedName)) return { mutation: true, verificationKind: null };

  if (["bash", "shell", "sh"].includes(normalizedName)) {
    const command = commandFrom(tool.input);
    for (const [pattern, kind] of VERIFICATIONS) {
      const match = command.match(pattern);
      if (match) return { mutation: false, verificationKind: kind(match) };
    }
    if (SHELL_MUTATION.test(command)) return { mutation: true, verificationKind: null };
  }

  return { mutation: false, verificationKind: null };
}
