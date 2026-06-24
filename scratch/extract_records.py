import json
import os

transcript_path = '/Users/berkhan/.gemini/antigravity-ide/brain/ce1c77c2-fd1b-4dd9-99ef-94fa5ebb2d4d/.system_generated/logs/transcript.jsonl'
output_json_path = 'scratch/full_user_request.json'

if not os.path.exists(transcript_path):
    print(f"Transcript not found at {transcript_path}")
    exit(1)

found_request = None
with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            step = json.loads(line)
            # We are looking for step type USER_INPUT or content containing the task_name
            content = step.get('content', '')
            if 'Sunton CRM - 1 Mayıs 2026 ile 22 Haziran 2026 Arasındaki Tüm Leadleri Geri Yükle' in content:
                found_request = content
                print(f"Found request in step index {step.get('step_index')}")
                break
        except Exception as e:
            pass

if not found_request:
    print("Could not find the target user request in the transcript.")
    exit(1)

# The content contains text and then a JSON block starting with {
# Let's extract the JSON block
try:
    json_start = found_request.find('{')
    if json_start != -1:
        json_str = found_request[json_start:]
        # Try to parse it
        parsed_json = json.loads(json_str)
        print("Successfully parsed JSON from transcript!")
        print("Keys in JSON:", list(parsed_json.keys()))
        if 'records' in parsed_json:
            records = parsed_json['records']
            print(f"Number of records in JSON: {len(records)}")
            with open('scratch/restored_records.json', 'w', encoding='utf-8') as out_f:
                json.dump(records, out_f, ensure_ascii=False, indent=2)
            print("Saved restored_records.json")
            
            # Save the full json too
            with open(output_json_path, 'w', encoding='utf-8') as out_f:
                json.dump(parsed_json, out_f, ensure_ascii=False, indent=2)
            print("Saved full_user_request.json")
        else:
            print("JSON does not contain 'records' key.")
    else:
        print("Could not find JSON start '{' in content.")
except Exception as e:
    print("Failed to parse/extract JSON:", e)
    # Let's print a small snippet of the end of the text to see if it is truncated in the transcript itself
    print("Snippet of found_request around JSON start:")
    print(found_request[:500])
    print("...")
    print(found_request[-500:])
