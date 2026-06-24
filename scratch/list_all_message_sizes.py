import os
import glob

messages_dir = "/Users/berkhan/.gemini/antigravity-ide/brain/ce1c77c2-fd1b-4dd9-99ef-94fa5ebb2d4d/.system_generated/messages"
files = glob.glob(os.path.join(messages_dir, "*.json"))

files.sort(key=os.path.getsize, reverse=True)

print("All message files sorted by size:")
for f in files:
    size = os.path.getsize(f)
    mtime = os.path.getmtime(f)
    print(f"File: {os.path.basename(f)}, Size: {size} bytes, Modified: {mtime}")
