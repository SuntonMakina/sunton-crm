import json
import shutil

src = '/Users/berkhan/Downloads/Antigravity_01_Mayis_22_Haziran_2026_Tum_Veriler_JSON_Prompt.json'
dst = 'scratch/restored_records_full.json'

try:
    shutil.copy(src, dst)
    print(f"Copied successfully to {dst}")
except Exception as e:
    print(f"Failed to copy: {e}")
