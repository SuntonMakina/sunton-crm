import re

file_path = '/Users/berkhan/Documents/Websiteler/Call Center CRM/app/workspace/page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Locate the ternary: {activeTab === 'whatsapp' ? ( ... ) : ( ... )}
# We look for the start: {activeTab === 'whatsapp' ? (
# and find the middle: ) : (
# and the end: )}
start_marker = "{activeTab === 'whatsapp' ? ("
middle_marker = ") : ("

start_idx = content.find(start_marker)
if start_idx == -1:
    print("Could not find start marker")
    exit(1)

# Now find the middle marker after the start marker
middle_idx = content.find(middle_marker, start_idx)
if middle_idx == -1:
    print("Could not find middle marker")
    exit(1)

# We want to remove from start_marker to the middle marker, including ') : ('
# Wait, if we remove that, the content of the 'else' block remains.
# Let's extract the else block.
# The else block ends with the matching ')}' of the ternary.
# Let's find the matching ')}' for the ternary.
# We can find it by parsing curly braces or locating it.
# In page.tsx:
# ) : (
#   <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
#   ...
#   </div>
# )}
# Let's find the closing ')}' after middle_idx.
# Since it is followed by:
#       {/* 4. UNIFIED CALL RESULT & EDIT & FORWARD DIALOG */}
# We can search for ')}' followed by this comment or just count braces.
end_marker = "      {/* 4. UNIFIED CALL RESULT & EDIT & FORWARD DIALOG */}"
end_comment_idx = content.find(end_marker, middle_idx)
if end_comment_idx == -1:
    print("Could not find end comment")
    exit(1)

# Find the last ')}' before the end comment
closing_block = content[middle_idx:end_comment_idx]
last_brace_idx = closing_block.rfind(")}")
if last_brace_idx == -1:
    print("Could not find closing brace")
    exit(1)

absolute_last_brace_idx = middle_idx + last_brace_idx

# We construct the new content:
# Everything before start_idx
# The content of the else block (from middle_idx + len(middle_marker) to absolute_last_brace_idx)
# Everything after absolute_last_brace_idx + 2 (since ')}' is 2 characters)

before_part = content[:start_idx]
else_content = content[middle_idx + len(middle_marker):absolute_last_brace_idx]
after_part = content[absolute_last_brace_idx + 2:]

new_content = before_part + else_content + after_part

# Let's write the modified content back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Successfully cleaned up WhatsApp ternary blocks in app/workspace/page.tsx!")
