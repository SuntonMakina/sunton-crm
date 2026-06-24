import json
import os

transcript_path = '/Users/berkhan/.gemini/antigravity-ide/brain/8ac0bb0f-ffa0-4a1b-9f4f-66abb7d3657b/.system_generated/logs/transcript.jsonl'

def inspect():
    if not os.path.exists(transcript_path):
        print(f"Error: Transcript file not found at {transcript_path}")
        return
        
    with open(transcript_path, 'r', encoding='utf-8') as f:
        for i, line in enumerate(f):
            if 'LEGACY_LEADS_JSON' in line:
                print(f"Found on line {i}")
                try:
                    data = json.loads(line)
                    print(f"Keys: {data.keys()}")
                    print(f"Source: {data.get('source')}, Type: {data.get('type')}, Status: {data.get('status')}")
                    content = data.get('content', '')
                    print(f"Content length: {len(content)}")
                    # print first 100 and last 100 characters of content
                    print(f"Start: {content[:200]}")
                    print(f"End: {content[-200:]}")
                except Exception as e:
                    print("Error parsing line:", e)

if __name__ == '__main__':
    inspect()
