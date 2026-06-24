import json
import os

filepath = '/Users/berkhan/Downloads/Antigravity_01_Mayis_22_Haziran_2026_Tum_Veriler_JSON_Prompt.json'

if not os.path.exists(filepath):
    print(f"File not found at {filepath}")
    exit(1)

with open(filepath, 'r', encoding='utf-8') as f:
    try:
        data = json.load(f)
        print("Keys in downloaded JSON:", list(data.keys()))
        if 'records' in data:
            print(f"Number of records: {len(data['records'])}")
            print("First record details:")
            print(json.dumps(data['records'][0], indent=2, ensure_ascii=False))
            print("Last record details:")
            print(json.dumps(data['records'][-1], indent=2, ensure_ascii=False))
        else:
            print("No 'records' key found.")
    except Exception as e:
        print("Error parsing JSON:", e)
