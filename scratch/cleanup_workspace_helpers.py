import re

file_path = '/Users/berkhan/Documents/Websiteler/Call Center CRM/app/workspace/page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove WhatsApp Integration states block
state_block = """  // WhatsApp Integration states
  const [selectedWhatsAppLead, setSelectedWhatsAppLead] = useState<any>(null)
  const [wpMessages, setWpMessages] = useState<any[]>([])
  const [loadingWpMessages, setLoadingWpMessages] = useState(false)
  const [wpMessageText, setWpMessageText] = useState('')
  const [sendingWpMessage, setSendingWpMessage] = useState(false)
  const [simulatingLead, setSimulatingLead] = useState(false)"""

if state_block in content:
    content = content.replace(state_block, "")
    print("Removed WhatsApp Integration states block.")
else:
    # Try with different spaces if any
    print("State block exact match not found, trying regex...")
    content = re.sub(r'\s*// WhatsApp Integration states\s*const \[selectedWhatsAppLead,.*?\n\s*const \[simulatingLead,.*?;\s*', '', content, flags=re.DOTALL)

# 2. Simplify selectedWhatsAppLead block in fetchData
old_fetch_block = """      if (assignedLeads) {
        setLeads(assignedLeads)
        if (selectedWhatsAppLead) {
          const updatedLead = assignedLeads.find(l => l.id === selectedWhatsAppLead.id)
          if (updatedLead) {
            setSelectedWhatsAppLead(updatedLead)
          }
        }
      }"""

new_fetch_block = """      if (assignedLeads) {
        setLeads(assignedLeads)
      }"""

if old_fetch_block in content:
    content = content.replace(old_fetch_block, new_fetch_block)
    print("Simplified fetchData assignedLeads block.")
else:
    # Try direct search
    print("old_fetch_block exact match not found, looking for parts...")

# 3. Remove WhatsApp functions block from // Effect to load WhatsApp messages to const handleStatusChange
# Let's find the start of "// Effect to load WhatsApp messages"
start_fn_marker = "  // Effect to load WhatsApp messages"
end_fn_marker = "  const handleStatusChange = async"

start_idx = content.find(start_fn_marker)
end_idx = content.find(end_fn_marker)

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + content[end_idx:]
    print("Successfully removed WhatsApp helpers, effects, and simulation functions.")
else:
    print(f"Markers not found. start_idx: {start_idx}, end_idx: {end_idx}")

# Write updated file
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
