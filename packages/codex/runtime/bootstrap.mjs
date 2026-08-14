import { readFile } from "node:fs/promises";
import path from "node:path";

export const BOOTSTRAP_MARKER = "<!-- ultra-instinct:bootstrap:v2 -->";
export const BOOTSTRAP_BUDGET = 2400;

function stripFrontmatter(source) {
  const match = source.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (!match) throw new Error("using-ultra-instinct is missing frontmatter");
  return source.slice(match[0].length).trim();
}

export async function loadBootstrap(pluginRoot) {
  const file = path.join(pluginRoot, "skills/using-ultra-instinct/SKILL.md");
  let source;
  try {
    source = await readFile(file, "utf8");
  } catch (error) {
    throw new Error(`using-ultra-instinct could not be loaded: ${error.code ?? "read error"}`);
  }
  const context = stripFrontmatter(source);
  const markerCount = context.split(BOOTSTRAP_MARKER).length - 1;
  if (markerCount !== 1) throw new Error("using-ultra-instinct must contain one bootstrap marker");
  if (Buffer.byteLength(context, "utf8") > BOOTSTRAP_BUDGET) {
    throw new Error(`using-ultra-instinct exceeds ${BOOTSTRAP_BUDGET} bytes`);
  }
  return { marker: BOOTSTRAP_MARKER, context };
}
