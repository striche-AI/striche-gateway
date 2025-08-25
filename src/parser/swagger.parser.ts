import fs from "fs-extra";
import SwaggerParser from "@apidevtools/swagger-parser";
import path from "path";

/**
 * Minimal normalized spec interface covering what the generator needs.
 */
export type NormalizedSpec = {
  originalVersion: string; // "2.0" or "3.x"
  info: any;
  servers: Array<{ url: string }>;
  paths: Record<string, any>;
  components: {
    schemas?: Record<string, any>;
    parameters?: Record<string, any>;
    responses?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
  security?: any[];
  tags?: any[];
  raw: any; // the bundled raw AST (after $ref resolution)
};

/**
 * Parse + validate a Swagger/OpenAPI file and return a bundled AST that is normalized.
 * @param specPath path to YAML/JSON swagger or openapi file
 */
export async function parseAndNormalizeSpec(specPath: string): Promise<NormalizedSpec> {
  if (!(await fs.pathExists(specPath))) {
    throw new Error(`Spec file not found: ${specPath}`);
  }

  // load and bundle (resolves external $refs into a single doc)
  let bundled: any;
  try {
    // use SwaggerParser.bundle so external refs are included but not fully dereferenced (keeps sane memory)
    bundled = await SwaggerParser.bundle(specPath);
  } catch (err: any) {
    // fall back to parse if bundle fails
    throw new Error(`Failed to bundle spec: ${err.message || String(err)}`);
  }

  // validate the bundled document
  try {
    await SwaggerParser.validate(bundled);
  } catch (err: any) {
    // provide useful message
    throw new Error(`Spec validation failed: ${err.message || String(err)}`);
  }

  const normalized = normalizeBundledSpec(bundled, specPath);
  normalized.raw = bundled;
  return normalized;
}

/**
 * Normalize a bundled AST (could be swagger 2.0 or openapi 3.x).
 * Ensures presence of .servers (array), .components (object), consistent paths shape.
 */
function normalizeBundledSpec(bundled: any, specPath: string): NormalizedSpec {
  const spec: any = bundled;
  const result: NormalizedSpec = {
    originalVersion: "",
    info: spec.info || {},
    servers: [],
    paths: spec.paths || {},
    components: {
      schemas: {},
      parameters: {},
      responses: {},
      securitySchemes: {},
    },
    security: spec.security || [],
    tags: spec.tags || [],
    raw: spec,
  };

  // Detect version
  if (spec.swagger && String(spec.swagger).startsWith("2")) {
    result.originalVersion = "2.0";
    // Convert swagger v2 host/basePath/schemes -> servers[]
    const host = spec.host || "";
    const basePath = spec.basePath || "";
    const schemes = spec.schemes || ["https", "http"];
    const servers: Array<{ url: string }> = [];
    if (host) {
      for (const scheme of schemes) {
        const url = `${scheme}://${host}${basePath || ""}`;
        servers.push({ url });
      }
    } else {
      // fallback placeholder when no host present
      servers.push({ url: "${UPSTREAM_ROOT}" });
    }
    result.servers = servers;

    // components mapping
    if (spec.definitions) result.components.schemas = spec.definitions;
    if (spec.parameters) result.components.parameters = spec.parameters;
    if (spec.responses) result.components.responses = spec.responses;
    if (spec.securityDefinitions) result.components.securitySchemes = spec.securityDefinitions;
  } else if (spec.openapi && String(spec.openapi).startsWith("3")) {
    result.originalVersion = spec.openapi;
    // OpenAPI v3: servers is native
    if (Array.isArray(spec.servers) && spec.servers.length) {
      result.servers = spec.servers.map((s: any) => ({ url: s.url }));
    } else {
      result.servers = [{ url: "${UPSTREAM_ROOT}" }];
    }

    // components are native
    result.components.schemas = (spec.components && spec.components.schemas) || {};
    result.components.parameters = (spec.components && spec.components.parameters) || {};
    result.components.responses = (spec.components && spec.components.responses) || {};
    result.components.securitySchemes = (spec.components && spec.components.securitySchemes) || {};
  } else {
    // Unknown format - best-effort
    result.originalVersion = "unknown";
    result.servers = [{ url: "${UPSTREAM_ROOT}" }];
    // leave components empty
  }

  // If paths absent or empty, warn (but still return)
  if (!result.paths || Object.keys(result.paths).length === 0) {
    // no throw: let caller handle; but it's often an error for generator.
  }

  // Normalize each operation: ensure parameters array exists and method keys lowercased
  const normalizedPaths: Record<string, any> = {};
  for (const rawPath of Object.keys(result.paths)) {
    const pathItem = result.paths[rawPath] || {};
    const normalizedPathItem: Record<string, any> = {};

    for (const key of Object.keys(pathItem)) {
      const low = key.toLowerCase();
      if (["get", "post", "put", "patch", "delete", "options", "head"].includes(low)) {
        const op = pathItem[key] || {};
        // operation-level parameters may be absent
        op.parameters = op.parameters || [];
        // If swagger2 body parameters present — keep as-is (the mapper later can convert)
        normalizedPathItem[low] = op;
      } else {
        // copy vendor-exts and summary/description etc.
        normalizedPathItem[key] = pathItem[key];
      }
    }

    normalizedPaths[rawPath] = normalizedPathItem;
  }
  result.paths = normalizedPaths;

  return result;
}

/**
 * Extract a flat list of operations from a normalized spec.
 * Useful for iterating endpoints in generator.
 */
export function extractOperations(normalized: NormalizedSpec) {
  const ops: Array<{
    path: string;
    method: string;
    operationId?: string;
    summary?: string;
    description?: string;
    parameters?: any[];
    requestBody?: any;
    responses?: any;
    security?: any[];
    servers?: any[];
  }> = [];

  for (const rawPath of Object.keys(normalized.paths || {})) {
    const pathItem = normalized.paths[rawPath] || {};
    for (const method of Object.keys(pathItem)) {
      if (!["get", "post", "put", "patch", "delete", "options", "head"].includes(method)) continue;
      const op = pathItem[method] || {};
      const operation = {
        path: rawPath,
        method: method.toUpperCase(),
        operationId: op.operationId,
        summary: op.summary,
        description: op.description,
        parameters: op.parameters || [],
        requestBody: op.requestBody || null,
        responses: op.responses || {},
        security: op.security || normalized.security || [],
        servers: op.servers || normalized.servers,
      };
      ops.push(operation);
    }
  }
  return ops;
}

/**
 * Convenience wrapper: parse file and return normalized + operations.
 */
export async function parseSpecAndGetOperations(specPath: string) {
  const normalized = await parseAndNormalizeSpec(specPath);
  const operations = extractOperations(normalized);
  return { normalized, operations };
}

/* Example usage:
(async () => {
  const { normalized, operations } = await parseSpecAndGetOperations("example/swagger.yaml");
  console.log(normalized.servers);
  console.log(operations.map(o => `${o.method} ${o.path}`));
})();
*/

export default {
  parseAndNormalizeSpec,
  extractOperations,
  parseSpecAndGetOperations,
};
