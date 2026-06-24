import json
import os

prev_log_path = '/Users/berkhan/.gemini/antigravity-ide/brain/8ac0bb0f-ffa0-4a1b-9f4f-66abb7d3657b/.system_generated/logs/transcript.jsonl'

if not os.path.exists(prev_log_path):
    print("Previous conversation log does not exist on this path.")
    exit(1)

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
                if 'page.tsx' in args_str:
                    target = args.get('TargetFile', '')
                    code_len = len(args.get('CodeContent', ''))
                    print(f"Step {step}: Tool '{name}' to Target: {target}, len: {code_len}")
                    if code_len > 10000:
                        # This could be the complete file!
                        print("FOUND a large write on page.tsx in step", step)
        except Exception as e:
            pass
