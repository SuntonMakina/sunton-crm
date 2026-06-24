import json
import re

json_path = '/Users/berkhan/Documents/Websiteler/Call Center CRM/scratch/legacy_leads_clean.json'
with open(json_path, 'r', encoding='utf-8') as f:
    leads = json.load(f)

# Categories
# 1. Alakasız / konu dışı lead
# 2. Yanlışlıkla tıklayan / "elim çarptı"
# 3. Ulaşılamayan / açmayan / cevap vermeyen
# 4. İlgilenmeyen / vazgeçen / başka yerden alan

alakasiz_cnt = 0
yanlislikla_cnt = 0
ulasilamayan_cnt = 0
ilgilenmeyen_cnt = 0
diger_cnt = 0

alakasiz_leads = []
yanlislikla_leads = []
ulasilamayan_leads = []
ilgilenmeyen_leads = []

for l in leads:
    note = (l.get('first_message_note') or "").lower()
    summary = (l.get('conversation_summary') or "").lower()
    text = note + " " + summary
    
    # Check "Yanlışlıkla"
    if any(k in text for k in ['yanlışlıkla', 'elim çarptı', 'yanlislikla', 'elim carpti', 'hatalı arama', 'hatali arama']):
        yanlislikla_cnt += 1
        yanlislikla_leads.append(l)
    # Check "Alakasız"
    elif any(k in text for k in ['ahşap', 'mermer', 'sunger', 'sünger', 'komur', 'kömür', 'forklift', 'cam', 'kumaş', 'kumas', 'pleksi', 'alakasız', 'alakasiz', 'konu dışı', 'konu disi', 'ikinci el', '2. el', '2.el']):
        alakasiz_cnt += 1
        alakasiz_leads.append(l)
    # Check "Ulaşılamayan"
    elif any(k in text for k in ['ulaşılamadı', 'ulasilamadi', 'ulaşılamıyor', 'ulasilamiyor', 'cevap vermiyor', 'cevap vermedi', 'cevap yok', 'ulaşamadım', 'ulasamadim', 'aradım açmadı', 'aradim acmadi', 'meşgul', 'mesgul', 'kapalı', 'kapali']):
        ulasilamayan_cnt += 1
        ulasilamayan_leads.append(l)
    # Check "İlgilenmeyen"
    elif any(k in text for k in ['ilgilenmiyor', 'vazgeçti', 'vazgecti', 'almaktan vazgeçti', 'bütçe', 'butce', 'pahalı', 'pahali', 'başka firmadan', 'baska firmadan']):
        ilgilenmeyen_cnt += 1
        ilgilenmeyen_leads.append(l)
    else:
        diger_cnt += 1

print(f"Keyword Counts:")
print(f"  Yanlışlıkla: {yanlislikla_cnt}")
print(f"  Alakasız: {alakasiz_cnt}")
print(f"  Ulaşılamayan: {ulasilamayan_cnt}")
print(f"  İlgilenmeyen: {ilgilenmeyen_cnt}")
print(f"  Diger: {diger_cnt}")
print(f"  Sum: {yanlislikla_cnt + alakasiz_cnt + ulasilamayan_cnt + ilgilenmeyen_cnt}")
