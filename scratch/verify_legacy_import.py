import json
import os
from datetime import datetime

clean_json_path = '/Users/berkhan/Documents/Websiteler/Call Center CRM/scratch/legacy_leads_clean.json'

def verify():
    if not os.path.exists(clean_json_path):
        print(f"Error: JSON file not found at {clean_json_path}")
        return
        
    with open(clean_json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    print(f"--- Verification Report ---")
    print(f"Total parsed leads in JSON: {len(data)}")
    
    # Splits
    may_count = 0
    jun_count = 0
    unparsed_count = 0
    
    min_date = None
    max_date = None
    
    lead_ids = set()
    duplicate_ids = []
    
    for lead in data:
        # Check uniqueness of Lead ID
        lid = lead.get('legacy_lead_id')
        if lid in lead_ids:
            duplicate_ids.append(lid)
        lead_ids.add(lid)
        
        # Check dates
        dt_str = lead.get('first_contact_date')
        if dt_str:
            dt = datetime.fromisoformat(dt_str).date()
            if min_date is None or dt < min_date:
                min_date = dt
            if max_date is None or dt > max_date:
                max_date = dt
                
            if dt.month == 5:
                may_count += 1
            elif dt.month == 6:
                jun_count += 1
            else:
                unparsed_count += 1
        else:
            unparsed_count += 1
            
    print(f"May 2026 count: {may_count} (Expected: 109)")
    print(f"June 2026 count: {jun_count} (Expected: 193)")
    print(f"Other/Unparsed count: {unparsed_count} (Expected: 0)")
    print(f"Date range: {min_date} to {max_date} (Expected: 2026-05-08 to 2026-06-15)")
    print(f"Duplicate legacy lead IDs found: {len(duplicate_ids)}")
    
    # Data quality flags summary
    flags_summary = {}
    for lead in data:
        for f in lead.get('data_quality_flags', []):
            flags_summary[f] = flags_summary.get(f, 0) + 1
            
    print("\nData Quality Flags Summary:")
    for f, count in sorted(flags_summary.items()):
        print(f"  {f}: {count}")
        
    # Check checks
    assert len(data) == 302, "Error: Total count must be 302"
    assert may_count == 109, "Error: May count must be 109"
    assert jun_count == 193, "Error: June count must be 193"
    print("\nAll automated validation checks PASSED successfully!")

if __name__ == '__main__':
    verify()
