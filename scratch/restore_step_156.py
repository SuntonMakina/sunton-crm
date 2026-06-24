import json
import re

transcript_path = '/Users/berkhan/.gemini/antigravity-ide/brain/2eb6bc09-956f-4048-8367-5de2dda2defa/.system_generated/logs/transcript.jsonl'
output_path = '/Users/berkhan/Documents/Websiteler/Call Center CRM/app/workspace/page.tsx'

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            # We want the system response of the view_file tool call at step 156
            # which is step_index 157, type is VIEW_FILE or SYSTEM
            if data.get('step_index') == 157:
                content = data.get('content', '')
                
                # Split content into lines
                lines = content.split('\n')
                restored_lines = []
                
                # Check for headers/footers in the tool response
                # Format is:
                # "Created At: ... \n Completed At: ... \n File Path: ... \n Total Lines: ... \n Total Bytes: ... \n Showing lines ... \n The following code has been modified ... \n 1: <original_line> \n ... \n The above content shows the entire ..."
                
                in_code_block = False
                for l in lines:
                    # Match line number pattern: "123: " at start
                    match = re.match(r'^(\d+):\s(.*)', l)
                    if match:
                        restored_lines.append(match.group(2))
                    else:
                        # If it's a line that doesn't start with a number, but we're inside code
                        # Wait, sometimes blank lines or lines without numbers might occur, but typically all lines of code have a number prefix.
                        pass
                
                # Write restored code
                restored_code = '\n'.join(restored_lines)
                with open(output_path, 'w', encoding='utf-8') as out_f:
                    out_f.write(restored_code)
                print(f"Successfully restored page.tsx from Step 157! Total lines: {len(restored_lines)}")
                break
        except Exception as e:
            print("Error parsing line:", e)
