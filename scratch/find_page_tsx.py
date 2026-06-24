import json

transcript_path = '/Users/berkhan/.gemini/antigravity-ide/brain/2eb6bc09-956f-4048-8367-5de2dda2defa/.system_generated/logs/transcript.jsonl'

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            # Look at tool calls or content
            step = data.get('step_index')
            type_ = data.get('type')
            content = data.get('content', '')
            tool_calls = data.get('tool_calls', [])
            
            # Print steps that mention page.tsx or write/replace operations
            for tc in tool_calls:
                args = tc.get('args', {})
                args_str = json.dumps(args)
                if 'page.tsx' in args_str:
                    print(f"Step {step}: Tool Call '{tc['name']}' with args: {args_str[:200]}...")
            
            if 'page.tsx' in content and len(content) > 1000:
                print(f"Step {step}: Content contains page.tsx (len: {len(content)})")
        except Exception as e:
            pass
