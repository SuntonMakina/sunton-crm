import json

transcript_path = '/Users/berkhan/.gemini/antigravity-ide/brain/2eb6bc09-956f-4048-8367-5de2dda2defa/.system_generated/logs/transcript.jsonl'

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            step = data.get('step_index')
            tool_calls = data.get('tool_calls', [])
            for tc in tool_calls:
                name = tc.get('name')
                if name == 'view_file':
                    args = tc.get('args', {})
                    target = args.get('AbsolutePath', '')
                    if 'page.tsx' in target:
                        print(f"Step {step}: view_file from line {args.get('StartLine')} to {args.get('EndLine')}")
        except Exception as e:
            pass
