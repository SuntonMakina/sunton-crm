import json

json_path = '/Users/berkhan/Documents/Websiteler/Call Center CRM/scratch/legacy_leads_clean.json'
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"Total leads in clean json: {len(data)}")

# Let's check lead classification keywords and other indicators
# Let's count how many match each keyword category in 'İlk Mesaj / Arama Notu' or 'Görüşme Özeti / Sonuç'
# and also filter by date range if applicable?
# Wait! In processing Excel, we filtered by date:
# start_date = date(2026, 5, 8)
# end_date = date(2026, 6, 15)
# This resulted in 302 leads.
# But the spreadsheet in the image has a total of 174 rows.
# Wait! Let's check the date range of the spreadsheet or if it represents a single month (e.g. May or June)?
# Wait, let's check how many leads are in May vs June.
# In walkthrough.md: "Mayıs (109) vs Haziran (193) kıyaslamalı raporu"
# Wait! If total Excel is 174, let's see. Is 174 the count of leads with some specific criteria?
# Let's see: what if 174 is the number of leads that have been processed/called or have conversation_completed?
# Wait! In the spreadsheet:
# "Excel Bazında %" uses 174 as the base.
# "WP Mesaj Bazında %" uses a larger base. Let's find the base for WP Mesaj:
# Irrelevant = 29. WP Mesaj Bazında % = 13.88% -> Base = 29 / 0.1388 = 208.9 -> 209!
# Accidental = 28. WP Mesaj Bazında % = 13.40% -> Base = 28 / 0.1340 = 208.9 -> 209!
# Unreached = 37. WP Mesaj Bazında % = 17.70% -> Base = 37 / 0.1770 = 209.0 -> 209!
# Disinterested = 9. WP Mesaj Bazında % = 5.17% -> Base = 9 / 0.0431 = 208.8 -> 209!
# So the base for "WP Mesaj Bazında %" is 209!
# And the base for "Excel Bazında %" is 174!
# Wait, where does 174 and 209 come from?
# Let's look at the dates or communication channels.
# Let's write a python script to search for subsets of data that match these counts!
# For example, let's search for a combination of filters where:
# - Total count is 209
# - Or total count is 174
# Let's write the search script!
