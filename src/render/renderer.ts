import path from "path";
import fs from "fs-extra";
import { loadTemplates } from "./template-loader";
import { logger } from "../utils/logger";

/**
 * Render all templates with the provided context and write to outDir.
 * - root templates: provider.tf.hbs, variables.tf.hbs, main.tf.hbs, outputs.tf.hbs
 * - module templates (service): write into modules/service/
 * - also write terraform.tfvars.json with the `services` map
 */
export async function renderAll(templates: any, context: any, outDir: string) {
  // root
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
    // Decide filename mapping: keep original template name without .hbs
    const filename = name.replace(/\.hbs$/, "");
    await fs.writeFile(path.join(moduleOutDir, filename), out, "utf8");
  }

  // write tfvars json (services map)
  const tfvars = {
    services: context.services,
    aws_region: context.aws_region || "us-east-1",
  };
  await fs.writeFile(path.join(outDir, "terraform.tfvars.json"), JSON.stringify(tfvars, null, 2), "utf8");

  logger.info("Rendered root and module templates.");
}
