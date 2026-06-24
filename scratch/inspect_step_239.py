import json

transcript_path = '/Users/berkhan/.gemini/antigravity-ide/brain/2eb6bc09-956f-4048-8367-5de2dda2defa/.system_generated/logs/transcript.jsonl'

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            step = data.get('step_index')
            if step in [239, 241]:
                tool_calls = data.get('tool_calls', [])
                for tc in tool_calls:
                    args = tc.get('args', {})
                    target = args.get('TargetFile', '')
                    code_len = len(args.get('CodeContent', ''))
                    print(f"Step {step}: Tool '{tc['name']}' to Target: {target}, CodeContent length: {code_len}")
                    # If it targets page.tsx and has content, print preview
                    if 'page.tsx' in target:
                        print("CodeContent starts with:")
                        print(args.get('CodeContent', '')[:500])
        except Exception as e:
            pass
