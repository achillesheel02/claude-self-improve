import {
  readFileSync,
  writeFileSync,
  existsSync,
  copyFileSync,
  readdirSync,
  unlinkSync,
  statSync,
} from "fs";
import { join, basename } from "path";
import { getConfig } from "../config.js";

const MAX_MEMORY_LINES = 200;

export function readMemory(): string {
  const memoryPath = getMemoryPath();
  if (!existsSync(memoryPath)) {
    return "";
  }
  return readFileSync(memoryPath, "utf-8");
}

export function getMemoryPath(): string {
  return join(getConfig().memory_dir, "MEMORY.md");
}

export function getMemoryLineCount(): number {
  const content = readMemory();
  return content.split("\n").length;
}

export function backupMemory(): string {
  const config = getConfig();
  const memoryPath = getMemoryPath();
  const backupsDir = join(config.data_dir, "backups");
  const timestamp = new Date()
    .toISOString()
    .replace(/[:-]/g, "")
    .replace("T", "_")
    .slice(0, 15);
  const backupPath = join(backupsDir, `MEMORY_${timestamp}.md`);

  if (existsSync(memoryPath)) {
    copyFileSync(memoryPath, backupPath);
  }

  // Prune old backups
  pruneBackups(backupsDir, config.max_backups);

  return backupPath;
}

function pruneBackups(backupsDir: string, maxBackups: number): void {
  if (!existsSync(backupsDir)) return;

  const files = readdirSync(backupsDir)
    .filter((f) => f.startsWith("MEMORY_") && f.endsWith(".md"))
    .map((f) => ({
      name: f,
      path: join(backupsDir, f),
      mtime: statSync(join(backupsDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  for (const file of files.slice(maxBackups)) {
    unlinkSync(file.path);
  }
}

export interface MemoryOperation {
  operation:
    | "append_to_section"
    | "create_topic_file"
    | "archive_to_topic"
    | "update_active_threads";
  section?: string;
  filename?: string;
  content: string;
  reason?: string;
}

export function applyMemoryOperations(
  operations: MemoryOperation[]
): { applied: number; errors: string[] } {
  const errors: string[] = [];
  let applied = 0;

  // Backup before any changes
  backupMemory();

  for (const op of operations) {
    try {
      switch (op.operation) {
        case "append_to_section":
          appendToSection(op.section || "", op.content);
          applied++;
          break;

        case "create_topic_file":
          createTopicFile(op.filename || "", op.content);
          applied++;
          break;

        case "archive_to_topic":
          archiveToTopic(op.section || "", op.filename || "", op.content);
          applied++;
          break;

        case "update_active_threads":
          updateActiveThreads(op.content);
          applied++;
          break;

        default:
          errors.push(`Unknown operation: ${(op as any).operation}`);
      }
    } catch (e) {
      errors.push(
        `Failed ${op.operation}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  return { applied, errors };
}

function appendToSection(sectionName: string, content: string): void {
  const memoryPath = getMemoryPath();
  let text = readFileSync(memoryPath, "utf-8");

  const sectionHeader = `## ${sectionName}`;
  const headerIdx = text.indexOf(sectionHeader);

  if (headerIdx === -1) {
    // Section doesn't exist — append at end
    text = text.trimEnd() + `\n\n${sectionHeader}\n${content}\n`;
  } else {
    // Find end of section (next ## or end of file)
    const afterHeader = headerIdx + sectionHeader.length;
    const nextSection = text.indexOf("\n## ", afterHeader);
    const insertPos = nextSection === -1 ? text.length : nextSection;

    // Check for duplicate content
    const sectionContent = text.slice(afterHeader, insertPos);
    const firstLine = content.split("\n")[0].replace(/^- \*\*/, "").slice(0, 40);
    if (sectionContent.includes(firstLine)) {
      return; // Skip duplicate
    }

    text = text.slice(0, insertPos) + "\n" + content + text.slice(insertPos);
  }

  // Enforce line limit
  const lines = text.split("\n");
  if (lines.length > MAX_MEMORY_LINES) {
    throw new Error(
      `MEMORY.md would exceed ${MAX_MEMORY_LINES} lines (${lines.length}). Use create_topic_file instead.`
    );
  }

  writeFileSync(memoryPath, text);
}

function createTopicFile(filename: string, content: string): void {
  const config = getConfig();
  const filePath = join(config.memory_dir, filename);

  writeFileSync(filePath, content);

  // Add reference to MEMORY.md topic file index
  const memoryPath = getMemoryPath();
  let text = readFileSync(memoryPath, "utf-8");

  const indexHeader = "## Topic File Index";
  const link = `- [${filename}](./${filename})`;

  if (text.includes(link)) return; // Already referenced

  if (text.includes(indexHeader)) {
    const headerIdx = text.indexOf(indexHeader);
    const afterHeader =
      text.indexOf("\n", headerIdx + indexHeader.length) + 1;
    text = text.slice(0, afterHeader) + link + "\n" + text.slice(afterHeader);
  } else {
    text = text.trimEnd() + `\n\n${indexHeader}\n${link}\n`;
  }

  writeFileSync(memoryPath, text);
}

function archiveToTopic(
  sectionName: string,
  filename: string,
  content: string
): void {
  // Create topic file with the content
  createTopicFile(filename, content);

  // Replace section content in MEMORY.md with a link
  const memoryPath = getMemoryPath();
  let text = readFileSync(memoryPath, "utf-8");

  const sectionHeader = `## ${sectionName}`;
  const headerIdx = text.indexOf(sectionHeader);

  if (headerIdx !== -1) {
    const afterHeader = headerIdx + sectionHeader.length;
    const nextSection = text.indexOf("\n## ", afterHeader);
    const endPos = nextSection === -1 ? text.length : nextSection;

    const replacement = `\nSee [${filename}](./${filename})\n`;
    text = text.slice(0, afterHeader) + replacement + text.slice(endPos);
    writeFileSync(memoryPath, text);
  }
}

function updateActiveThreads(content: string): void {
  const memoryPath = getMemoryPath();
  let text = readFileSync(memoryPath, "utf-8");

  const sectionHeader = "## Active Threads";
  const headerIdx = text.indexOf(sectionHeader);

  if (headerIdx === -1) {
    text = text.trimEnd() + `\n\n${sectionHeader}\n${content}\n`;
  } else {
    const afterHeader = headerIdx + sectionHeader.length;
    const nextSection = text.indexOf("\n## ", afterHeader);
    const endPos = nextSection === -1 ? text.length : nextSection;
    text = text.slice(0, afterHeader) + "\n" + content + "\n" + text.slice(endPos);
  }

  const lines = text.split("\n");
  if (lines.length > MAX_MEMORY_LINES) {
    throw new Error(
      `MEMORY.md would exceed ${MAX_MEMORY_LINES} lines after thread update.`
    );
  }

  writeFileSync(memoryPath, text);
}

export function listTopicFiles(): string[] {
  const config = getConfig();
  if (!existsSync(config.memory_dir)) return [];
  return readdirSync(config.memory_dir).filter(
    (f) => f.endsWith(".md") && f !== "MEMORY.md"
  );
}

export function readTopicFile(filename: string): string {
  const filePath = join(getConfig().memory_dir, filename);
  if (!existsSync(filePath)) return "";
  return readFileSync(filePath, "utf-8");
}
