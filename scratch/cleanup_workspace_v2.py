import os

file_path = '/Users/berkhan/Documents/Websiteler/Call Center CRM/app/workspace/page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Locate the start of the ternary expression
start_marker = "{activeTab === 'whatsapp' ? ("
start_idx = content.find(start_marker)
if start_idx == -1:
    print("Could not find start marker in file.")
    exit(1)

print(f"Found start marker at index: {start_idx}")

# Bracket matching for the first parenthesis group
# The start marker ends with '('
idx = start_idx + len(start_marker)
paren_stack = 1  # We are already inside one parenthesis group
while idx < len(content) and paren_stack > 0:
    char = content[idx]
    if char == '(':
        paren_stack += 1
    elif char == ')':
        paren_stack -= 1
    idx += 1

first_part_end = idx - 1
print(f"First parenthesis block ends at index: {first_part_end}")
# Verify next characters is ': ('
after_first = content[first_part_end + 1:]
else_start_relative = after_first.find("(")
if else_start_relative == -1 or else_start_relative > 10:
    print("Could not find else start parenthesis (: ()")
    print("Next characters:", after_first[:20])
    exit(1)

else_start_idx = first_part_end + 1 + else_start_relative
print(f"Else block starts at index: {else_start_idx}")

# Bracket matching for the second parenthesis group (the else block)
idx = else_start_idx + 1
paren_stack = 1
while idx < len(content) and paren_stack > 0:
    char = content[idx]
    if char == '(':
        paren_stack += 1
    elif char == ')':
        paren_stack -= 1
    idx += 1

second_part_end = idx - 1
print(f"Second parenthesis block ends at index: {second_part_end}")

# Verify next character is '}'
if content[second_part_end + 1] != '}':
    print(f"Warning: Expected '}}' after second block but found '{content[second_part_end + 1]}'")

# Extract the else content (the regular dialer layout)
# We want to keep everything from else_start_idx + 1 to second_part_end
else_content = content[else_start_idx + 1:second_part_end]

# Extract the before and after parts
before_part = content[:start_idx]
after_part = content[second_part_end + 2:] # skip the '}' as well

# Rebuild new content
new_content = before_part + else_content + after_part

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("SUCCESS: page.tsx cleaned up using stack matching!")
