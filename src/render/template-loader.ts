import fs from "fs-extra";
import path from "path";
import Handlebars from "handlebars";
import { logger } from "../utils/logger";

/**
 * Load and compile templates from a template directory.
 * Expects:
 * - templates/root/*.hbs
 * - templates/modules/service/*.hbs
 */
export async function loadTemplates(templateDir: string) {
  const rootDir = path.join(templateDir, "root");
  const modulesServiceDir = path.join(templateDir, "modules", "service");
  const templates: any = { root: {}, module: {} };

  // register helpers
  Handlebars.registerHelper("keys", (obj: any) => Object.keys(obj || {}));
  Handlebars.registerHelper("upper", (s: string) => String(s).toUpperCase());

  // load root templates
  if (await fs.pathExists(rootDir)) {
    const files = await fs.readdir(rootDir);
    for (const f of files.filter((x) => x.endsWith(".hbs"))) {
      const content = await fs.readFile(path.join(rootDir, f), "utf8");
      templates.root[f] = Handlebars.compile(content);
    }
  } else {
    logger.warn("Template root directory not found:", rootDir);
  }

  // load module templates
  if (await fs.pathExists(modulesServiceDir)) {
    const files = await fs.readdir(modulesServiceDir);
    for (const f of files.filter((x) => x.endsWith(".hbs"))) {
      const content = await fs.readFile(path.join(modulesServiceDir, f), "utf8");
      templates.module[f] = Handlebars.compile(content);
    }
  } else {
    logger.warn("Template module directory not found:", modulesServiceDir);
  }

  return templates;
}
