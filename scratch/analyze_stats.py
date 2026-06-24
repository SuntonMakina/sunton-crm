import json

json_path = '/Users/berkhan/Documents/Websiteler/Call Center CRM/scratch/legacy_leads_clean.json'
with open(json_path, 'r', encoding='utf-8') as f:
    leads = json.load(f)

print(f"Total leads: {len(leads)}")

# Let's count communications channels
channels = {}
for l in leads:
    ch = l.get('communication_channel', 'None')
    channels[ch] = channels.get(ch, 0) + 1

print("\nCommunication Channels:")
for ch, cnt in channels.items():
    print(f"  {ch}: {cnt}")

# Let's see if there is any field indicating 'WP Mesaj Bazında' vs 'Excel Bazında'
# In Turkey, "WhatsApp Mesajı" is a channel.
# Let's count leads where communication_channel is 'WhatsApp Mesajı'
wp_leads = [l for l in leads if l.get('communication_channel') == 'WhatsApp Mesajı']
print(f"\nWhatsApp Channel Leads: {len(wp_leads)}")

# Let's check where the communication channel is 'Telefon Araması' or others
phone_leads = [l for l in leads if l.get('communication_channel') == 'Telefon Araması']
print(f"Telefon Channel Leads: {len(phone_leads)}")

# Let's look at the notes/summaries and find if we can identify subsets:
# Irrelevant (Alakasız): 29
# Accidental (Yanlışlıkla): 28
# Unreached (Ulaşılamayan): 37
# Disinterested (İlgilenmeyen): 9
# Sum = 103.
# Remaining potential = 71.
# Total Excel Base = 174.

# Let's search for fields in the JSON that match these.
# Wait, let's look at notes and search for categories!
# Let's write a categorizer that counts:
# - how many leads mention 'alakasız' or 'konu dışı' or similar
# - how many leads mention 'yanlışlıkla' or 'elim çarptı'
# - how many mention 'cevap vermiyor', 'ulaşılamadı'
# - how many mention 'ilgilenmiyor', 'vazgeçti'
# Let's output a summary of these checks.
