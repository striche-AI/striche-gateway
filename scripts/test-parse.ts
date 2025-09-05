// scripts/test-parse.ts
import { parseSpecAndGetOperations } from "../src/parser/swagger.parser";

async function run() {
  try {
    const specPath = "./specs/payment-service.yaml";
    const { normalized, operations } = await parseSpecAndGetOperations(specPath);
    console.log("=== Normalized spec summary ===");
    console.log(normalized);
    console.log("description:", normalized.info?.description);
    console.log("version:", normalized.originalVersion);
    console.log("servers:", normalized.servers);
    console.log("paths count:", Object.keys(normalized.paths || {}).length);
    console.log("");
    console.log("=== operations ===");
    console.log(JSON.stringify(operations.map(o => ({ method: o.method, path: o.path, operationId: o.operationId, supermary: o.summary, description: o.description, parameters: o.parameters })), null, 2));
  } catch (err) {
    console.error("ERROR parsing spec:", err);
    process.exit(1);
  }
}

run();
