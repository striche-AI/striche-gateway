// src/commands/generate.ts
import path from "path";
import fs from "fs-extra";
import { parseSpecAndGetOperations } from "../parser/swagger.parser";
import { mapOpenApiToCanonical } from "../model/mapper";
import { CanonicalModel } from "../model/canonical";
import { buildTerraformContext } from "../adapters/terraform-aws/context-builder";
import { loadTemplates } from "../render/template-loader";
import { renderAll } from "../render/renderer";
import { logger } from "../utils/logger";

/**
 * Options for generation
 */
export type GenerateOpts = {
  specPath: string;              // path to swagger/openapi file (yaml | json)
  outDir: string;                // output directory for generated Terraform files
  templateDir?: string;          // templates root directory (optional, default: ./templates)
  serviceMap?: Record<string, string>; // optional override mapping first path segment -> upstream URL
  force?: boolean;               // if true, overwrite existing outDir
};

/**
 * Generate Terraform files from an OpenAPI/Swagger spec.
 * Returns an object with outDir and list of service names generated.
 */
export async function generateFromSpec(opts: GenerateOpts) {
  const templateDir = opts.templateDir || path.resolve(process.cwd(), "templates");
  const outDir = path.resolve(opts.outDir);
  logger.info(`Generate: spec=${opts.specPath} -> out=${outDir}, templates=${templateDir}`);

  // 1) parse and validate the spec (bundles refs and validates)
  let parsed: { normalized: any; operations: any[] };
  try {
    parsed = await parseSpecAndGetOperations(opts.specPath);
    logger.info(`Parsed spec OK. Found ${parsed.operations.length} operations.`);
  } catch (err: any) {
    logger.error("Failed to parse/validate spec:", err?.message || String(err));
    throw err;
  }

  // 2) map to canonical model
  let canonical: CanonicalModel;
  try {
    canonical = mapOpenApiToCanonical(parsed.normalized, { serviceMap: opts.serviceMap });
    logger.info(`Mapped to canonical model: ${canonical.services.length} services, ${canonical.routes.length} routes.`);
  } catch (err: any) {
    logger.error("Error mapping spec to canonical model:", err?.message || String(err));
    throw err;
  }

  // 3) build render context for Terraform (AWS)
  let context: any;
  try {
    context = buildTerraformContext(canonical);
    // ensure region exists on context
    context.aws_region = context.aws_region || process.env.AWS_REGION || "us-east-1";
  } catch (err: any) {
    logger.error("Error building Terraform context:", err?.message || String(err));
    throw err;
  }

  // 4) ensure outDir and guard overwrite
  try {
    const exists = await fs.pathExists(outDir);
    if (exists && !opts.force) {
      // prefer not to clobber by default
      logger.warn(`Output dir ${outDir} already exists. Use { force: true } or remove the directory to overwrite.`);
      throw new Error(`Output directory exists: ${outDir}`);
    }
    await fs.ensureDir(outDir);
  } catch (err: any) {
    logger.error("Error preparing output directory:", err?.message || String(err));
    throw err;
  }

  // 5) load templates
  let templates: any;
  try {
    templates = await loadTemplates(templateDir);
  } catch (err: any) {
    logger.error("Failed to load templates:", err?.message || String(err));
    throw err;
  }

  // 6) render templates and write files
  try {
    await renderAll(templates, context, outDir);

    // additionally ensure terraform.tfvars.json is present (renderer already writes it,
    // but keep this as a safeguard)
    const tfvarsPath = path.join(outDir, "terraform.tfvars.json");
    const tfvarsPayload = {
      services: context.services,
      aws_region: context.aws_region,
    };
    await fs.writeFile(tfvarsPath, JSON.stringify(tfvarsPayload, null, 2), "utf8");

    logger.info("Generation completed successfully.");
  } catch (err: any) {
    logger.error("Failed rendering templates or writing files:", err?.message || String(err));
    throw err;
  }

  return {
    outDir,
    services: canonical.services.map((s) => s.name),
  };
}
