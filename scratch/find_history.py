import os
import json

history_dir = '/Users/berkhan/Library/Application Support/Code/User/History'

if not os.path.exists(history_dir):
    print(f"History directory {history_dir} does not exist.")
    exit(1)

found_any = False
resources = []
for root, dirs, files in os.walk(history_dir):
    if 'entries.json' in files:
        entries_path = os.path.join(root, 'entries.json')
        try:
            with open(entries_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                resource = data.get('resource', '')
                resources.append((root, resource))
                if 'app/workspace/page.tsx' in resource:
                    print(f"Found history folder: {root}")
                    print(f"Resource path: {resource}")
                    print("Entries:")
                    for entry in data.get('entries', []):
                        # The file version is named using the entry's ID
                        entry_file = os.path.join(root, entry.get('id', ''))
                        file_size = os.path.getsize(entry_file) if os.path.exists(entry_file) else 0
                        print(f"  ID: {entry.get('id')}, Size: {file_size} bytes, Time: {entry.get('sentinel') or entry.get('timestamp')}")
                    found_any = True
        except Exception as e:
            pass

print(f"Total resources tracked in VS Code: {len(resources)}")
if not found_any:
    print("No history entries found for page.tsx in standard VS Code.")
