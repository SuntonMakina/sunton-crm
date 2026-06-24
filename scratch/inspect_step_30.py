import json

transcript_path = '/Users/berkhan/.gemini/antigravity-ide/brain/2eb6bc09-956f-4048-8367-5de2dda2defa/.system_generated/logs/transcript.jsonl'

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            step = data.get('step_index')
            if step in [30, 31]:
                content = data.get('content', '')
                tool_calls = data.get('tool_calls', [])
                print(f"Step {step}: type: {data.get('type')}, content len: {len(content)}, tool_calls: {len(tool_calls)}")
                if len(content) > 100:
                    print(content[:300])
        except Exception as e:
            pass
