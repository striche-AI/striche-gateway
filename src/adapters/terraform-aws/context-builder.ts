// src/adapters/terraform-aws/context-builder.ts
import { CanonicalModel } from "../../model/canonical";

export type ContextBuilderOpts = {
  serviceMap?: Record<string, string>;
  cliUpstream?: string;
};

export function buildTerraformContext(canonical: CanonicalModel, opts: ContextBuilderOpts = {}) {
  const services: Record<string, any> = {};
  const svcById = new Map(canonical.services.map((s) => [s.id, s]));

  for (const svc of canonical.services) {
    const svcName = svc.name;
    // final upstream resolution priority:
    // 1) explicit serviceMap override passed to build (highest)
    // 2) global cliUpstream
    // 3) svc.upstreamUrl (populated by mapper from spec.servers or serviceMap)
    // If none available, throw error: user must provide upstream via --service-map or --upstream or include servers[] in spec.
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

  // populate routes
  for (const r of canonical.routes) {
    const svc = svcById.get(r.serviceId);
    if (!svc) continue;
    services[svc.name].routes.push({
      path: r.path,
      methods: r.methods,
      plugins: r.plugins || {},
      id: r.id,
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
