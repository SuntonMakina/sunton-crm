import json

json_path = '/Users/berkhan/Documents/Websiteler/Call Center CRM/scratch/legacy_leads_clean.json'
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

for item in data:
    if item['legacy_lead_id'] in ('L-0006', 'L-0014'):
        print(f"ID: {item['legacy_lead_id']} | Row: {item['legacy_excel_row']}")
        print(f"  lead_status_text: {item['lead_status_text']}")
        print(f"  first_message_note: {item['first_message_note']}")
