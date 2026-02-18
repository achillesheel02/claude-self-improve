import {
  readMemory,
  getMemoryLineCount,
  listTopicFiles,
  readTopicFile,
} from "../memory/memory-manager.js";

export interface ReadMemoryInput {
  include_topic_files?: boolean;
  topic_file?: string;
}

export interface ReadMemoryResult {
  memory: string;
  line_count: number;
  topic_files: string[];
  topic_content?: string;
}

export function readMemoryTool(input: ReadMemoryInput): ReadMemoryResult {
  const memory = readMemory();
  const lineCount = getMemoryLineCount();
  const topicFiles = listTopicFiles();

  let topicContent: string | undefined;
  if (input.topic_file) {
    topicContent = readTopicFile(input.topic_file);
  } else if (input.include_topic_files) {
    // Return all topic file contents concatenated
    const parts: string[] = [];
    for (const f of topicFiles) {
      parts.push(`\n--- ${f} ---\n${readTopicFile(f)}`);
    }
    topicContent = parts.join("\n");
  }

  return {
    memory,
    line_count: lineCount,
    topic_files: topicFiles,
    topic_content: topicContent,
  };
}
