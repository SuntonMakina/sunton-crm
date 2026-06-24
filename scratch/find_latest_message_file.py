import os
import json
import glob

messages_dir = "/Users/berkhan/.gemini/antigravity-ide/brain/ce1c77c2-fd1b-4dd9-99ef-94fa5ebb2d4d/.system_generated/messages"
files = glob.glob(os.path.join(messages_dir, "*.json"))

# Sort by modification time
files.sort(key=os.path.getmtime, reverse=True)

print("Latest 5 message files by modification time:")
for f in files[:5]:
    mtime = os.path.getmtime(f)
    size = os.path.getsize(f)
    print(f"File: {os.path.basename(f)}, Size: {size} bytes, Modified: {mtime}")
    
    # Try reading the JSON and checking key characteristics
    try:
        with open(f, "r", encoding="utf-8") as file:
            data = json.load(file)
        payload = data.get("stepPayload", "")
        if isinstance(payload, str):
            # Print first 200 chars
            print("  stepPayload sample:", payload[:200])
        elif isinstance(payload, dict):
            print("  stepPayload is dict. Keys:", list(payload.keys()))
    except Exception as e:
        print("  Error:", e)
