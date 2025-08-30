import { CanonicalModel, CanonicalService, CanonicalRoute } from "./canonical";
import crypto from "crypto";
import { logger } from "../utils/logger";

type MapOpts = {
  serviceMap?: Record<string, string>;
};

/**
 * Map an OpenAPI AST to the canonical model.
 * Heuristic: group by first path segment OR x-service vendor extension.
 */
export function mapOpenApiToCanonical(api: any, opts: MapOpts = {}): CanonicalModel {
  const servicesMap = new Map<string, CanonicalService>();
  const routes: CanonicalRoute[] = [];
  const serviceMapOverride = opts.serviceMap || {};

  const paths = api.paths || {};

  for (const rawPath of Object.keys(paths)) {
    const pathItem = paths[rawPath];
    // determine service name by vendor extension or first segment
    let serviceName = (pathItem["x-service"] as string) || undefined;
    if (!serviceName) {
      const first = rawPath.split("/").filter(Boolean)[0];
      serviceName = first || "root";
    }

    // create or get service
    if (!servicesMap.has(serviceName)) {
      const upstream = serviceMapOverride[serviceName] || `\${UPSTREAM_${serviceName.toUpperCase()}}`;
      const svc: CanonicalService = {
        id: `svc-${slug(serviceName)}`,
        name: serviceName,
        upstreamUrl: upstream,
        description: api.info?.title || undefined,
      };
      servicesMap.set(serviceName, svc);
    }
    const svc = servicesMap.get(serviceName)!;

    // iterate methods
    for (const method of Object.keys(pathItem)) {
      // skip non-method fields
      if (!/^(get|post|put|delete|patch|options|head)$/i.test(method)) continue;
      const op = pathItem[method];
      const methods = [method.toUpperCase()];
      const id = shortHash(`${svc.name}|${rawPath}|${method}`);
      const route: CanonicalRoute = {
        id: `r-${id}`,
        serviceId: svc.id,
        path: rawPath,
        methods,
        plugins: {},
      };

      // security -> map simple hints
      if (op.security && Array.isArray(op.security) && op.security.length > 0) {
        // take first security scheme name
        const sec = op.security[0];
        const secName = Object.keys(sec)[0];
        // inspect components -> securitySchemes
        const scheme = api.components?.securitySchemes?.[secName];
        if (scheme) {
          if (scheme.type === "apiKey") {
            route.plugins = route.plugins || {};
            route.plugins["key-auth"] = {};
          } else if (scheme.type === "http" && (scheme.scheme === "bearer" || scheme.scheme === "bearerAuth")) {
            route.plugins = route.plugins || {};
            route.plugins["jwt"] = {};
          } else if (scheme.type === "oauth2" || scheme.type === "openIdConnect") {
            route.plugins = route.plugins || {};
            route.plugins["jwt"] = {};
          }
        }
      }

      // vendor extension x-rate-limit
      if (op["x-rate-limit"]) {
        route.plugins = route.plugins || {};
        route.plugins["rate-limiting"] = op["x-rate-limit"];
      }

      routes.push(route);
    }
  }

  const services = Array.from(servicesMap.values());
  logger.debug(`Mapped ${services.length} services and ${routes.length} routes`);
  return { services, routes, metadata: { title: api.info?.title } };
}

// small helpers
function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function shortHash(s: string) {
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 8);
}
