export const logger = {
  debug: (...args: any[]) => {
    if (process.env.DEBUG) console.debug("[debug]", ...args);
  },
  info: (...args: any[]) => console.log("[info]", ...args),
  warn: (...args: any[]) => console.warn("[warn]", ...args),
  error: (...args: any[]) => console.error("[error]", ...args),
};
