import json
import os

transcript_path = "/Users/berkhan/.gemini/antigravity-ide/brain/ce1c77c2-fd1b-4dd9-99ef-94fa5ebb2d4d/.system_generated/logs/transcript.jsonl"
output_path = "/Users/berkhan/Documents/Websiteler/Call Center CRM/scratch/user_call_logs.json"

print(f"Reading {transcript_path}...")
with open(transcript_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find the last USER_INPUT step or user request
last_user_content = None
for line in reversed(lines):
    try:
        obj = json.loads(line)
        if obj.get("type") == "USER_INPUT" or obj.get("source") == "USER_EXPLICIT":
            last_user_content = obj.get("content")
            if last_user_content and "Sunton CRM - Telefon Arama Görsellerinden Çıkarılan" in last_user_content:
                break
    except Exception as e:
        continue

if not last_user_content:
    print("Could not find the last user message containing the JSON.")
    exit(1)

# Extract JSON from the content
# Find the start of the JSON block
start_idx = last_user_content.find("{")
end_idx = last_user_content.rfind("}")

if start_idx == -1 or end_idx == -1:
    print("Could not find JSON bounds in user message.")
    exit(1)

json_str = last_user_content[start_idx:end_idx+1]
try:
    data = json.loads(json_str)
    print("JSON parsed successfully!")
    print(f"Unique phone records count in parsed data: {len(data.get('unique_phone_records', []))}")
    with open(output_path, "w", encoding="utf-8") as out:
        json.dump(data, out, ensure_ascii=False, indent=2)
    print(f"Saved to {output_path}")
except Exception as e:
    print(f"Failed to parse JSON: {e}")
    # Write raw string to inspect
    with open(output_path + ".raw", "w", encoding="utf-8") as out:
        out.write(json_str)
    print("Wrote raw json content to user_call_logs.json.raw for debugging.")
