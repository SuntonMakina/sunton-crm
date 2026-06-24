import csv
import os

csv_path = 'scratch/Sunton Makina Reklam Lead Takip - Lead Takip (2).csv'

if not os.path.exists(csv_path):
    print(f"CSV file not found at {csv_path}")
    exit(1)

with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader) # Row 1
    # Check if there is another header row or if it's the actual headers
    print("CSV Headers:", header)
    
    rows = list(reader)
    print(f"Total rows in CSV: {len(rows)}")
    
    lead_ids = []
    leads_by_id = {}
    dates = []
    
    for idx, r in enumerate(rows):
        # Lead ID is column 0 (1st column)
        if len(r) > 0:
            lead_id = r[0].strip()
            if lead_id.startswith('L-'):
                lead_ids.append(lead_id)
                leads_by_id[lead_id] = {
                    'row_num': idx + 2, # 1-based, +1 for header
                    'date': r[1].strip() if len(r) > 1 else '',
                    'name': r[4].strip() if len(r) > 4 else '',
                    'phone': r[5].strip() if len(r) > 5 else ''
                }
                if len(r) > 1 and r[1].strip():
                    dates.append(r[1].strip())
                    
    print(f"Total rows starting with L-: {len(lead_ids)}")
    if lead_ids:
        print(f"Min Lead ID: {min(lead_ids)}")
        print(f"Max Lead ID: {max(lead_ids)}")
        
        # Check for missing IDs
        num_ids = []
        for lid in lead_ids:
            try:
                num_ids.append(int(lid.split('-')[1]))
            except:
                pass
        
        if num_ids:
            num_ids.sort()
            min_num = num_ids[0]
            max_num = num_ids[-1]
            all_set = set(num_ids)
            missing = [f"L-{str(x).zfill(4)}" for x in range(min_num, max_num + 1) if x not in all_set]
            print(f"Lead ID numbers count: {len(num_ids)}, range: L-{str(min_num).zfill(4)} to L-{str(max_num).zfill(4)}")
            print(f"Missing Lead IDs in range: {len(missing)}")
            if missing:
                print("First 10 missing:", missing[:10])
                print("Last 10 missing:", missing[-10:])
                
            # Print sample of first and last 3 rows in CSV
            print("\nFirst 3 L- rows in CSV:")
            for lid in lead_ids[:3]:
                print(f"  {lid}: {leads_by_id[lid]}")
            print("\nLast 3 L- rows in CSV:")
            for lid in lead_ids[-3:]:
                print(f"  {lid}: {leads_by_id[lid]}")
