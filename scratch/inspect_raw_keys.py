import json

message_file = "/Users/berkhan/.gemini/antigravity-ide/brain/ce1c77c2-fd1b-4dd9-99ef-94fa5ebb2d4d/.system_generated/messages/5dace48c-b8a7-42c3-8a13-687656306c14.json"

with open(message_file, "r", encoding="utf-8") as f:
    data = json.load(f)

for k, v in data.items():
    print(f"Key: {k}, Type: {type(v)}")
    if isinstance(v, str):
        print(f"  Length: {len(v)}")
        print(f"  Sample: {v[:100]}")
    elif isinstance(v, dict):
        print(f"  Keys: {list(v.keys())}")
