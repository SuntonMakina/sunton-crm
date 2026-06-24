import json

message_file = "/Users/berkhan/.gemini/antigravity-ide/brain/ce1c77c2-fd1b-4dd9-99ef-94fa5ebb2d4d/.system_generated/messages/5dace48c-b8a7-42c3-8a13-687656306c14.json"
output_path = "/Users/berkhan/Documents/Websiteler/Call Center CRM/scratch/user_call_logs.json"

with open(message_file, "r", encoding="utf-8") as f:
    data = json.load(f)

payload_raw = data.get("stepPayload", "")
if isinstance(payload_raw, str):
    payload = json.loads(payload_raw)
else:
    payload = payload_raw

print("Payload keys:", list(payload.keys()))

user_message = payload.get("userMessage", {})
print("userMessage keys:", list(user_message.keys()))

content = user_message.get("content", "")
print("userMessage content length:", len(content))

if content:
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
    print("Could not find content.")
