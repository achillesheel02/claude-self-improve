Search past Claude Code sessions for conversations matching the query.

```bash
~/.local/bin/claude-self-improve --recall "$ARGUMENTS"
```

After the script completes, display the results clearly:
1. **Matching sessions** — show each result with relevance level, date, project, and reason
2. **Transcript paths** — highlight the file path so the user can open or read it
3. If a transcript path is returned, offer to read it: "Want me to open any of these transcripts?"
4. If no matches found, suggest alternative search terms based on the query

If the script fails with a lock error, run `rmdir /tmp/claude-self-improve.lock` first, then retry.
