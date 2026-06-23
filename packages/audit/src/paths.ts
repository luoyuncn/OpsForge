import { homedir } from "node:os";
import { join } from "node:path";

export interface OpsForgePathConfig {
  dbPath: string;
  artifactsDir: string;
}

const expandHome = (path: string): string => {
  if (path === "~") return homedir();
  if (path.startsWith("~/") || path.startsWith("~\\")) return join(homedir(), path.slice(2));
  return path;
};

export const resolveOpsForgePaths = (config: OpsForgePathConfig): OpsForgePathConfig => ({
  dbPath: expandHome(config.dbPath),
  artifactsDir: expandHome(config.artifactsDir),
});
