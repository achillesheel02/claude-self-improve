# Memory Update Prompt

You are updating Claude's persistent memory files based on analysis results from a self-improvement run.

## Input

You will receive a JSON object containing `memory_updates` — an array of operations to apply to memory files.

## Memory File Locations

The memory directory path will be provided in the input. It contains:
- **MEMORY.md**: The main memory file loaded into Claude's system prompt
- **Topic files**: Additional `.md` files in the same directory for detailed/verbose content

## Operations

### `append_to_section`
Find the named section (## heading) in MEMORY.md and append the content as a new bullet point. If the section doesn't exist, create it at the end of the file.

### `create_topic_file`
Create a new `.md` file in the memory directory. Add a one-line reference in a "Topic File Index" section of MEMORY.md (create the section if it doesn't exist).

### `archive_to_topic`
Move verbose content from MEMORY.md to a topic file, leaving a one-line link in MEMORY.md.

## Rules

1. **Read before writing**: Always read the current file before making changes.

2. **Line budget**: MEMORY.md must not exceed 200 lines after all updates. Count lines after each edit. If approaching the limit, create topic files instead.

3. **Preserve existing content**: NEVER delete or modify content that was written by the user. You may only:
   - Add new bullets to existing sections
   - Create new sections
   - Create new topic files
   - Add links to topic files

4. **Deduplication**: Before adding a bullet, check if the same insight already exists (even if worded differently). Skip duplicates.

5. **Formatting**: Match the existing style exactly:
   - Use `**bold**` for emphasis on key terms
   - Use backticks for code/technical terms
   - Bullets start with `- `
   - Nested content uses 2-space indent

6. **Topic file format**: Each topic file should have:
   - `# Title` as first line
   - Clear sections with `##` headings
   - Date stamps for time-series data

7. **Verify final state**: After all updates, read MEMORY.md one final time and report the line count.

## Example

Given this memory_update:
```json
{
  "operation": "append_to_section",
  "section": "Anti-Patterns",
  "content": "- **Premature diagnosis** (12 sessions): Always run a diagnostic query before stating root cause"
}
```

Find `## Anti-Patterns` in MEMORY.md and add the bullet at the end of that section (before the next `##` heading or end of file).
