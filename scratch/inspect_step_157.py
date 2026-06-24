import json

transcript_path = '/Users/berkhan/.gemini/antigravity-ide/brain/2eb6bc09-956f-4048-8367-5de2dda2defa/.system_generated/logs/transcript.jsonl'

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            step = data.get('step_index')
            if step == 157:
                print("Step 157 JSON data keys:", list(data.keys()))
                content = data.get('content', '')
                print(f"Content length: {len(content)}")
                print(content[:500])
                print("...")
                print(content[-500:])
        except Exception as e:
            pass
