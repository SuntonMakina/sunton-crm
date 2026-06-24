import urllib.request
import json

auth_url = 'https://ffjwugzhdjzibaghkdcm.supabase.co/auth/v1/token?grant_type=password'
leads_url = 'https://ffjwugzhdjzibaghkdcm.supabase.co/rest/v1/leads?select=*&limit=1'
key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmand1Z3poZGp6aWJhZ2hrZGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTcyMDEsImV4cCI6MjA5NzE3MzIwMX0.fXgoX2kzUgBL7ak668Cqp4ktXCw0OyElE6g0TWxGs7w'

# 1. Sign in
auth_req = urllib.request.Request(
    auth_url,
    headers={
        'apikey': key,
        'Content-Type': 'application/json'
    },
    data=json.dumps({
        'email': 'mert@suntonmakina.com',
        'password': 'Sunton123*'
    }).encode('utf-8')
)

try:
    with urllib.request.urlopen(auth_req) as auth_res:
        auth_data = json.loads(auth_res.read().decode('utf-8'))
        token = auth_data['access_token']
        print("Authenticated successfully!")
        
        # 2. Query leads
        leads_req = urllib.request.Request(
            leads_url,
            headers={
                'apikey': key,
                'Authorization': f'Bearer {token}'
            }
        )
        
        with urllib.request.urlopen(leads_req) as leads_res:
            leads = json.loads(leads_res.read().decode('utf-8'))
            if leads:
                print("Columns in leads table:")
                for col in sorted(list(leads[0].keys())):
                    print(f"  {col}: {type(leads[0][col])}")
            else:
                print("Leads table is empty!")
except Exception as e:
    print("Error:", e)
