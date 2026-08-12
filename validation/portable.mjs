import { readFile } from "node:fs/promises";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";

function formatAjvError(error) {
  const where = error.instancePath || "manifest";
  return `${where} ${error.message}`;
}

export async function validatePortablePlugin(pluginRoot) {
  const errors = [];
  let manifest = null;

  try {
    manifest = JSON.parse(await readFile(path.join(pluginRoot, "plugin.json"), "utf8"));
  } catch (error) {
    return { manifest: null, errors: [`plugin.json: ${error.message}`] };
  }

  try {
    const schema = JSON.parse(
      await readFile(path.join(pluginRoot, "schemas/agent-plugins/1.0.0/plugin.schema.json"), "utf8"),
    );
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    const validate = ajv.compile(schema);
    if (!validate(manifest)) {
      errors.push(...(validate.errors ?? []).map(formatAjvError));
    }
  } catch (error) {
    errors.push(`portable schema: ${error.message}`);
  }

  return { manifest, errors };
}
