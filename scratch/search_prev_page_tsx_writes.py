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
                if name == 'write_to_file':
                    args = tc.get('args', {})
                    target = args.get('TargetFile', '')
                    if 'app/workspace/page.tsx' in target:
                        code_content = args.get('CodeContent', '')
                        print(f"Step {step}: Tool 'write_to_file' on page.tsx, length: {len(code_content)}")
        except Exception as e:
            pass
