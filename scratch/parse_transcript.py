import json
import re
import os

transcript_path = '/Users/berkhan/.gemini/antigravity-ide/brain/8ac0bb0f-ffa0-4a1b-9f4f-66abb7d3657b/.system_generated/logs/transcript.jsonl'
output_leads_path = '/Users/berkhan/Documents/Websiteler/Call Center CRM/scratch/legacy_leads.json'
output_lists_path = '/Users/berkhan/Documents/Websiteler/Call Center CRM/scratch/legacy_lists.json'

def extract_data():
    if not os.path.exists(transcript_path):
        print(f"Error: Transcript file not found at {transcript_path}")
        return
    
    # Read last lines of transcript.jsonl
    print("Reading transcript file...")
    last_user_input = None
    with open(transcript_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                # Look for USER_INPUT
                if data.get('source') == 'USER_EXPLICIT' and data.get('type') == 'USER_INPUT':
                    # We want the latest one which contains "LEGACY_LEADS_JSON"
                    content = data.get('content', '')
                    if 'LEGACY_LEADS_JSON' in content:
                        last_user_input = content
            except Exception as e:
                pass
                
    if not last_user_input:
        print("Error: Could not find user input containing LEGACY_LEADS_JSON in transcript.")
        return
        
    print("User input found. Extracting JSON blocks...")
    
    # Extract LEGACY_LISTS_JSON
    lists_match = re.search(r'LEGACY_LISTS_JSON\s*```json\s*(.*?)\s*```', last_user_input, re.DOTALL)
    if lists_match:
        lists_json_str = lists_match.group(1)
        try:
            lists_data = json.loads(lists_json_str)
            with open(output_lists_path, 'w', encoding='utf-8') as out_f:
                json.dump(lists_data, out_f, ensure_ascii=False, indent=2)
            print(f"Successfully wrote legacy lists to {output_lists_path}")
        except Exception as e:
            print("Failed to parse LEGACY_LISTS_JSON:", e)
    else:
        print("Could not find LEGACY_LISTS_JSON block.")

    # Extract LEGACY_LEADS_JSON
    leads_match = re.search(r'LEGACY_LEADS_JSON\s*```json\s*(.*?)\s*```', last_user_input, re.DOTALL)
    if leads_match:
        leads_json_str = leads_match.group(1)
        try:
            leads_data = json.loads(leads_json_str)
            with open(output_leads_path, 'w', encoding='utf-8') as out_f:
                json.dump(leads_data, out_f, ensure_ascii=False, indent=2)
            print(f"Successfully wrote legacy leads ({len(leads_data)} items) to {output_leads_path}")
        except Exception as e:
            print("Failed to parse LEGACY_LEADS_JSON:", e)
    else:
        print("Could not find LEGACY_LEADS_JSON block.")

if __name__ == '__main__':
    extract_data()
