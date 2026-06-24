import json

prev_log_path = '/Users/berkhan/.gemini/antigravity-ide/brain/8ac0bb0f-ffa0-4a1b-9f4f-66abb7d3657b/.system_generated/logs/transcript.jsonl'

with open(prev_log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            step = data.get('step_index')
            if step in [3001, 3002]:
                content = data.get('content', '')
                print(f"Step {step}: type: {data.get('type')}, content len: {len(content)}")
                if len(content) > 100:
                    print(content[:500])
        except Exception as e:
            pass
