#!/usr/bin/env node
import { Command } from "commander";
import path from "path";
import { validateSpecFile as validateSpec} from "./index";
import { generateFromSpec } from "./index";
import { logger } from "./utils/logger";

const program = new Command();

program
  .name("sttf")
  .description("Swagger/OpenAPI -> Terraform generator (AWS HTTP API) - minimal")
  .version("0.1.0");

program
  .command("generate")
  .description("Generate Terraform configuration from an OpenAPI spec")
  .requiredOption("-s, --spec <path>", "Path to OpenAPI/Swagger file (yaml|json)")
  .requiredOption("-o, --out <dir>", "Output directory for generated Terraform")
  .option("-t, --templates <dir>", "Templates directory", path.resolve(process.cwd(), "templates"))
  .option("--service-map <json>", "JSON map of first-path-segment -> upstream URL")
  .action(async (opts) => {
    try {
      const serviceMap = opts.serviceMap ? JSON.parse(opts.serviceMap) : undefined;
      const res = await generateFromSpec({
        specPath: opts.spec,
        outDir: opts.out,
        templateDir: opts.templates,
        serviceMap,
      });
      logger.info(`Generated to ${res.outDir}`);
      logger.info(`Services: ${res.services.join(", ")}`);
    } catch (err: any) {
      logger.error(err.message || String(err));
      process.exit(1);
    }
  });

program
  .command("validate")
  .description("Validate an OpenAPI / Swagger spec")
  .requiredOption("-s, --spec <path>", "Path to OpenAPI/Swagger file")
  .action(async (opts) => {
    try {
      const res = await validateSpec(opts.spec);
      logger.info("Spec is valid.");
      if (res.warnings && res.warnings.length) {
        logger.warn("Warnings:");
        res.warnings.forEach((w: string) => logger.warn("  " + w));
      }
    } catch (err: any) {
      logger.error("Validation failed: " + (err.message || String(err)));
      process.exit(1);
    }
  });

program.parse(process.argv);
