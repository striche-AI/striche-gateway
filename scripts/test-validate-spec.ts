// 
import { validateSpec } from "../src/commands/validate";

async function run() {
    try {
        const specPath = "./specs/auth-service.yaml";
        const res = await validateSpec(specPath);
        console.log("Spec is valid.");
        if (res.warnings && res.warnings.length) {
        console.warn("Warnings:");
        res.warnings.forEach((w: string) => console.warn("  " + w));
        }
    } catch (err) {
        console.error("Validation failed:", err);
        process.exit(1);
    }
}
    
run();
