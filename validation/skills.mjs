import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseScalar(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function readSkillFrontmatter(skillFile) {
  const errors = [];
  let source;
  try {
    source = readFileSync(skillFile, "utf8");
  } catch (error) {
    return { name: null, description: null, body: "", errors: [`${skillFile}: ${error.message}`] };
  }

  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { name: null, description: null, body: source, errors: [`${skillFile}: missing YAML frontmatter`] };
  }

  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (field) fields[field[1]] = parseScalar(field[2]);
  }

  const name = fields.name || null;
  const description = fields.description || null;
  if (!name) errors.push(`${skillFile}: missing name`);
  if (!description) errors.push(`${skillFile}: missing description`);
  if (name && !NAME_PATTERN.test(name)) errors.push(`${skillFile}: invalid skill name ${name}`);
  for (const key of Object.keys(fields)) {
    if (key !== "name" && key !== "description") errors.push(`${skillFile}: unsupported frontmatter field ${key}`);
  }

  return { name, description, body: source.slice(match[0].length), errors };
}

export function validateSkillLayout(pluginRoot) {
  const skillsRoot = path.join(pluginRoot, "skills");
  const errors = [];
  const names = [];
  if (!existsSync(skillsRoot)) return { names, errors: ["skills/: missing directory"] };

  for (const folder of readdirSync(skillsRoot).sort()) {
    const folderPath = path.join(skillsRoot, folder);
    if (!statSync(folderPath).isDirectory()) {
      errors.push(`skills/${folder}: skill entries must be directories`);
      continue;
    }
    const skillFile = path.join(folderPath, "SKILL.md");
    if (!existsSync(skillFile)) {
      errors.push(`skills/${folder}: missing SKILL.md`);
      continue;
    }
    const skill = readSkillFrontmatter(skillFile);
    errors.push(...skill.errors);
    if (skill.name !== folder) errors.push(`skills/${folder}: frontmatter name must match folder`);
    if (skill.name) names.push(skill.name);
  }

  if (new Set(names).size !== names.length) errors.push("skills/: duplicate skill names");
  return { names, errors };
}
