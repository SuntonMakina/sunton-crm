import json
from datetime import datetime

json_path = '/Users/berkhan/Documents/Websiteler/Call Center CRM/scratch/legacy_leads_clean.json'
with open(json_path, 'r', encoding='utf-8') as f:
    leads = json.load(f)

# Group by month of first_contact_date
by_month = {}
for l in leads:
    dt_str = l.get('first_contact_date')
    if not dt_str:
        continue
    dt = datetime.strptime(dt_str, '%Y-%m-%d')
    m_key = f"{dt.year}-{dt.month:02d}"
    if m_key not in by_month:
        by_month[m_key] = []
    by_month[m_key].append(l)

for m_key, m_leads in by_month.items():
    print(f"\nMonth: {m_key} - Total Leads: {len(m_leads)}")
    
    # Classify inside this month
    alakasiz = 0
    yanlislikla = 0
    ulasilamayan = 0
    ilgilenmeyen = 0
    potansiyel = 0
    
    for l in m_leads:
        note = (l.get('first_message_note') or "").lower()
        summary = (l.get('conversation_summary') or "").lower()
        text = note + " " + summary
        
        # Priority mapping
        if any(k in text for k in ['yanlışlıkla', 'elim çarptı', 'yanlislikla', 'elim carpti', 'hatalı arama', 'hatali arama']):
            yanlislikla += 1
        elif any(k in text for k in ['ahşap', 'mermer', 'sunger', 'sünger', 'komur', 'kömür', 'forklift', 'cam', 'kumaş', 'kumas', 'pleksi', 'alakasız', 'alakasiz', 'konu dışı', 'konu disi', 'ikinci el', '2. el', '2.el']):
            alakasiz += 1
        elif any(k in text for k in ['ulaşılamadı', 'ulasilamadi', 'ulaşılamıyor', 'ulasilamiyor', 'cevap vermiyor', 'cevap vermedi', 'cevap yok', 'ulaşamadım', 'ulasamadim', 'aradım açmadı', 'aradim acmadi', 'meşgul', 'mesgul', 'kapalı', 'kapali']):
            ulasilamayan += 1
        elif any(k in text for k in ['ilgilenmiyor', 'vazgeçti', 'vazgecti', 'almaktan vazgeçti', 'bütçe', 'butce', 'pahalı', 'pahali', 'başka firmadan', 'baska firmadan']):
            ilgilenmeyen += 1
        else:
            potansiyel += 1
            
    print(f"  Yanlışlıkla: {yanlislikla}")
    print(f"  Alakasız: {alakasiz}")
    print(f"  Ulaşılamayan: {ulasilamayan}")
    print(f"  İlgilenmeyen: {ilgilenmeyen}")
    print(f"  Potansiyel: {potansiyel}")
    print(f"  Sum of problematic: {yanlislikla + alakasiz + ulasilamayan + ilgilenmeyen}")
