// src/model/mapper.ts
import { CanonicalModel, CanonicalService, CanonicalRoute } from "./canonical";
import crypto from "crypto";
import { logger } from "../utils/logger";

type MapOpts = {
  serviceMap?: Record<string, string>;
};

/**
 * Map a normalized OpenAPI AST to the canonical model.
 * Heuristic: group by vendor extension x-service OR first path segment OR tags.
 * Also set upstreamUrl from serviceMap override or from spec servers (first one).
 */
export function mapOpenApiToCanonical(api: any, opts: MapOpts = {}): CanonicalModel {
  const serviceMapOverride = opts.serviceMap || {};
  const servicesMap = new Map<string, CanonicalService>();
  const routes: CanonicalRoute[] = [];

  const paths = api.paths || {};

  for (const rawPath of Object.keys(paths)) {
    const pathItem = paths[rawPath];
    // determine service name by vendor extension, server URL, tag, or first segment
    let serviceName = undefined as string | undefined;

    // 1) path-level x-service
    if (pathItem && pathItem["x-service"]) serviceName = String(pathItem["x-service"]);

    // 2) operation-level x-service (take first op that has it)
    if (!serviceName) {
      const opKeys = Object.keys(pathItem || {}).filter((k) => /^(get|post|put|patch|delete|options|head)$/i.test(k));
      for (const k of opKeys) {
        const op = pathItem[k];
        if (op && op["x-service"]) {
          serviceName = String(op["x-service"]);
          break;
        }
      }
    }

    // 3) try derive from api.servers[0] path segment (if available)
    if (!serviceName && api && Array.isArray(api.servers) && api.servers.length) {
      try {
        const url = api.servers[0].url || "";
        const u = new URL(url);
        const seg = (u.pathname || "/").split("/").filter(Boolean)[0];
        if (seg) serviceName = seg;
      } catch {
        // ignore URL parse errors
      }
    }

    // 4) fallback to first tag on first operation
    if (!serviceName) {
      const opKeys = Object.keys(pathItem || {}).filter((k) => /^(get|post|put|patch|delete|options|head)$/i.test(k));
      for (const k of opKeys) {
        const op = pathItem[k];
        if (op && Array.isArray(op.tags) && op.tags.length) {
          serviceName = String(op.tags[0]).toLowerCase().replace(/\s+/g, "-");
          break;
        }
      }
    }

    // 5) final fallback: first path segment or 'root'
    if (!serviceName) {
      const first = rawPath.split("/").filter(Boolean)[0];
      serviceName = first || "root";
    }

    // now ensure service exists
    if (!servicesMap.has(serviceName)) {
      // pick upstream: serviceMapOverride > api.servers[0].url (if exists) > placeholder (we'll fill placeholder but context-builder will error if not replaced)
      let upstream = undefined as string | undefined;
      if (serviceMapOverride[serviceName]) upstream = serviceMapOverride[serviceName];
      else if (api && Array.isArray(api.servers) && api.servers.length) upstream = api.servers[0].url;
      else upstream = undefined;

      const svc: CanonicalService = {
        id: `svc-${slug(serviceName)}`,
        name: serviceName,
        upstreamUrl: upstream || "", // leave empty string if unknown - context builder will enforce presence
        description: api.info?.title || undefined,
      };
      servicesMap.set(serviceName, svc);
    }
    const svc = servicesMap.get(serviceName)!;

    // iterate methods
    for (const method of Object.keys(pathItem)) {
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
        const sec = op.security[0];
        const secName = Object.keys(sec)[0];
        const scheme = api.components?.securitySchemes?.[secName];
        if (scheme) {
          if (scheme.type === "apiKey") route.plugins!["key-auth"] = {};
          else if (scheme.type === "http" && (scheme.scheme === "bearer" || scheme.scheme === "bearerAuth")) route.plugins!["jwt"] = {};
          else if (scheme.type === "oauth2" || scheme.type === "openIdConnect") route.plugins!["jwt"] = {};
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

// helpers
function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function shortHash(s: string) {
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 8);
}
