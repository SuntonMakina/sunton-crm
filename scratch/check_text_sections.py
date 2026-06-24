import os

text_path = '/Users/berkhan/Downloads/Sunton_Tum_Excel_Tablolari_Antigravity_Metin.txt'

if os.path.exists(text_path):
    with open(text_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print("Contains 'L-0001':", 'L-0001' in content)
    print("Contains 'Lead Takip':", 'Lead Takip' in content)
    print("Length of file content:", len(content))
    
    # Search for DOSYA sections
    import re
    dosyas = re.findall(r'DOSYA:\s*(.*?)\n', content)
    print("Found DOSYA sections:", dosyas)
    
    # Search for SAYFA sections
    sayfas = re.findall(r'SAYFA:\s*(.*?)\n', content)
    print("Found SAYFA sections:", sayfas[:20])
else:
    print("File does not exist.")
