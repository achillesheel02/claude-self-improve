import json, sys, os, re

result_file = sys.argv[1]
index_file = sys.argv[2]

with open(result_file) as f:
    raw = f.read().strip()

# Strip markdown fences if present
raw = re.sub(r'^```json\s*', '', raw)
raw = re.sub(r'\s*```$', '', raw)

try:
    data = json.loads(raw)
except json.JSONDecodeError:
    # Try to find JSON in text
    match = re.search(r'\{[\s\S]*\}', raw)
    if match:
        data = json.loads(match.group())
    else:
        print('ERROR: Could not parse recall results as JSON')
        print(f'Raw: {raw[:500]}')
        sys.exit(1)

matches = data.get('matches', [])

# Load session index to look up transcript paths
transcript_map = {}
if os.path.exists(index_file):
    with open(index_file) as f:
        for s in json.load(f):
            transcript_map[s['session_id']] = s.get('transcript', '')

if not matches:
    print('  No matching sessions found.')
    sys.exit(0)

for i, m in enumerate(matches, 1):
    sid = m.get('session_id', '?')
    project = m.get('project', '?')
    date = m.get('date', '?')
    relevance = m.get('relevance', '?').upper()
    reason = m.get('reason', '')
    summary = m.get('summary', '')
    transcript = transcript_map.get(sid, '')

    print(f'  {i}. [{relevance}] {date} — {project}')
    print(f'     {reason}')
    if summary:
        print(f'     Summary: {summary}')
    if transcript:
        print(f'     Transcript: {transcript}')
    else:
        print(f'     Session ID: {sid}')
    print()

print(f'  Found {len(matches)} matching session(s).')
