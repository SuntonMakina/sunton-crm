import json
import os

map_path = '/Users/berkhan/Documents/Websiteler/Call Center CRM/.next/dev/server/chunks/ssr/app_workspace_page_tsx_1g_yck4._.js.map'
output_path = '/Users/berkhan/Documents/Websiteler/Call Center CRM/app/workspace/page.tsx'

with open(map_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

found = False
sections = data.get('sections', [])
for sec_idx, section in enumerate(sections):
    inner_map = section.get('map', {})
    sources = inner_map.get('sources', [])
    sources_content = inner_map.get('sourcesContent', [])
    
    for idx, src in enumerate(sources):
        if 'workspace/page.tsx' in src or src.endswith('page.tsx'):
            print(f"Found match in section {sec_idx}, source {idx}: {src}")
            if idx < len(sources_content) and sources_content[idx]:
                content = sources_content[idx]
                with open(output_path, 'w', encoding='utf-8') as out_f:
                    out_f.write(content)
                print(f"SUCCESS: Restored page.tsx from section sourcemap! Length: {len(content)}")
                found = True
                break
    if found:
        break

if not found:
    print("Failed to find page.tsx content in any of the sections.")
