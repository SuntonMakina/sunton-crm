import json
import os

message_file = "/Users/berkhan/.gemini/antigravity-ide/brain/ce1c77c2-fd1b-4dd9-99ef-94fa5ebb2d4d/.system_generated/messages/5dace48c-b8a7-42c3-8a13-687656306c14.json"
output_path = "/Users/berkhan/Documents/Websiteler/Call Center CRM/scratch/user_call_logs.json"

print(f"Reading {message_file}...")
with open(message_file, "r", encoding="utf-8") as f:
    data = json.load(f)

# The structure of the message JSON file should contain the content
print("Keys in message file:", list(data.keys()))
content = data.get("content", "")
print("Length of content:", len(content))

if not content:
    # Try another key or print keys
    for k, v in data.items():
        if isinstance(v, str) and "Sunton CRM - Telefon Arama Görsellerinden Çıkarılan" in v:
            content = v
            break

if content:
    # Find JSON bounds
    start_idx = content.find("{")
    end_idx = content.rfind("}")
    if start_idx != -1 and end_idx != -1:
        json_str = content[start_idx:end_idx+1]
        try:
            parsed_json = json.loads(json_str)
            print("Successfully parsed embedded JSON!")
            print("Unique phone records count:", len(parsed_json.get("unique_phone_records", [])))
            with open(output_path, "w", encoding="utf-8") as out:
                json.dump(parsed_json, out, ensure_ascii=False, indent=2)
            print(f"Saved to {output_path}")
        except Exception as e:
            print(f"Failed to parse embedded JSON: {e}")
            with open(output_path + ".raw", "w", encoding="utf-8") as out:
                out.write(json_str)
            print("Wrote raw json to user_call_logs.json.raw for debugging.")
else:
    print("Could not find the target content inside message file.")
