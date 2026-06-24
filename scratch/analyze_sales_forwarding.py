import json

json_path = '/Users/berkhan/Documents/Websiteler/Call Center CRM/scratch/legacy_leads_clean.json'
with open(json_path, 'r', encoding='utf-8') as f:
    leads = json.load(f)

# Let's count total forwarded leads
forwarded = [l for l in leads if l.get('sales_representative_text') and l.get('sales_representative_text') != "-"]
print(f"Total leads with sales rep assigned in Excel: {len(forwarded)}")

# Let's group forwarded leads by lead_status_text
status_counts = {}
for l in forwarded:
    st = l.get('lead_status_text', 'None')
    status_counts[st] = status_counts.get(st, 0) + 1

print("\nForwarded Leads by Status:")
for st, cnt in status_counts.items():
    print(f"  {st}: {cnt}")

# Let's group all leads in the clean json by lead_status_text
all_status_counts = {}
for l in leads:
    st = l.get('lead_status_text', 'None')
    all_status_counts[st] = all_status_counts.get(st, 0) + 1

print("\nAll Leads by Status:")
for st, cnt in all_status_counts.items():
    print(f"  {st}: {cnt}")
