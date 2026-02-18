import {
  applyMemoryOperations,
  getMemoryLineCount,
  type MemoryOperation,
} from "../memory/memory-manager.js";

export interface UpdateMemoryInput {
  operations: MemoryOperation[];
}

export interface UpdateMemoryResult {
  success: boolean;
  applied: number;
  errors: string[];
  final_line_count: number;
}

export function updateMemory(input: UpdateMemoryInput): UpdateMemoryResult {
  if (!input.operations || !Array.isArray(input.operations)) {
    return {
      success: false,
      applied: 0,
      errors: ["operations must be a non-empty array"],
      final_line_count: getMemoryLineCount(),
    };
  }

  const { applied, errors } = applyMemoryOperations(input.operations);

  return {
    success: errors.length === 0,
    applied,
    errors,
    final_line_count: getMemoryLineCount(),
  };
}
