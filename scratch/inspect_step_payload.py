import json

message_file = "/Users/berkhan/.gemini/antigravity-ide/brain/ce1c77c2-fd1b-4dd9-99ef-94fa5ebb2d4d/.system_generated/messages/5dace48c-b8a7-42c3-8a13-687656306c14.json"

with open(message_file, "r", encoding="utf-8") as f:
    data = json.load(f)

payload = data.get("stepPayload", "")
print("stepPayload length:", len(payload))
# Print the first 1000 characters of stepPayload
print("stepPayload start:")
print(payload[:1000])

# Let's search if there's any JSON string inside stepPayload
import re
# Look for something that looks like the start of unique_phone_records
matches = [m.start() for m in re.finditer("unique_phone_records", payload)]
print("Matches for 'unique_phone_records':", matches)
for m in matches[:5]:
    print(payload[m-100:m+200])
