#!/usr/bin/env node
import { Command } from "commander";
import path from "path";
import fs from "fs-extra";
import { generateFromSpec } from "./commands/generate";
import { logger } from "./utils/logger";

const program = new Command();

program
  .name("sttf")
  .description("Swagger/OpenAPI -> Terraform generator (AWS HTTP API) - minimal")
  .version("0.1.0");

program
  .command("generate")
  .description("Generate Terraform configuration from an OpenAPI spec")
  .requiredOption("-s, --spec <path...>", "Path to one or more OpenAPI/Swagger files (yaml|json). Repeatable.")
  .requiredOption("-o, --out <dir>", "Output directory for generated Terraform")
  .option("-t, --templates <dir>", "Templates directory (optional)")
  .option("--service-map <json>", "JSON map of service-name -> upstream URL")
  .option("-u, --upstream <url>", "Global upstream URL that overrides spec values (applies to all services)")
  .option("-f, --force", "Overwrite output directory if exists", false)
  .option("--unified", "Deploy as unified gateway (single endpoint) instead of separate services", true)
  .option("--separate", "Deploy as separate services (multiple endpoints)", false)
  .action(async (opts) => {
    try {
      // parse flags
      const specs: string[] = Array.isArray(opts.spec) ? opts.spec : [opts.spec];
      const outDir = opts.out;
      const force = !!opts.force;
      const cliUpstream: string | undefined = opts.upstream;
      const serviceMap = opts.serviceMap ? JSON.parse(opts.serviceMap) : undefined;
      const unified = opts.separate ? false : true; // default to unified unless --separate is specified

      // templates fallback: explicit -> ./templates in cwd -> bundled templates
      let templateDir: string;
      if (opts.templates) {
        templateDir = path.resolve(opts.templates);
      } else {
        const cwdTemplates = path.resolve(process.cwd(), "templates");
        if (await fs.pathExists(cwdTemplates)) templateDir = cwdTemplates;
        else templateDir = path.resolve(__dirname, "../templates");
      }

      // call generator
      const res = await generateFromSpec({
        specPaths: specs,
        outDir,
        templateDir,
        serviceMap,
        cliUpstream,
        force,
        unified,
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
    const { validateSpec } = await import("./commands/validate");
    try {
      const result = await validateSpec(opts.spec);
      if (!result.valid) process.exit(2);
    } catch (err: any) {
      console.error(err);
      process.exit(1);
    }
  });

program.parse(process.argv);
