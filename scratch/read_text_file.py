import os

text_path = '/Users/berkhan/Downloads/Sunton_Tum_Excel_Tablolari_Antigravity_Metin.txt'

if os.path.exists(text_path):
    print(f"File exists. Size: {os.path.getsize(text_path)} bytes")
    with open(text_path, 'r', encoding='utf-8') as f:
        head = f.read(1500)
    print("--- HEAD OF FILE ---")
    print(head)
    print("--- END HEAD ---")
else:
    print("File does not exist.")
