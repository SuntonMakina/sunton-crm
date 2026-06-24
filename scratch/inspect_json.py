import json
import os

def inspect_file(filepath):
    if not os.path.exists(filepath):
        print(f"{filepath} does not exist.")
        return
    with open(filepath, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
            print(f"File: {filepath}")
            print(f"Type: {type(data)}")
            if isinstance(data, list):
                print(f"Length: {len(data)}")
                if len(data) > 0:
                    print("First element keys:", list(data[0].keys()))
                    print("First element sample (legacy_lead_id, first_contact_date, full_name, phone):")
                    print(f"  ID: {data[0].get('legacy_lead_id') or data[0].get('Lead ID')}")
                    print(f"  Date: {data[0].get('first_contact_date') or data[0].get('İlk Temas Tarihi')}")
                    print(f"  Name: {data[0].get('full_name') or data[0].get('Ad Soyad / Firma')}")
                    print(f"  Phone: {data[0].get('phone') or data[0].get('Telefon Numarası')}")
                    print("Last element sample:")
                    print(f"  ID: {data[-1].get('legacy_lead_id') or data[-1].get('Lead ID')}")
                    print(f"  Date: {data[-1].get('first_contact_date') or data[-1].get('İlk Temas Tarihi')}")
                    print(f"  Name: {data[-1].get('full_name') or data[-1].get('Ad Soyad / Firma')}")
                    print(f"  Phone: {data[-1].get('phone') or data[-1].get('Telefon Numarası')}")
            else:
                print("Keys:", list(data.keys()))
        except Exception as e:
            print(f"Error parsing {filepath}: {e}")

inspect_file('scratch/legacy_leads_clean.json')
inspect_file('scratch/new_leads_batch.json')
