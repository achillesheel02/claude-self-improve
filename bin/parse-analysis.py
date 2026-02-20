import sys, json, re

text = sys.stdin.read().strip()

# Strip markdown code fences if present
text = re.sub(r'^```json\s*', '', text)
text = re.sub(r'\s*```$', '', text)

# Try to parse directly
try:
    data = json.loads(text)
    print(json.dumps(data, indent=2))
    sys.exit(0)
except json.JSONDecodeError:
    pass

# Try to find JSON object in the text
match = re.search(r'\{[\s\S]*\}', text)
if match:
    try:
        data = json.loads(match.group())
        print(json.dumps(data, indent=2))
        sys.exit(0)
    except json.JSONDecodeError:
        pass

# Fallback: output raw text
print(text)
sys.exit(1)
