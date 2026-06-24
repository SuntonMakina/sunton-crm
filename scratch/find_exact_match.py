import json
from datetime import datetime

json_path = '/Users/berkhan/Documents/Websiteler/Call Center CRM/scratch/legacy_leads_clean.json'
with open(json_path, 'r', encoding='utf-8') as f:
    leads = json.load(f)

# Let's see: is there a date range or a specific filter that matches 174 evaluated leads and 209 total messages?
# Let's try to search all possible date ranges (start_date, end_date) in our 302 leads.
# Wait! Let's extract all unique dates and sort them.
dates = sorted(list(set(l.get('first_contact_date') for l in leads if l.get('first_contact_date'))))

print(f"Unique dates from {dates[0]} to {dates[-1]}. Total unique dates: {len(dates)}")

# Let's search if any sub-range of dates gives exactly 174/209 or close!
# We can search all combinations of (start_idx, end_idx)
found = False
for i in range(len(dates)):
    for j in range(i, len(dates)):
        d_start = dates[i]
        d_end = dates[j]
        
        sub_leads = [l for l in leads if d_start <= l.get('first_contact_date') <= d_end]
        
        # Let's check if the count matches 174 or 209
        # Wait, if total messages (WP Mesaj Bazında) is 209, and total evaluated (Excel Bazında) is 174.
        # Let's check if we can find a subset where the count of WhatsApp leads is 209, or the total count is 209!
        # If total count is 209, let's see. Or if WhatsApp channel leads is 209.
        total_cnt = len(sub_leads)
        wp_cnt = len([l for l in sub_leads if l.get('communication_channel') == 'WhatsApp Mesajı'])
        
        if total_cnt == 209 or wp_cnt == 209 or total_cnt == 174:
            print(f"Date range: {d_start} to {d_end} | Total: {total_cnt} | WP: {wp_cnt}")

# Let's also check if there is an explicit field in the clean JSON that matches the 5 quality categories.
# In the original excel sheet, did the column "Dönüş Olumlu mu?" or "Konuşma Yapıldı mı?" or "Lead Durumu" have these values?
# Let's search for unique values of "Lead Durumu" or "Sonraki Aksiyon" in the excel sheets.
# Wait, let's inspect the original Excel row values for the 174 evaluated leads.
