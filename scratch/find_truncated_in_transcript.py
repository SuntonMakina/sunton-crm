import json

transcript_path = "/Users/berkhan/.gemini/antigravity-ide/brain/ce1c77c2-fd1b-4dd9-99ef-94fa5ebb2d4d/.system_generated/logs/transcript.jsonl"

with open(transcript_path, "r", encoding="utf-8") as f:
    for i, line in enumerate(f):
        if '"source":"USER_EXPLICIT"' in line or '"type":"USER_INPUT"' in line:
            obj = json.loads(line)
            content = obj.get("content", "")
            if "Sunton CRM - Telefon Arama Görsellerinden Çıkarılan" in content:
                print(f"Line {i} matches!")
                print(f"Content length: {len(content)}")
                print(f"Is content truncated? {'truncated' in content or '...' in content[-20:]}")
                # Print first 200 and last 200 characters of the content
                print("Start of content:", content[:200])
                print("End of content:", content[-200:])
