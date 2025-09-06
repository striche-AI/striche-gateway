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
  unified?: boolean;              // true = single gateway with path routing, false = separate gateways per service
};

export async function generateFromSpec(opts: GenerateOpts) {
  const { specPaths, outDir, templateDir = path.resolve(process.cwd(), "templates"), serviceMap, cliUpstream, force, unified = true } = opts;
  logger.info(`Generate: specs=${specPaths.join(", ")} -> out=${outDir}, templates=${templateDir}`);
  logger.info(`Deployment mode: ${unified ? 'unified gateway' : 'separate services'}`);

  // 1) Process each spec individually to preserve global x-service declarations
  const canonicalModels: CanonicalModel[] = [];
  for (const p of specPaths) {
    logger.info("Parsing spec:", p);
    const parsed = await parseSpecAndGetOperations(p);
    // Map each spec to canonical model individually
    const canonical: CanonicalModel = mapOpenApiToCanonical(parsed.normalized, { serviceMap });
    canonicalModels.push(canonical);
  }

  // 2) Merge canonical models - behavior changes based on unified mode
  const mergedCanonical = unified ? 
    mergeCanonicalModelsUnified(canonicalModels) : 
    mergeCanonicalModels(canonicalModels);

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

  return { outDir, services: Object.keys(context.services || {}), unified };
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

// Merge multiple canonical models into a single canonical model (separate services)
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

// Merge multiple canonical models into a unified gateway (single service with all routes)
function mergeCanonicalModelsUnified(models: CanonicalModel[]): CanonicalModel {
  if (!models.length) throw new Error("No canonical models provided");
  
  // Create a single unified service
  const unifiedService: CanonicalService = {
    id: "svc-unified-gateway",
    name: "unified-gateway", 
    upstreamUrl: "", // Will be resolved by context builder
    description: "Unified API Gateway for all microservices"
  };
  
  // Collect all routes and modify them for unified deployment
  const allRoutes: CanonicalRoute[] = [];
  const serviceUpstreams = new Map<string, string>();
  
  for (const model of models) {
    // Collect upstream URLs from each service
    for (const service of model.services) {
      if (service.upstreamUrl) {
        serviceUpstreams.set(service.name, service.upstreamUrl);
      }
    }
    
    // Add all routes but point them to the unified service
    for (const route of model.routes) {
      // Find the original service name to determine upstream
      const originalService = model.services.find(s => s.id === route.serviceId);
      const serviceName = originalService?.name || 'unknown';
      
      const unifiedRoute: CanonicalRoute = {
        ...route,
        id: `${route.id}-unified`,
        serviceId: unifiedService.id,
        // Store upstream routing info in plugins
        plugins: {
          ...route.plugins,
          'upstream-routing': {
            originalServiceName: serviceName,
            upstreamUrl: serviceUpstreams.get(serviceName)
          }
        }
      };
      
      allRoutes.push(unifiedRoute);
    }
  }
  
  return {
    services: [unifiedService],
    routes: allRoutes,
    metadata: {
      unified: true,
      serviceUpstreams: Object.fromEntries(serviceUpstreams),
      originalServices: models.flatMap(m => m.services.map(s => s.name))
    }
  };
}
