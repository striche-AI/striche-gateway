import { CanonicalModel } from "../../model/canonical";

/**
 * Build the rendering context that templates expect.
 * For simplicity, we produce a `services` map where each key is service name and value has upstream & routes.
 */
export function buildTerraformContext(canonical: CanonicalModel) {
  const services: Record<string, any> = {};
  // map serviceId -> name/upstream
  const svcById = new Map(canonical.services.map((s) => [s.id, s]));
  for (const svc of canonical.services) {
    services[svc.name] = {
      upstream: svc.upstreamUrl,
      routes: [],
    };
  }

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

  // minimal extra vars
  return {
    aws_region: "us-east-1",
    services,
    metadata: canonical.metadata || {},
  };
}
