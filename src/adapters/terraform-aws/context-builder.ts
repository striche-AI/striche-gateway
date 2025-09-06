// src/adapters/terraform-aws/context-builder.ts
import { CanonicalModel } from "../../model/canonical";

export type ContextBuilderOpts = {
  serviceMap?: Record<string, string>;
  cliUpstream?: string;
};

export function buildTerraformContext(canonical: CanonicalModel, opts: ContextBuilderOpts = {}) {
  const services: Record<string, any> = {};
  const svcById = new Map(canonical.services.map((s) => [s.id, s]));

  // Check if this is a unified deployment
  const isUnified = canonical.metadata?.unified === true;

  for (const svc of canonical.services) {
    const svcName = svc.name;
    
    if (isUnified) {
      // For unified gateway, we don't need a single upstream per service
      // Instead, we'll handle per-route upstreams
      services[svcName] = {
        upstream: "unified", // placeholder - routes will have individual upstreams
        routes: [],
      };
    } else {
      // Original logic for separate services
      // final upstream resolution priority:
      // 1) explicit serviceMap override passed to build (highest)
      // 2) global cliUpstream
      // 3) svc.upstreamUrl (populated by mapper from spec.servers or serviceMap)
      const explicit = opts.serviceMap && opts.serviceMap[svcName];
      const upstream = explicit || opts.cliUpstream || (svc.upstreamUrl && svc.upstreamUrl.length ? svc.upstreamUrl : undefined);

      if (!upstream) {
        throw new Error(
          `No upstream found for service "${svcName}". Provide one of:\n` +
          `  - add a "servers" entry in your OpenAPI spec for this service\n` +
          `  - pass --service-map '{"${svcName}":"https://..."}' to the generate command\n` +
          `  - pass --upstream "https://..." to apply a global upstream\n`
        );
      }

      services[svcName] = {
        upstream,
        routes: [],
      };
    }
  }

  // populate routes
  for (const r of canonical.routes) {
    const svc = svcById.get(r.serviceId);
    if (!svc) continue;
    
    let routeUpstream: string | undefined;
    
    if (isUnified) {
      // For unified mode, get upstream from route plugins
      const upstreamRouting = r.plugins?.['upstream-routing'];
      if (upstreamRouting) {
        const originalServiceName = upstreamRouting.originalServiceName;
        // Try to resolve upstream from serviceMap first, then from stored upstream
        routeUpstream = (opts.serviceMap && opts.serviceMap[originalServiceName]) || 
                       opts.cliUpstream || 
                       upstreamRouting.upstreamUrl;
        
        if (!routeUpstream) {
          throw new Error(
            `No upstream found for route "${r.path}" (service: ${originalServiceName}). Provide one of:\n` +
            `  - pass --service-map '{"${originalServiceName}":"https://..."}' to the generate command\n` +
            `  - pass --upstream "https://..." to apply a global upstream\n`
          );
        }
      }
    }
    
    services[svc.name].routes.push({
      path: r.path,
      methods: r.methods,
      plugins: r.plugins || {},
      id: r.id,
      upstream: routeUpstream, // Only set for unified mode
    });
  }

  return {
    aws_region: process.env.AWS_REGION || "us-east-1",
    services,
    metadata: canonical.metadata || {},
    // defaults for templates
    default_rate_limit_rps: process.env.DEFAULT_RATE_LIMIT_RPS ? Number(process.env.DEFAULT_RATE_LIMIT_RPS) : 100,
    default_rate_limit_burst: process.env.DEFAULT_RATE_LIMIT_BURST ? Number(process.env.DEFAULT_RATE_LIMIT_BURST) : 200,
  };
}
