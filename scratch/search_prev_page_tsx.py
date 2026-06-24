import json

prev_log_path = '/Users/berkhan/.gemini/antigravity-ide/brain/8ac0bb0f-ffa0-4a1b-9f4f-66abb7d3657b/.system_generated/logs/transcript.jsonl'

with open(prev_log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            step = data.get('step_index')
            tool_calls = data.get('tool_calls', [])
            for tc in tool_calls:
                name = tc.get('name')
                args = tc.get('args', {})
                args_str = json.dumps(args)
                if 'app/workspace/page.tsx' in args_str:
                    print(f"Step {step}: Tool '{name}', args keys: {list(args.keys())}")
        except Exception as e:
            pass
