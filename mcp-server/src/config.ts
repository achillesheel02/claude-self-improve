import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";

export interface Config {
  data_dir: string;
  memory_dir: string;
  sync_with_claude_code: boolean;
  max_backups: number;
  facet_batch_size: number;
}

const DEFAULT_DATA_DIR = join(homedir(), ".claude-improve");

const DEFAULT_CONFIG: Config = {
  data_dir: DEFAULT_DATA_DIR,
  memory_dir: join(DEFAULT_DATA_DIR, "memory"),
  sync_with_claude_code: false,
  max_backups: 10,
  facet_batch_size: 50,
};

let cachedConfig: Config | null = null;

export function getDataDir(): string {
  return getConfig().data_dir;
}

export function getConfig(): Config {
  if (cachedConfig) return cachedConfig;

  const configPath = join(DEFAULT_DATA_DIR, "config.json");

  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, "utf-8");
      const userConfig = JSON.parse(raw);
      cachedConfig = {
        ...DEFAULT_CONFIG,
        ...userConfig,
        data_dir: expandHome(userConfig.data_dir || DEFAULT_CONFIG.data_dir),
        memory_dir: expandHome(
          userConfig.memory_dir || DEFAULT_CONFIG.memory_dir
        ),
      };
    } catch {
      cachedConfig = DEFAULT_CONFIG;
    }
  } else {
    cachedConfig = DEFAULT_CONFIG;
  }

  return cachedConfig!;
}

export function initDataDir(): void {
  const config = getConfig();
  const dirs = [
    config.data_dir,
    join(config.data_dir, "facets"),
    join(config.data_dir, "backups"),
    config.memory_dir,
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  // Create default config.json if missing
  const configPath = join(config.data_dir, "config.json");
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n");
  }

  // Create default MEMORY.md if missing
  const memoryPath = join(config.memory_dir, "MEMORY.md");
  if (!existsSync(memoryPath)) {
    writeFileSync(
      memoryPath,
      "# Claude Self-Improvement Memory\n\n## Key Lessons\n\n## Anti-Patterns\n\n## Working Style Preferences\n"
    );
  }
}

export function writeConfig(config: Partial<Config>): void {
  const current = getConfig();
  const merged = { ...current, ...config };
  const configPath = join(merged.data_dir, "config.json");
  writeFileSync(configPath, JSON.stringify(merged, null, 2) + "\n");
  cachedConfig = merged;
}

function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    return join(homedir(), p.slice(2));
  }
  return resolve(p);
}
