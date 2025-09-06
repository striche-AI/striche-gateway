// src/commands/generate.ts
import path from "path";
import fs from "fs-extra";
import { parseSpecAndGetOperations, NormalizedSpec } from "../parser/swagger.parser";
import { mapOpenApiToCanonical } from "../model/mapper";
import { CanonicalModel, CanonicalService, CanonicalRoute } from "../model/canonical";
import { buildTerraformContext } from "../adapters/terraform-aws/context-builder";
import { loadTemplates } from "../render/template-loader";
import { renderAll } from "../render/renderer";
import { logger } from "../utils/logger";

export type GenerateOpts = {
  specPaths: string[];            // one or more spec files
  outDir: string;
  templateDir?: string;
  serviceMap?: Record<string, string>;
  cliUpstream?: string;           // global upstream override (applies to all services)
  force?: boolean;
};

export async function generateFromSpec(opts: GenerateOpts) {
  const { specPaths, outDir, templateDir = path.resolve(process.cwd(), "templates"), serviceMap, cliUpstream, force } = opts;
  logger.info(`Generate: specs=${specPaths.join(", ")} -> out=${outDir}, templates=${templateDir}`);

  // 1) Process each spec individually to preserve global x-service declarations
  const canonicalModels: CanonicalModel[] = [];
  for (const p of specPaths) {
    logger.info("Parsing spec:", p);
    const parsed = await parseSpecAndGetOperations(p);
    // Map each spec to canonical model individually
    const canonical: CanonicalModel = mapOpenApiToCanonical(parsed.normalized, { serviceMap });
    canonicalModels.push(canonical);
  }

  // 2) Merge canonical models instead of merging specs
  const mergedCanonical = mergeCanonicalModels(canonicalModels);

  // 3) Build terraform context (resolver will use serviceMap, cliUpstream, or canonical upstream)
  const context = buildTerraformContext(mergedCanonical, { serviceMap, cliUpstream });

  // 4) ensure outDir
  if (await fs.pathExists(outDir) && !force) {
    throw new Error(`Output directory ${outDir} already exists. Use --force to overwrite.`);
  }
  await fs.ensureDir(outDir);

  // 5) load templates
  const templates = await loadTemplates(templateDir);

  // 6) render
  await renderAll(templates, context, outDir);

  return { outDir, services: Object.keys(context.services || {}) };
}

// Simple merge helper for normalized specs (paths/components/servers/tags)
function mergeNormalizedSpecs(docs: NormalizedSpec[]): NormalizedSpec {
  if (!docs.length) throw new Error("No specs provided");
  const base = { ...docs[0] } as NormalizedSpec;

  for (let i = 1; i < docs.length; i++) {
    const d = docs[i];
    // merge paths (later docs override same path)
    base.paths = { ...(base.paths || {}), ...(d.paths || {}) };
    // merge components
    base.components = base.components || { schemas: {}, parameters: {}, responses: {}, securitySchemes: {} };
    for (const k of Object.keys(d.components || {} as any)) {
      base.components[k as keyof typeof base.components] = { ...(base.components as any)[k] || {}, ...(d.components as any)[k] || {} };
    }
    // append servers if unique
    base.servers = base.servers || [];
    for (const s of d.servers || []) {
      if (!base.servers.find((x) => x.url === s.url)) base.servers.push(s);
    }
    // merge security, tags
    base.security = base.security || [];
    base.security = Array.isArray(base.security) ? base.security.concat(d.security || []) : base.security;
    base.tags = base.tags || [];
    for (const t of d.tags || []) {
      if (!base.tags.find((x: any) => x.name === t.name)) base.tags.push(t);
    }
  }

  base.raw = base.raw || {}; // keep shape
  return base;
}

// Merge multiple canonical models into a single canonical model
function mergeCanonicalModels(models: CanonicalModel[]): CanonicalModel {
  if (!models.length) throw new Error("No canonical models provided");
  
  const allServices: CanonicalService[] = [];
  const allRoutes: CanonicalRoute[] = [];
  const serviceNamesSeen = new Set<string>();
  
  for (const model of models) {
    // Add services (avoid duplicates by name)
    for (const service of model.services) {
      if (!serviceNamesSeen.has(service.name)) {
        allServices.push(service);
        serviceNamesSeen.add(service.name);
      }
    }
    
    // Add all routes
    allRoutes.push(...model.routes);
  }
  
  return {
    services: allServices,
    routes: allRoutes,
    metadata: models[0]?.metadata || {}
  };
}
