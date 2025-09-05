import path from "path";
import fs from "fs-extra";
import { loadTemplates } from "./template-loader";
import { logger } from "../utils/logger";

/**
 * Convert a JS value to an HCL representation (basic serializer).
 * Handles: string, number, boolean, array, object (map), null.
 */
function jsToHcl(value: any, indent = 0): string {
  const pad = (n: number) => "  ".repeat(n);
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string") {
    // Escape double quotes and backslashes
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    // if array of primitives, render inline
    const elems = value.map((v) => jsToHcl(v, indent + 1));
    return `[\n${pad(indent + 1)}${elems.join(`,\n${pad(indent + 1)}`)}\n${pad(indent)}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    const lines: string[] = [];
    for (const k of keys) {
      const v = value[k];
      // HCL keys that are valid identifiers can be unquoted; otherwise quote
      const safeKey = /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(k) ? k : `"${k.replace(/"/g, '\\"')}"`;
      const hclVal = jsToHcl(v, indent + 1);
      // If the value is an object, format with newline for readability
      if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        lines.push(`${pad(indent + 1)}${safeKey} = ${hclVal}`);
      } else {
        lines.push(`${pad(indent + 1)}${safeKey} = ${hclVal}`);
      }
    }
    return `{\n${lines.join("\n")}\n${pad(indent)}}`;
  }
  // fallback
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

/**
 * Write terraform.tfvars in HCL format using the provided context.
 * We write:
 *   services = { ... }
 *   aws_region = "..."
 */
async function writeTfvarsHcl(context: any, outDir: string) {
  const tfvarsPath = path.join(outDir, "terraform.tfvars");
  const parts: string[] = [];

  // aws_region as top-level variable
  if (context.aws_region !== undefined) {
    parts.push(`aws_region = ${jsToHcl(context.aws_region, 0)}`);
  }

  // services map
  if (context.services !== undefined) {
    parts.push(`services = ${jsToHcl(context.services, 0)}`);
  }

  const content = parts.join("\n\n") + "\n";
  await fs.writeFile(tfvarsPath, content, "utf8");
  logger.info(`Wrote HCL tfvars: ${tfvarsPath}`);
}

/**
 * Render all templates with the provided context and write to outDir.
 * - root templates: provider.tf.hbs, variables.tf.hbs, main.tf.hbs, outputs.tf.hbs
 * - module templates (service): write into modules/service/
 * - write terraform.tfvars (HCL)
 */
export async function renderAll(templates: any, context: any, outDir: string) {
  const root = templates.root || {};
  const moduleT = templates.module || {};

  // provider.tf
  if (root["provider.tf.hbs"]) {
    const out = root["provider.tf.hbs"](context);
    await fs.writeFile(path.join(outDir, "provider.tf"), out, "utf8");
  }

  // variables.tf
  if (root["variables.tf.hbs"]) {
    const out = root["variables.tf.hbs"](context);
    await fs.writeFile(path.join(outDir, "variables.tf"), out, "utf8");
  }

  // main.tf
  if (root["main.tf.hbs"]) {
    const out = root["main.tf.hbs"](context);
    await fs.writeFile(path.join(outDir, "main.tf"), out, "utf8");
  }

  // outputs.tf
  if (root["outputs.tf.hbs"]) {
    const out = root["outputs.tf.hbs"](context);
    await fs.writeFile(path.join(outDir, "outputs.tf"), out, "utf8");
  }

  // modules/service
  const moduleOutDir = path.join(outDir, "modules", "service");
  await fs.ensureDir(moduleOutDir);

  for (const name of Object.keys(moduleT)) {
    const compiled = moduleT[name];
    const out = compiled(context);
    const filename = name.replace(/\.hbs$/, "");
    await fs.writeFile(path.join(moduleOutDir, filename), out, "utf8");
  }

  // write terraform.tfvars in HCL (instead of JSON)
  await writeTfvarsHcl(context, outDir);

  logger.info("Rendered root and module templates.");
}
