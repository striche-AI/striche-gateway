// src/commands/validate.ts
import { parseAndNormalizeSpec, extractOperations, NormalizedSpec } from "../parser/swagger.parser";
import { logger } from "../utils/logger";

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  info?: string[];
};

/**
 * Validate an OpenAPI/Swagger spec file.
 * - Loads and validates the spec using swagger-parser (bundles and validates).
 * - Runs extra consistency checks:
 *   - paths present
 *   - each path has at least one operation
 *   - path parameters declared for each `{param}` in path
 *   - duplicate operationId detection
 *   - referenced security schemes exist in components.securitySchemes
 *   - servers present (warn if placeholder)
 */
export async function validateSpec(specPath: string): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  let normalized: NormalizedSpec;
  try {
    normalized = await parseAndNormalizeSpec(specPath);
  } catch (err: any) {
    // parse/validate at parser level failed - return error immediately
    const msg = err?.message || String(err);
    logger.error("Spec parsing/validation failed:", msg);
    return { valid: false, errors: [msg], warnings: [] };
  }

  // Basic checks
  if (!normalized.paths || Object.keys(normalized.paths).length === 0) {
    errors.push("Spec contains no paths.");
  }

  // Servers check
  if (!normalized.servers || normalized.servers.length === 0) {
    warnings.push("No servers defined in spec; generator will need upstream URLs (servers[]).");
  } else {
    // warn if only placeholder server present
    const onlyPlaceholders = normalized.servers.every((s) =>
      typeof s.url === "string" && s.url.includes("${UPSTREAM")
    );
    if (onlyPlaceholders) {
      warnings.push("Servers present, but contain placeholder URLs (e.g. ${UPSTREAM_...}). Replace with real upstreams or provide a service-map during generation.");
    }
  }

  // Collect operations
  const operations = extractOperations(normalized);

  // Each path should have at least one operation
  const pathKeys = Object.keys(normalized.paths || {});
  for (const p of pathKeys) {
    const opsForPath = operations.filter((o) => o.path === p);
    if (!opsForPath.length) {
      warnings.push(`Path "${p}" contains no operations (GET/POST/...).`);
    }
  }

  // Check for duplicate operationId
  const opIdMap = new Map<string, number>();
  for (const op of operations) {
    if (op.operationId) {
      opIdMap.set(op.operationId, (opIdMap.get(op.operationId) || 0) + 1);
    }
  }
  for (const [opId, count] of opIdMap.entries()) {
    if (count > 1) {
      warnings.push(`Duplicate operationId "${opId}" found ${count} times. Consider unique operationId values.`);
    }
  }

  // Check path parameter declarations: for each {param} in path ensure an operation or path-level parameter exists with in: 'path' name match
  const paramRegex = /\{([^}]+)\}/g;
  for (const op of operations) {
    const pathParams: string[] = [];
    let m;
    while ((m = paramRegex.exec(op.path)) !== null) {
      pathParams.push(m[1]);
    }
    if (pathParams.length > 0) {
      // collect declared path params from operation.parameters or path-level parameters
      const declared = new Set<string>();
      const params = op.parameters || [];
      for (const p of params) {
        if (p && p.in === "path" && p.name) declared.add(p.name);
      }

      // if not all declared, check pathItem-level parameters (already merged in parser? parser kept path-level as pathItem)
      // We attempt to be forgiving: if nothing declared at operation-level, it's a warning (spec may be incomplete)
      for (const pp of pathParams) {
        if (!declared.has(pp)) {
          warnings.push(`Path "${op.method} ${op.path}" references path parameter "{${pp}}" but no corresponding "in: path" parameter named "${pp}" is declared at the operation level. This may cause runtime errors.`);
        }
      }
    }
  }

  // Check referenced security schemes exist
  const definedSchemes = normalized.components?.securitySchemes || {};
  for (const op of operations) {
    if (op.security && Array.isArray(op.security)) {
      for (const secObj of op.security) {
        const names = Object.keys(secObj || {});
        for (const n of names) {
          if (!definedSchemes || !definedSchemes[n]) {
            warnings.push(`Operation ${op.method} ${op.path} references security scheme "${n}" but it's not defined in components.securitySchemes.`);
          }
        }
      }
    }
  }

  // Extra sanity: operations should have responses
  for (const op of operations) {
    if (!op.responses || Object.keys(op.responses).length === 0) {
      warnings.push(`Operation ${op.method} ${op.path} has no responses defined.`);
    }
  }

  // Final decision
  const valid = errors.length === 0;

  // Log results for CLI user
  if (!valid) {
    logger.error("Validation failed with errors:");
    for (const e of errors) logger.error("  - " + e);
  } else {
    logger.info("Spec parsed successfully.");
  }

  if (warnings.length) {
    logger.warn("Validation produced warnings:");
    for (const w of warnings) logger.warn("  - " + w);
  }

  if (info.length) {
    logger.info("Info:");
    for (const i of info) logger.info("  - " + i);
  }

  return { valid, errors, warnings, info };
}
